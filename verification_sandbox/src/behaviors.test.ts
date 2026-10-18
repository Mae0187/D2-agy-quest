import { describe, expect, it } from 'vitest';
import {
  BehaviorRegistry,
  F01_STRAIGHT,
  F02_HOMING,
  F04_ZIGZAG,
  STATE_STRIDE,
  StepOutcome,
  advanceLinear,
  clearBehaviorState,
  createBehaviorEnv,
  createDefaultBehaviors,
} from './behaviors.js';
import { angularDistance, phiToScreenVelocity, screenToPhi } from './geometry.js';
import {
  MissileState,
  createMissileRuntime,
  type F02Params,
  type F04Params,
  type MissileRuntime,
  type MissileSpec,
} from './missile-types.js';
import { deriveSeed } from './rng.js';
import { NO_TARGET, TargetRegistry, groundToScreenInto } from './targets.js';
import { makeUnit, specOf } from './testkit.js';

function makeRt(x: number, y: number, phi: number, spec: MissileSpec, seed = 1): MissileRuntime {
  const rt = createMissileRuntime(0);
  rt.state = MissileState.ACTIVE;
  rt.x = x;
  rt.y = y;
  rt.phi = phi;
  rt.speed = spec.motion.speed;
  rt.rngState = seed;
  return rt;
}

// ───────────────────────── 共用直線推進 / F01 ─────────────────────────

describe('advanceLinear / F01', () => {
  it('constant speed along φ = 0', () => {
    const spec = specOf('s', { lifetime: { maxLifeTicks: 100, rangePx: null } });
    const rt = makeRt(0, 0, 0, spec);
    for (let i = 0; i < 5; i++) expect(advanceLinear(rt, spec)).toBe(StepOutcome.CONTINUE);
    expect(rt.x).toBeCloseTo(50, 9);
    expect(rt.y).toBeCloseTo(0, 9);
    expect(rt.travelled).toBeCloseTo(50, 9);
    expect(rt.speed).toBe(10);
  });

  it('direction φ = 30° in Ground space', () => {
    const spec = specOf('s');
    const rt = makeRt(0, 0, 30, spec);
    for (let i = 0; i < 5; i++) advanceLinear(rt, spec);
    expect(rt.x).toBeCloseTo(50 * Math.cos(Math.PI / 6), 9);
    expect(rt.y).toBeCloseTo(50 * Math.sin(Math.PI / 6), 9);
  });

  it('acceleration is clamped at maxSpeed (2 → 5 → 8 → 10 → 10)', () => {
    const spec = specOf('acc', { motion: { speed: 2, accel: 3, maxSpeed: 10 } });
    const rt = makeRt(0, 0, 0, spec);
    const speeds: number[] = [];
    const travelled: number[] = [];
    for (let i = 0; i < 4; i++) {
      advanceLinear(rt, spec);
      speeds.push(rt.speed);
      travelled.push(rt.travelled);
    }
    expect(speeds).toEqual([5, 8, 10, 10]);
    expect(travelled).toEqual([5, 13, 23, 33]);
  });

  it('deceleration bottoms out at 0 and the missile stops (10 → 6 → 2 → 0 → 0)', () => {
    const spec = specOf('dec', { motion: { speed: 10, accel: -4, maxSpeed: 10 } });
    const rt = makeRt(0, 0, 0, spec);
    const speeds: number[] = [];
    for (let i = 0; i < 4; i++) {
      advanceLinear(rt, spec);
      speeds.push(rt.speed);
    }
    expect(speeds).toEqual([6, 2, 0, 0]);
    expect(rt.travelled).toBe(8);
    expect(rt.x).toBeCloseTo(8, 9);
  });

  it('range clamps the last step exactly onto the range end', () => {
    const spec = specOf('rng', { lifetime: { maxLifeTicks: 100, rangePx: 25 } });
    const rt = makeRt(0, 0, 0, spec);
    expect(advanceLinear(rt, spec)).toBe(StepOutcome.CONTINUE);
    expect(advanceLinear(rt, spec)).toBe(StepOutcome.CONTINUE);
    expect(advanceLinear(rt, spec)).toBe(StepOutcome.RANGE);
    expect(rt.x).toBe(25);
    expect(rt.travelled).toBe(25);
  });

  it('reaching the range exactly (not overshooting) also reports RANGE', () => {
    const spec = specOf('rng', { lifetime: { maxLifeTicks: 100, rangePx: 20 } });
    const rt = makeRt(0, 0, 0, spec);
    advanceLinear(rt, spec);
    expect(advanceLinear(rt, spec)).toBe(StepOutcome.RANGE);
    expect(rt.x).toBe(20);
  });

  it.each([0, 30, 45, 60, 90, 135, 200, 300])(
    'φ = %i°: Ground motion maps to the 2:1 screen (Δsy/Δsx = 0.5·tanφ) and round-trips through screenToPhi',
    (phi) => {
      const spec = specOf('geo');
      const rt = makeRt(0, 0, phi, spec);
      for (let i = 0; i < 4; i++) advanceLinear(rt, spec);
      const s = { x: 0, y: 0 };
      groundToScreenInto(rt.x, rt.y, s);

      const c = Math.cos((phi * Math.PI) / 180);
      if (Math.abs(c) > 1e-6) {
        expect(s.y / s.x).toBeCloseTo(0.5 * Math.tan((phi * Math.PI) / 180), 9);
      }
      expect(angularDistance(screenToPhi(s.x, s.y), phi)).toBeLessThan(1e-9);

      // 與 geometry.ts 的單 tick 螢幕速度一致
      const one = makeRt(0, 0, phi, spec);
      advanceLinear(one, spec);
      const v = phiToScreenVelocity(phi, 10);
      expect(one.x).toBeCloseTo(v.vx, 9);
      expect(one.y * 0.5).toBeCloseTo(v.vy, 9);
    },
  );

  it('F01 update is exactly advanceLinear', () => {
    const spec = specOf('s');
    const env = createBehaviorEnv(new TargetRegistry(), 2);
    const a = makeRt(3, 4, 77, spec);
    const b = makeRt(3, 4, 77, spec);
    F01_STRAIGHT.init(a, spec, env);
    expect(F01_STRAIGHT.update(a, spec, env)).toBe(advanceLinear(b, spec));
    expect(a).toEqual(b);
  });
});

// ───────────────────────── F02 追蹤 ─────────────────────────

function homingSpec(patch: Partial<F02Params> = {}, id = 'homing'): MissileSpec {
  const behavior: F02Params = {
    family: 'F02',
    turnRateDegPerTick: 10,
    acquireRadiusPx: 300,
    reacquire: true,
    fallback: 'straight',
    ...patch,
  };
  return specOf(id, { motion: { speed: 5, accel: 0, maxSpeed: 5 }, behavior });
}

describe('F02 homing', () => {
  it('turns at most turnRate per tick', () => {
    const reg = new TargetRegistry();
    const env = createBehaviorEnv(reg, 2);
    const spec = homingSpec();
    const target = reg.createPoint(0, 100); // 正下方,φ = 90
    const rt = makeRt(0, 0, 0, spec);
    rt.targetId = target.id;
    F02_HOMING.init(rt, spec, env);
    expect(rt.targetId).toBe(target.id); // 明確目標被沿用

    F02_HOMING.update(rt, spec, env);
    expect(rt.phi).toBeCloseTo(10, 9);
    F02_HOMING.update(rt, spec, env);
    expect(rt.phi).toBeGreaterThan(10);
    expect(rt.phi).toBeLessThanOrEqual(20 + 1e-9);
  });

  it('takes the shortest arc across the 0°/360° seam (both directions)', () => {
    const reg = new TargetRegistry();
    const env = createBehaviorEnv(reg, 2);
    const spec = homingSpec();
    const rad = (d: number) => (d * Math.PI) / 180;

    const t1 = reg.createPoint(100 * Math.cos(rad(10)), 100 * Math.sin(rad(10)));
    const a = makeRt(0, 0, 350, spec);
    a.targetId = t1.id;
    F02_HOMING.update(a, spec, env);
    expect(angularDistance(a.phi, 0)).toBeLessThan(1e-9); // 350 + 10 = 360 → 0

    const t2 = reg.createPoint(100 * Math.cos(rad(350)), 100 * Math.sin(rad(350)));
    const b = makeRt(0, 0, 10, spec);
    b.targetId = t2.id;
    F02_HOMING.update(b, spec, env);
    expect(angularDistance(b.phi, 0)).toBeLessThan(1e-9); // 10 − 10 = 0
  });

  it('converges on a stationary target', () => {
    const reg = new TargetRegistry();
    const env = createBehaviorEnv(reg, 2);
    env.team = 1;
    const spec = homingSpec({ turnRateDegPerTick: 12 });
    const target = reg.createUnit(makeUnit(100, 100));
    const rt = makeRt(0, 0, 0, spec);
    rt.targetId = target.id;
    let minD = Infinity;
    for (let i = 0; i < 100; i++) {
      F02_HOMING.update(rt, spec, env);
      minD = Math.min(minD, Math.hypot(rt.x - 100, rt.y - 100));
    }
    expect(minD).toBeLessThan(6);
  });

  it('init acquires the nearest living unit of the hit team inside the acquire radius', () => {
    const reg = new TargetRegistry();
    const env = createBehaviorEnv(reg, 2);
    env.team = 1;
    const spec = homingSpec({ acquireRadiusPx: 100 });
    const near = reg.createUnit(makeUnit(50, 0, 1));
    reg.createUnit(makeUnit(10, 0, 2)); // 敵我陣營不符
    reg.createUnit(makeUnit(200, 0, 1)); // 半徑外
    const rt = makeRt(0, 0, 0, spec);
    F02_HOMING.init(rt, spec, env);
    expect(rt.targetId).toBe(near.id);
  });

  it('init leaves NO_TARGET when nobody is in range', () => {
    const reg = new TargetRegistry();
    const env = createBehaviorEnv(reg, 2);
    env.team = 1;
    const spec = homingSpec({ acquireRadiusPx: 50 });
    reg.createUnit(makeUnit(200, 0, 1));
    const rt = makeRt(0, 0, 0, spec);
    F02_HOMING.init(rt, spec, env);
    expect(rt.targetId).toBe(NO_TARGET);
  });

  it("target lost + reacquire=false + fallback 'straight': keeps heading and flies on", () => {
    const reg = new TargetRegistry();
    const env = createBehaviorEnv(reg, 2);
    env.team = 1;
    const spec = homingSpec({ reacquire: false });
    const u = makeUnit(0, 100);
    const t = reg.createUnit(u);
    const rt = makeRt(0, 0, 0, spec);
    rt.targetId = t.id;
    F02_HOMING.update(rt, spec, env);
    const phiAfterTurn = rt.phi;

    u.alive = false;
    const x0 = rt.x;
    const y0 = rt.y;
    expect(F02_HOMING.update(rt, spec, env)).toBe(StepOutcome.CONTINUE);
    expect(rt.targetId).toBe(NO_TARGET);
    expect(rt.phi).toBe(phiAfterTurn);
    expect(Math.hypot(rt.x - x0, rt.y - y0)).toBeCloseTo(5, 9);
  });

  it("fallback 'expire' returns EXPIRE and does not move", () => {
    const reg = new TargetRegistry();
    const env = createBehaviorEnv(reg, 2);
    env.team = 1;
    const spec = homingSpec({ reacquire: false, fallback: 'expire' });
    const rt = makeRt(7, 8, 33, spec);
    expect(F02_HOMING.update(rt, spec, env)).toBe(StepOutcome.EXPIRE);
    expect(rt.x).toBe(7);
    expect(rt.y).toBe(8);
  });

  it('reacquire=true picks a new target when the old one dies; reacquire=false does not', () => {
    const reg = new TargetRegistry();
    const env = createBehaviorEnv(reg, 2);
    env.team = 1;
    const u1 = makeUnit(60, 0);
    const t1 = reg.createUnit(u1);
    const t2 = reg.createUnit(makeUnit(0, 80));

    const on = homingSpec({ reacquire: true });
    const a = makeRt(0, 0, 0, on);
    a.targetId = t1.id;
    u1.alive = false;
    F02_HOMING.update(a, on, env);
    expect(a.targetId).toBe(t2.id);

    u1.alive = true;
    const off = homingSpec({ reacquire: false });
    const b = makeRt(0, 0, 0, off);
    b.targetId = t1.id;
    u1.alive = false;
    F02_HOMING.update(b, off, env);
    expect(b.targetId).toBe(NO_TARGET);
  });

  it('refuses to run with a spec of another family', () => {
    const env = createBehaviorEnv(new TargetRegistry(), 2);
    const spec = specOf('s');
    expect(() => F02_HOMING.update(makeRt(0, 0, 0, spec), spec, env)).toThrow();
  });
});

// ───────────────────────── F04 隨機折線 ─────────────────────────

function zigzagSpec(patch: Partial<F04Params> = {}): MissileSpec {
  const behavior: F04Params = { family: 'F04', stepJitterDeg: 30, retargetEveryTicks: 3, ...patch };
  return specOf('zig', { motion: { speed: 4, accel: 0, maxSpeed: 4 }, behavior });
}

/** 與管理器相同的呼叫方式:update 之前 ageTicks = k,之後 +1。 */
function runZigzag(spec: MissileSpec, seed: number, ticks: number, phi0 = 40) {
  const env = createBehaviorEnv(new TargetRegistry(), 2);
  const rt = makeRt(0, 0, phi0, spec, seed);
  F04_ZIGZAG.init(rt, spec, env);
  const phis: number[] = [];
  const xs: number[] = [];
  for (let k = 0; k < ticks; k++) {
    rt.ageTicks = k;
    F04_ZIGZAG.update(rt, spec, env);
    phis.push(rt.phi);
    xs.push(rt.x, rt.y);
  }
  return { rt, phis, xs };
}

describe('F04 zigzag', () => {
  it('direction only changes on retarget ticks and stays within ±jitter of the base', () => {
    const spec = zigzagSpec({ stepJitterDeg: 30, retargetEveryTicks: 3 });
    const { phis } = runZigzag(spec, deriveSeed(1, 1), 60, 40);
    for (let k = 0; k < phis.length; k++) {
      if (k % 3 !== 0) expect(phis[k]).toBe(phis[k - 1]);
      expect(angularDistance(phis[k]!, 40)).toBeLessThanOrEqual(30 + 1e-9);
    }
    expect(new Set(phis).size).toBeGreaterThan(5);
  });

  it('is deterministic for the same seed and differs between seeds', () => {
    const spec = zigzagSpec();
    const a = runZigzag(spec, 12345, 80);
    const b = runZigzag(spec, 12345, 80);
    const c = runZigzag(spec, 54321, 80);
    expect(a.xs).toEqual(b.xs);
    expect(a.rt.rngState).toBe(b.rt.rngState);
    expect(a.xs).not.toEqual(c.xs);
  });

  it('consumes exactly one random number per retarget', () => {
    const spec = zigzagSpec({ retargetEveryTicks: 4 });
    const seed = 777;
    const { rt } = runZigzag(spec, seed, 20); // k = 0,4,8,12,16 → 5 次
    let s = seed;
    for (let i = 0; i < 5; i++) s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    expect(rt.rngState).toBe(s);
  });

  it('jitter is unbiased and spans both signs (3000 retargets)', () => {
    const spec = zigzagSpec({ stepJitterDeg: 30, retargetEveryTicks: 1 });
    const { phis } = runZigzag(spec, deriveSeed(9, 9), 3000, 100);
    let sum = 0;
    let neg = 0;
    let pos = 0;
    for (const p of phis) {
      let d = p - 100;
      if (d > 180) d -= 360;
      if (d < -180) d += 360;
      sum += d;
      if (d < 0) neg++;
      if (d > 0) pos++;
      expect(Math.abs(d)).toBeLessThanOrEqual(30 + 1e-9);
    }
    expect(Math.abs(sum / phis.length)).toBeLessThan(2);
    expect(neg).toBeGreaterThan(1000);
    expect(pos).toBeGreaterThan(1000);
  });

  it('zero jitter and no target is a straight line along the spawn direction', () => {
    const spec = zigzagSpec({ stepJitterDeg: 0, retargetEveryTicks: 1 });
    const { rt } = runZigzag(spec, 5, 10, 25);
    expect(angularDistance(rt.phi, 25)).toBeLessThan(1e-9);
    expect(rt.x).toBeCloseTo(40 * Math.cos((25 * Math.PI) / 180), 9);
    expect(rt.y).toBeCloseTo(40 * Math.sin((25 * Math.PI) / 180), 9);
  });

  it('with a live target the base direction is the bearing to it', () => {
    const reg = new TargetRegistry();
    const env = createBehaviorEnv(reg, 2);
    const target = reg.createPoint(0, 100);

    const exact = zigzagSpec({ stepJitterDeg: 0, retargetEveryTicks: 1 });
    const a = makeRt(0, 0, 0, exact, 3);
    a.targetId = target.id;
    F04_ZIGZAG.init(a, exact, env);
    F04_ZIGZAG.update(a, exact, env);
    expect(a.phi).toBeCloseTo(90, 9);

    const loose = zigzagSpec({ stepJitterDeg: 10, retargetEveryTicks: 1 });
    for (let seed = 1; seed <= 20; seed++) {
      const rt = makeRt(0, 0, 0, loose, seed);
      rt.targetId = target.id;
      F04_ZIGZAG.init(rt, loose, env);
      F04_ZIGZAG.update(rt, loose, env);
      expect(angularDistance(rt.phi, 90)).toBeLessThanOrEqual(10 + 1e-9);
    }
  });

  it('a dead target is dropped and the last base direction is kept', () => {
    const reg = new TargetRegistry();
    const env = createBehaviorEnv(reg, 2);
    const u = makeUnit(0, 100);
    const t = reg.createUnit(u);
    const spec = zigzagSpec({ stepJitterDeg: 0, retargetEveryTicks: 1 });
    const rt = makeRt(0, 0, 0, spec, 3);
    rt.targetId = t.id;
    F04_ZIGZAG.init(rt, spec, env);
    F04_ZIGZAG.update(rt, spec, env);
    expect(rt.phi).toBeCloseTo(90, 9);
    u.alive = false;
    F04_ZIGZAG.update(rt, spec, env);
    expect(rt.targetId).toBe(NO_TARGET);
    expect(rt.phi).toBeCloseTo(90, 9);
  });
});

// ───────────────────────── 環境與註冊表 ─────────────────────────

describe('behavior env and registry', () => {
  it('state is per-slot and clearBehaviorState only clears that slot', () => {
    const env = createBehaviorEnv(new TargetRegistry(), 3);
    expect(env.state.length).toBe(3 * STATE_STRIDE);
    env.state.fill(7);
    clearBehaviorState(env, 1);
    for (let i = 0; i < env.state.length; i++) {
      const inSlot1 = i >= STATE_STRIDE && i < 2 * STATE_STRIDE;
      expect(env.state[i]).toBe(inSlot1 ? 0 : 7);
    }
  });

  it('default registry has F01/F02/F04 and rejects duplicate registration', () => {
    const reg = createDefaultBehaviors();
    expect(reg.has('F01')).toBe(true);
    expect(reg.has('F02')).toBe(true);
    expect(reg.has('F04')).toBe(true);
    expect(reg.has('F03')).toBe(false);
    expect(() => reg.register(F01_STRAIGHT)).toThrow();
    expect(new BehaviorRegistry().get('F01')).toBeUndefined();
  });
});
