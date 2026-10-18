import { describe, expect, it } from 'vitest';
import { BehaviorRegistry } from './behaviors.js';
import { phiToScreenVelocity } from './geometry.js';
import { HIT_MEMORY, MissileManager, NO_TEAM, type MissileManagerOptions } from './manager.js';
import {
  MissileState,
  UNLIMITED_PIERCE,
  type F02Params,
  type F04Params,
  type MissileHooks,
  type MissileRuntime,
  type MissileSpec,
} from './missile-types.js';
import { NO_HANDLE } from './pool.js';
import { Lcg } from './rng.js';
import { NO_TARGET, TargetRegistry, groundToScreenInto } from './targets.js';
import { makeUnit, specOf } from './testkit.js';

declare const performance: { now(): number };
declare const console: { log(...args: unknown[]): void };

function setup(specs: MissileSpec[], opts: Partial<MissileManagerOptions> = {}) {
  const targets = opts.targets ?? new TargetRegistry();
  const log: string[] = [];
  const logging: MissileHooks = {
    onSpawn: (_rt, s) => {
      log.push(`spawn:${s.id}`);
    },
    onActivate: (_rt, s) => {
      log.push(`activate:${s.id}`);
    },
    onHit: (_rt, s, t) => {
      log.push(`hit:${s.id}:${t}`);
    },
    onExpire: (rt, s, r) => {
      log.push(`expire:${s.id}:${r}:${rt.x}`);
    },
    onExplode: (_rt, s) => {
      log.push(`explode:${s.id}`);
    },
    onDead: (_rt, s) => {
      log.push(`dead:${s.id}`);
    },
  };
  const hooks = opts.hooks === undefined ? logging : opts.hooks;
  const mgr = new MissileManager({ ...opts, specs, targets, hooks });
  return { mgr, targets, log };
}

function stepN(mgr: MissileManager, n: number): void {
  for (let i = 0; i < n; i++) mgr.step();
}

// ───────────────────────── 建構驗證 ─────────────────────────

describe('construction', () => {
  it('rejects an invalid spec and names it in the message', () => {
    const bad = specOf('broken', { motion: { speed: -1, accel: 0, maxSpeed: 5 } });
    expect(() => setup([bad])).toThrow(/broken/);
  });

  it('rejects duplicate spec ids', () => {
    expect(() => setup([specOf('a'), specOf('a')])).toThrow(/duplicate/);
  });

  it('rejects a missing child spec and spawn cycles (including self-reference)', () => {
    const boom = (child: string) =>
      specOf('boom', {
        explosion: { durationTicks: 1, onHit: true, onExpire: true, spawnMissileId: child },
      });
    expect(() => setup([boom('nope')])).toThrow(/does not exist/);
    expect(() => setup([boom('boom')])).toThrow(/cycle/);

    const a = specOf('a', { explosion: { durationTicks: 1, onHit: true, onExpire: true, spawnMissileId: 'b' } });
    const b = specOf('b', { explosion: { durationTicks: 1, onHit: true, onExpire: true, spawnMissileId: 'a' } });
    expect(() => setup([a, b])).toThrow(/cycle/);
  });

  it('rejects specs whose family has no registered behavior', () => {
    expect(() => setup([specOf('a')], { behaviors: new BehaviorRegistry() })).toThrow(/no behavior/);
  });

  it('rejects an invalid capacity', () => {
    expect(() => setup([specOf('a')], { capacity: 0 })).toThrow(RangeError);
  });

  it('spawn validates its arguments', () => {
    const { mgr } = setup([specOf('a')]);
    expect(() => mgr.spawn(5, 0, 0, 0)).toThrow(RangeError);
    expect(() => mgr.spawn(-1, 0, 0, 0)).toThrow(RangeError);
    expect(() => mgr.spawn(0, NaN, 0, 0)).toThrow(RangeError);
    expect(() => mgr.spawn(0, 0, 0, Infinity)).toThrow(RangeError);
    expect(() => mgr.spawn(0, 0, 0, 0, 40000)).toThrow(RangeError);
    expect(() => mgr.spawn(0, 0, 0, 0, 1.5)).toThrow(RangeError);
    expect(() => mgr.spawnById('zzz', 0, 0, 0)).toThrow(RangeError);
    expect(mgr.specIndexOf('a')).toBe(0);
    expect(mgr.specIndexOf('zzz')).toBe(-1);
  });
});

// ───────────────────────── 生成、啟用、幾何 ─────────────────────────

describe('spawn and activation', () => {
  it('spawn creates an INIT record without moving; the first step activates and moves', () => {
    const { mgr, log } = setup([specOf('bone')]);
    const h = mgr.spawn(0, 100, 50, 0);
    const rt = mgr.pool.get(h)!;
    expect(rt.state).toBe(MissileState.INIT);
    expect(rt.teleported).toBe(true);
    expect(rt.prevX).toBe(100);
    expect(rt.prevY).toBe(50);
    expect(log).toEqual(['spawn:bone']);

    mgr.step();
    expect(rt.state).toBe(MissileState.ACTIVE);
    expect(rt.x).toBe(110);
    expect(rt.prevX).toBe(100);
    expect(rt.teleported).toBe(false);
    expect(rt.ageTicks).toBe(1);
    expect(log).toEqual(['spawn:bone', 'activate:bone']);
  });

  it('flight follows Ground φ and matches the 2:1 screen velocity from geometry.ts', () => {
    const { mgr } = setup([specOf('bone')]);
    const h = mgr.spawn(0, 0, 0, 60);
    const rt = mgr.pool.get(h)!;
    mgr.step();
    const v = phiToScreenVelocity(60, 10);
    expect(rt.x - rt.prevX).toBeCloseTo(v.vx, 9);
    expect((rt.y - rt.prevY) * 0.5).toBeCloseTo(v.vy, 9);

    stepN(mgr, 5); // 共 6 步
    expect(rt.x).toBeCloseTo(60 * Math.cos(Math.PI / 3), 9);
    expect(rt.y).toBeCloseTo(60 * Math.sin(Math.PI / 3), 9);
    const s = { x: 0, y: 0 };
    groundToScreenInto(rt.x, rt.y, s);
    expect(s.y / s.x).toBeCloseTo(0.5 * Math.tan(Math.PI / 3), 9);
  });

  it('missiles spawned inside a hook activate on the following tick, regardless of slot order', () => {
    const log: string[] = [];
    let mgr: MissileManager | undefined;
    const hooks: MissileHooks = {
      onActivate: (rt, s) => {
        log.push(`activate:${s.id}@${mgr!.tickCount}`);
        if (s.id === 'parent') mgr!.spawn(1, rt.x, rt.y, 0);
      },
    };
    ({ mgr } = setup([specOf('parent'), specOf('child')], { hooks }));
    mgr.spawn(0, 0, 0, 0);
    mgr.step(); // tick 1:parent 啟用並生成 child(槽位 1,在迴圈後面)
    expect(log).toEqual(['activate:parent@1']);
    expect(mgr.pool.at(1).state).toBe(MissileState.INIT);
    mgr.step(); // tick 2:child 啟用
    expect(log).toEqual(['activate:parent@1', 'activate:child@2']);
  });
});

// ───────────────────────── 生命週期 ─────────────────────────

describe('lifetime and range', () => {
  it('dies exactly when ageTicks reaches maxLifeTicks (LIFETIME reason)', () => {
    const { mgr, log } = setup([specOf('bone', { lifetime: { maxLifeTicks: 5, rangePx: null } })]);
    const h = mgr.spawn(0, 0, 0, 0);
    stepN(mgr, 4);
    expect(mgr.isAlive(h)).toBe(true);
    mgr.step();
    expect(mgr.isAlive(h)).toBe(false);
    expect(mgr.pool.get(h)).toBeNull();
    expect(mgr.liveCount).toBe(0);
    expect(log.slice(-2)).toEqual(['expire:bone:0:50', 'dead:bone']);
  });

  it('range expiry stops exactly at the range end (RANGE reason)', () => {
    const spec = specOf('bone', { lifetime: { maxLifeTicks: 100, rangePx: 25 } });
    const { mgr, log } = setup([spec]);
    const h = mgr.spawn(0, 0, 0, 0);
    stepN(mgr, 2);
    expect(mgr.isAlive(h)).toBe(true);
    mgr.step();
    expect(mgr.isAlive(h)).toBe(false);
    expect(log.slice(-2)).toEqual(['expire:bone:1:25', 'dead:bone']);
  });
});

// ───────────────────────── 碰撞與穿透 ─────────────────────────

describe('collision and pierce', () => {
  it('pierce = 1 passes the first target and stops on the second', () => {
    const spec = specOf('bone', {
      lifetime: { maxLifeTicks: 30, rangePx: null },
      collision: { radiusPx: 8, pierce: 1 },
    });
    const { mgr, targets, log } = setup([spec]);
    const a = targets.createUnit(makeUnit(50, 0));
    const b = targets.createUnit(makeUnit(100, 0));
    targets.createUnit(makeUnit(150, 0));
    const h = mgr.spawn(0, 0, 0, 0, 1);

    let steps = 0;
    while (mgr.isAlive(h) && steps < 30) {
      mgr.step();
      steps++;
    }
    expect(steps).toBe(10); // x = 100 時命中第二個
    expect(log.filter((l) => l.startsWith('hit:'))).toEqual([`hit:bone:${a.id}`, `hit:bone:${b.id}`]);
  });

  it('unlimited pierce hits every target exactly once, even while overlapping for several ticks', () => {
    const spec = specOf('spear', {
      motion: { speed: 3, accel: 0, maxSpeed: 3 },
      lifetime: { maxLifeTicks: 60, rangePx: null },
      collision: { radiusPx: 8, pierce: UNLIMITED_PIERCE },
    });
    const { mgr, targets, log } = setup([spec]);
    const ids = [30, 60, 90].map((x) => targets.createUnit(makeUnit(x, 0)).id);
    const h = mgr.spawn(0, 0, 0, 0, 1);
    stepN(mgr, 59);
    expect(mgr.isAlive(h)).toBe(true);
    expect(mgr.pool.get(h)!.hitCount).toBe(3);
    mgr.step();
    expect(mgr.isAlive(h)).toBe(false);
    expect(log.filter((l) => l.startsWith('hit:'))).toEqual(ids.map((id) => `hit:spear:${id}`));
    expect(mgr.stats.hits).toBe(3);
  });

  it('several targets in the same tick are hit nearest-first, ties by smaller id', () => {
    const spec = specOf('spear', {
      lifetime: { maxLifeTicks: 8, rangePx: null },
      collision: { radiusPx: 8, pierce: UNLIMITED_PIERCE },
    });
    const { mgr, targets, log } = setup([spec]);
    const far = targets.createUnit(makeUnit(50, 6));
    const n1 = targets.createUnit(makeUnit(50, 3));
    const n2 = targets.createUnit(makeUnit(50, -3));
    mgr.spawn(0, 0, 0, 0, 1);
    stepN(mgr, 5);
    expect(log.filter((l) => l.startsWith('hit:'))).toEqual([
      `hit:spear:${n1.id}`,
      `hit:spear:${n2.id}`,
      `hit:spear:${far.id}`,
    ]);
  });

  it('team filter, NO_TEAM and dead units never produce hits', () => {
    const spec = specOf('bone', { lifetime: { maxLifeTicks: 8, rangePx: null } });
    const { mgr, targets, log } = setup([spec]);
    targets.createUnit(makeUnit(50, 0, 2));
    targets.createUnit(makeUnit(50, 0, 1, false));
    mgr.spawn(0, 0, 0, 0, 1); // 陣營 1:只有一個死亡單位、一個陣營 2 的單位
    mgr.spawn(0, 0, 0, 0, NO_TEAM); // 不碰撞
    stepN(mgr, 8);
    expect(log.some((l) => l.startsWith('hit:'))).toBe(false);
  });

  it('a hook that kills the missile on hit stops further processing (single hit, single dead)', () => {
    const spec = specOf('spear', {
      lifetime: { maxLifeTicks: 10, rangePx: null },
      collision: { radiusPx: 8, pierce: UNLIMITED_PIERCE },
    });
    const log: string[] = [];
    let mgr: MissileManager | undefined;
    const hooks: MissileHooks = {
      onHit: (rt) => {
        log.push('hit');
        mgr!.kill(mgr!.pool.handleOf(rt));
      },
      onDead: () => {
        log.push('dead');
      },
    };
    const s = setup([spec], { hooks });
    mgr = s.mgr;
    s.targets.createUnit(makeUnit(50, 3));
    s.targets.createUnit(makeUnit(50, -3));
    mgr.spawn(0, 0, 0, 0, 1);
    stepN(mgr, 6);
    expect(log).toEqual(['hit', 'dead']);
    expect(mgr.liveCount).toBe(0);
    expect(mgr.pool.checkIntegrity()).toEqual([]);
  });
});

// ───────────────────────── 爆裂 ─────────────────────────

describe('explosion', () => {
  const fireball = (patch: Partial<MissileSpec['explosion'] & object> = {}) =>
    specOf('fire', {
      blend: 'additive',
      lifetime: { maxLifeTicks: 40, rangePx: null },
      collision: { radiusPx: 8, pierce: 0 },
      explosion: { durationTicks: 3, onHit: true, onExpire: false, spawnMissileId: null, ...patch },
    });

  it('hit → EXPLODING for durationTicks ticks → DEAD (hook order HIT, EXPLODE, DEAD)', () => {
    const { mgr, targets, log } = setup([fireball()]);
    const u = targets.createUnit(makeUnit(50, 0));
    const h = mgr.spawn(0, 0, 0, 0, 1);

    stepN(mgr, 4);
    expect(mgr.pool.get(h)!.state).toBe(MissileState.ACTIVE);
    mgr.step(); // 第 5 步:x = 50,命中
    const rt = mgr.pool.get(h)!;
    expect(rt.state).toBe(MissileState.EXPLODING);
    expect(rt.explodeTicksLeft).toBe(3);
    expect(rt.speed).toBe(0);
    expect(log).toEqual(['spawn:fire', 'activate:fire', `hit:fire:${u.id}`, 'explode:fire']);

    mgr.step(); // left 2
    expect(rt.state).toBe(MissileState.EXPLODING);
    expect(rt.x).toBe(50);
    expect(rt.prevX).toBe(50); // 爆裂中靜止,不再插值
    mgr.step(); // left 1
    expect(mgr.isAlive(h)).toBe(true);
    mgr.step(); // left 0 → DEAD
    expect(mgr.isAlive(h)).toBe(false);
    expect(log[log.length - 1]).toBe('dead:fire');
    expect(mgr.liveCount).toBe(0);
  });

  it('durationTicks = 0 recycles immediately (EXPLODE then DEAD in the same step)', () => {
    const { mgr, targets, log } = setup([fireball({ durationTicks: 0 })]);
    const u = targets.createUnit(makeUnit(50, 0));
    mgr.spawn(0, 0, 0, 0, 1);
    stepN(mgr, 5);
    expect(log.slice(-3)).toEqual([`hit:fire:${u.id}`, 'explode:fire', 'dead:fire']);
    expect(mgr.liveCount).toBe(0);
  });

  it('onExpire explosion: EXPIRE then EXPLODE, then DEAD after the duration', () => {
    const spec = specOf('pop', {
      lifetime: { maxLifeTicks: 3, rangePx: null },
      explosion: { durationTicks: 2, onHit: false, onExpire: true, spawnMissileId: null },
    });
    const { mgr, log } = setup([spec]);
    const h = mgr.spawn(0, 0, 0, 0);
    stepN(mgr, 3);
    expect(log.slice(-2)).toEqual(['expire:pop:0:30', 'explode:pop']);
    expect(mgr.pool.get(h)!.state).toBe(MissileState.EXPLODING);
    mgr.step();
    expect(mgr.isAlive(h)).toBe(true);
    mgr.step();
    expect(mgr.isAlive(h)).toBe(false);
  });

  it('spawns the child missile at the explosion point, inheriting direction and team', () => {
    const frost = specOf('frost', {
      collision: { radiusPx: 8, pierce: 0 },
      explosion: { durationTicks: 2, onHit: true, onExpire: false, spawnMissileId: 'shard' },
    });
    const shard = specOf('shard', {
      motion: { speed: 6, accel: 0, maxSpeed: 6 },
      lifetime: { maxLifeTicks: 4, rangePx: null },
    });
    const { mgr, targets, log } = setup([frost, shard]);
    const u = makeUnit(50, 0);
    targets.createUnit(u);
    mgr.spawn(0, 0, 0, 0, 1);
    stepN(mgr, 5);

    expect(mgr.liveCount).toBe(2);
    const child = mgr.pool.at(1);
    expect(child.state).toBe(MissileState.INIT);
    expect(child.x).toBe(50);
    expect(child.phi).toBe(0);
    expect(child.teleported).toBe(true);
    expect(log.slice(-2)).toEqual(['explode:frost', 'spawn:shard']);

    u.alive = false; // 避免子彈立刻命中同一個單位
    mgr.step();
    expect(child.state).toBe(MissileState.ACTIVE);
    expect(child.x).toBe(56);
    expect(mgr.stats.spawned).toBe(2);
  });
});

// ───────────────────────── 耗盡、handle、清除 ─────────────────────────

describe('capacity, handles and clearing', () => {
  const longLived = specOf('long', { lifetime: { maxLifeTicks: 100, rangePx: null } });

  it("'reject' returns NO_HANDLE and counts it", () => {
    const { mgr } = setup([longLived], { capacity: 4 });
    const hs = Array.from({ length: 6 }, () => mgr.spawn(0, 0, 0, 0));
    expect(hs.slice(0, 4).every((h) => h !== NO_HANDLE)).toBe(true);
    expect(hs.slice(4)).toEqual([NO_HANDLE, NO_HANDLE]);
    expect(mgr.stats.rejected).toBe(2);
    expect(mgr.pool.exhaustedCount).toBe(2);
    expect(mgr.stats.spawned).toBe(4);
  });

  it("'evict-oldest' recycles the longest-lived missile and notifies DEAD", () => {
    const { mgr, log } = setup([longLived], { capacity: 3, onExhausted: 'evict-oldest' });
    const h0 = mgr.spawn(0, 0, 0, 0);
    mgr.step();
    const h1 = mgr.spawn(0, 0, 0, 0);
    mgr.step();
    const h2 = mgr.spawn(0, 0, 0, 0); // 年齡:h0 = 2,h1 = 1,h2 = 0
    const h3 = mgr.spawn(0, 0, 0, 0);

    expect(h3).not.toBe(NO_HANDLE);
    expect(mgr.pool.get(h0)).toBeNull();
    expect(mgr.isAlive(h1)).toBe(true);
    expect(mgr.isAlive(h2)).toBe(true);
    expect(mgr.isAlive(h3)).toBe(true);
    expect(mgr.stats.evicted).toBe(1);
    expect(log.filter((l) => l === 'dead:long')).toHaveLength(1);
    expect(mgr.pool.checkIntegrity()).toEqual([]);
  });

  it('kill is idempotent and stale handles never hit a reused slot', () => {
    const { mgr } = setup([longLived], { capacity: 2 });
    const h = mgr.spawn(0, 0, 0, 0);
    expect(mgr.kill(h)).toBe(true);
    expect(mgr.kill(h)).toBe(false);
    const h2 = mgr.spawn(0, 0, 0, 0);
    expect(mgr.pool.get(h)).toBeNull();
    expect(mgr.kill(h)).toBe(false);
    expect(mgr.isAlive(h2)).toBe(true);
  });

  it('clearAll empties the pool without dispatching hooks', () => {
    const { mgr, log } = setup([longLived], { capacity: 8 });
    const h = mgr.spawn(0, 0, 0, 0);
    mgr.spawn(0, 0, 0, 0);
    mgr.step();
    const before = log.length;
    mgr.clearAll();
    expect(mgr.liveCount).toBe(0);
    expect(mgr.pool.get(h)).toBeNull();
    expect(log.length).toBe(before);
    expect(mgr.pool.checkIntegrity()).toEqual([]);
  });
});

// ───────────────────────── 零洩漏 ─────────────────────────

describe('10,000 launches leak nothing', () => {
  it('spawn → step → recycle, 10,000 times, reusing a single record', () => {
    const { mgr } = setup([specOf('blip', { lifetime: { maxLifeTicks: 1, rangePx: null } })], {
      capacity: 64,
      hooks: null,
    });
    const before = Array.from({ length: 64 }, (_, i) => mgr.pool.at(i));
    for (let i = 0; i < 10_000; i++) {
      expect(mgr.spawn(0, 0, 0, i % 360)).not.toBe(NO_HANDLE);
      mgr.step();
    }
    expect(mgr.stats.spawned).toBe(10_000);
    expect(mgr.stats.died).toBe(10_000);
    expect(mgr.stats.rejected).toBe(0);
    expect(mgr.liveCount).toBe(0);
    expect(mgr.pool.at(0).generation).toBe(10_000);
    expect(mgr.pool.highWater).toBe(1);
    before.forEach((rt, i) => expect(mgr.pool.at(i)).toBe(rt));
    expect(mgr.pool.checkIntegrity()).toEqual([]);
  });

  it('random churn with mixed lifetimes: every record returns, none is replaced', () => {
    const specs = [1, 3, 6, 10].map((n) => specOf(`life${n}`, { lifetime: { maxLifeTicks: n, rangePx: null } }));
    const { mgr } = setup(specs, { capacity: 256, hooks: null });
    const before = Array.from({ length: 256 }, (_, i) => mgr.pool.at(i));
    const rnd = new Lcg(5);

    let launched = 0;
    while (launched < 10_000) {
      const n = rnd.nextInt(4);
      for (let k = 0; k < n && launched < 10_000; k++) {
        mgr.spawn(rnd.nextInt(4), 0, 0, rnd.nextRange(0, 360));
        launched++;
      }
      mgr.step();
    }
    stepN(mgr, 20);

    expect(mgr.stats.spawned).toBe(10_000);
    expect(mgr.stats.rejected).toBe(0);
    expect(mgr.stats.died).toBe(10_000);
    expect(mgr.liveCount).toBe(0);
    expect(before.reduce((s, r) => s + r.generation, 0)).toBe(10_000);
    before.forEach((rt, i) => expect(mgr.pool.at(i)).toBe(rt));
    expect(mgr.pool.checkIntegrity()).toEqual([]);
  });

  it('with explosions and child spawns the pool still drains completely', () => {
    const parent = specOf('parent', {
      lifetime: { maxLifeTicks: 3, rangePx: null },
      explosion: { durationTicks: 2, onHit: false, onExpire: true, spawnMissileId: 'kid' },
    });
    const kid = specOf('kid', { lifetime: { maxLifeTicks: 2, rangePx: null } });
    const { mgr } = setup([parent, kid], { capacity: 128, hooks: null });
    for (let i = 0; i < 2000; i++) {
      mgr.spawn(0, 0, 0, i % 360);
      mgr.step();
    }
    stepN(mgr, 20);
    expect(mgr.stats.spawned).toBe(4000);
    expect(mgr.liveCount).toBe(0);
    expect(mgr.pool.checkIntegrity()).toEqual([]);
  });
});

// ───────────────────────── 確定性回放 ─────────────────────────

describe('deterministic replay', () => {
  function runScenario(worldSeed: number): { trace: number[]; hits: number } {
    const charged: F04Params = { family: 'F04', stepJitterDeg: 40, retargetEveryTicks: 2 };
    const spirit: F02Params = {
      family: 'F02',
      turnRateDegPerTick: 8,
      acquireRadiusPx: 600,
      reacquire: true,
      fallback: 'straight',
    };
    const specs = [
      specOf('charged', {
        motion: { speed: 6, accel: 0, maxSpeed: 6 },
        lifetime: { maxLifeTicks: 40, rangePx: null },
        collision: { radiusPx: 10, pierce: 0 },
        behavior: charged,
      }),
      specOf('spirit', {
        motion: { speed: 6, accel: 0, maxSpeed: 6 },
        lifetime: { maxLifeTicks: 60, rangePx: null },
        collision: { radiusPx: 10, pierce: 0 },
        behavior: spirit,
      }),
      specOf('spear', {
        motion: { speed: 8, accel: 0, maxSpeed: 8 },
        lifetime: { maxLifeTicks: 30, rangePx: null },
        collision: { radiusPx: 10, pierce: UNLIMITED_PIERCE },
      }),
    ];
    const targets = new TargetRegistry();
    const units = Array.from({ length: 6 }, (_, i) => makeUnit(80 + i * 40, -100 + i * 60));
    units.forEach((u) => targets.createUnit(u));
    const mgr = new MissileManager({ specs, targets, worldSeed, capacity: 128 });

    const trace: number[] = [];
    for (let t = 0; t < 120; t++) {
      units.forEach((u, i) => {
        u.x += Math.cos(t * 0.1 + i);
        u.y += Math.sin(t * 0.13 + i);
      });
      if (t % 4 === 0) {
        mgr.spawn(0, 0, 0, (t * 37) % 360, 1);
        mgr.spawn(1, 0, 0, (t * 53) % 360, 1);
      }
      if (t % 7 === 0) mgr.spawn(2, 0, 0, (t * 11) % 360, 1);
      mgr.step();
      for (let i = 0; i < mgr.pool.highWater; i++) {
        const rt = mgr.pool.at(i);
        if (rt.state !== MissileState.DEAD) {
          trace.push(i, rt.state, rt.x, rt.y, rt.phi, rt.rngState, rt.hitCount, rt.targetId);
        }
      }
    }
    trace.push(mgr.stats.spawned, mgr.stats.hits, mgr.stats.died);
    return { trace, hits: mgr.stats.hits };
  }

  it('same world seed → bit-identical trajectories (F01 + F02 + F04 mixed, with collisions)', () => {
    const a = runScenario(7);
    const b = runScenario(7);
    expect(a.trace.length).toBeGreaterThan(1000);
    expect(a.hits).toBeGreaterThan(0);
    expect(a.trace).toEqual(b.trace);
  });

  it('a different world seed produces different zig-zag trajectories', () => {
    expect(runScenario(7).trace).not.toEqual(runScenario(8).trace);
  });

  it('per-missile seeds depend only on (worldSeed, spawn order)', () => {
    const spec = specOf('z', {
      behavior: { family: 'F04', stepJitterDeg: 30, retargetEveryTicks: 1 },
      lifetime: { maxLifeTicks: 50, rangePx: null },
    });
    const seeds = (): number[] => {
      const { mgr } = setup([spec], { worldSeed: 99, hooks: null });
      const hs = [mgr.spawn(0, 0, 0, 0), mgr.spawn(0, 0, 0, 0), mgr.spawn(0, 0, 0, 0)];
      return hs.map((h) => mgr.pool.get(h)!.rngState);
    };
    const s = seeds();
    expect(s).toEqual(seeds());
    expect(new Set(s).size).toBe(3);
  });
});

// ───────────────────────── 效能基準 ─────────────────────────

describe('benchmark: 200 concurrent missiles', () => {
  it('single-tick logic time (reports numbers; generous 4 ms median bound)', () => {
    const charged: F04Params = { family: 'F04', stepJitterDeg: 60, retargetEveryTicks: 2 };
    const spec = specOf('bolt', {
      motion: { speed: 4, accel: 0, maxSpeed: 4 },
      lifetime: { maxLifeTicks: 100_000, rangePx: null },
      collision: { radiusPx: 10, pierce: UNLIMITED_PIERCE },
      behavior: charged,
    });
    const targets = new TargetRegistry();
    const rnd = new Lcg(2024);
    for (let i = 0; i < 60; i++) {
      targets.createUnit(makeUnit(rnd.nextRange(-300, 300), rnd.nextRange(-300, 300)));
    }
    const mgr = new MissileManager({ specs: [spec], targets, capacity: 256, worldSeed: 3 });
    for (let i = 0; i < 200; i++) {
      mgr.spawn(0, rnd.nextRange(-200, 200), rnd.nextRange(-200, 200), rnd.nextRange(0, 360), 1);
    }
    expect(mgr.liveCount).toBe(200);

    for (let i = 0; i < 60; i++) mgr.step(); // 暖機

    const samples: number[] = [];
    for (let i = 0; i < 300; i++) {
      const t0 = performance.now();
      mgr.step();
      samples.push(performance.now() - t0);
    }
    expect(mgr.liveCount).toBe(200);

    const sorted = [...samples].sort((a, b) => a - b);
    const median = sorted[sorted.length >> 1]!;
    const p95 = sorted[Math.floor(sorted.length * 0.95)]!;
    const max = sorted[sorted.length - 1]!;
    const mean = samples.reduce((s, v) => s + v, 0) / samples.length;
    console.log(
      `[bench] 200 missiles × 60 targets, 300 ticks: mean=${mean.toFixed(3)}ms median=${median.toFixed(3)}ms ` +
        `p95=${p95.toFixed(3)}ms max=${max.toFixed(3)}ms hits=${mgr.stats.hits} (tick budget 40ms)`,
    );
    expect(median).toBeLessThan(4);
  });
});

describe('hit memory constant', () => {
  it('is a small fixed ring (documented limit for per-tick hits)', () => {
    expect(HIT_MEMORY).toBe(8);
  });
});

// 型別保險:MissileRuntime 的鉤子參數可直接餵給 pool.handleOf。
const _typeCheck = (m: MissileManager, rt: Readonly<MissileRuntime>): number => m.pool.handleOf(rt);
void _typeCheck;
void NO_TARGET;
