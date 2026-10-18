/**
 * behaviors.ts — 行為原語:F01 直線、F02 追蹤、F04 隨機折線
 *
 * 單位:全部是 Ground(地面未壓縮)像素 / tick,角度為度。
 * 螢幕 Y × 0.5 只在繪製端做,本檔完全不碰。
 *
 * 一個 tick 內,行為負責「轉向 + 移動」:
 *   速度 v' = clamp(v + accel, 0, maxSpeed),位置 += v'·(cosφ, sinφ)
 * 先更新速度再移動。生命週期、命中、爆裂由 MissileManager 負責。
 *
 * 擴充新家族:實作 BehaviorImpl、擴充 BehaviorParams 與 validateMissileSpec,再 register()。
 */

import type { FamilyId, MissileRuntime, MissileSpec } from './missile-types.js';
import { DEG2RAD, normalizeDeg } from './geometry.js';
import { lcgStep, lcgUnit } from './rng.js';
import { NO_TARGET, groundToPhi, type GroundPoint, type TargetRegistry } from './targets.js';

/** 每個槽位保留的行為私有浮點數個數。擴充至 8 以容納螺旋與進階行為。 */
export const STATE_STRIDE = 8;

export const StepOutcome = {
  /** 本 tick 正常移動。 */
  CONTINUE: 0,
  /** 本 tick 到達射程上限(位置已夾在射程終點)。 */
  RANGE: 1,
  /** 行為要求立刻到期(如追蹤彈失去目標且 fallback = 'expire')。 */
  EXPIRE: 2,
} as const;
export type StepOutcome = (typeof StepOutcome)[keyof typeof StepOutcome];

/** 行為執行期環境:由管理器持有,熱路徑重複使用,不配置。 */
export interface BehaviorEnv {
  readonly targets: TargetRegistry;
  /** 目前被處理的投射物所要攻擊的陣營(-1 = 無)。由管理器在每次呼叫前設定。 */
  team: number;
  /** 行為私有狀態:state[slot × STATE_STRIDE + k],生成時清零。 */
  readonly state: Float64Array;
  /** 暫存座標,供 resolve() 使用。 */
  readonly scratch: GroundPoint;
}

export function createBehaviorEnv(targets: TargetRegistry, slotCount: number): BehaviorEnv {
  return {
    targets,
    team: -1,
    state: new Float64Array(slotCount * STATE_STRIDE),
    scratch: { x: 0, y: 0 },
  };
}

export function clearBehaviorState(env: BehaviorEnv, slot: number): void {
  env.state.fill(0, slot * STATE_STRIDE, (slot + 1) * STATE_STRIDE);
}

export interface BehaviorImpl {
  readonly family: FamilyId;
  /** 生成時呼叫一次(rt 的位置、方向、速度、種子、targetId 已設好)。 */
  init(rt: MissileRuntime, spec: MissileSpec, env: BehaviorEnv): void;
  /** 每 tick 一次:轉向並移動。不得配置物件。 */
  update(rt: MissileRuntime, spec: MissileSpec, env: BehaviorEnv): StepOutcome;
}

// ───────────────────────── 共用:直線推進 ─────────────────────────

/**
 * 沿 rt.phi 推進一個 tick。
 *  - 速度:v' = clamp(v + accel, 0, maxSpeed)
 *  - 射程:rangePx 非 null 時,若本步會達到或超過射程,步長夾到剛好抵達,回傳 RANGE
 *    (不會超出射程終點;travelled 精確等於 rangePx)
 */
export function advanceLinear(rt: MissileRuntime, spec: MissileSpec): StepOutcome {
  const m = spec.motion;
  let v = rt.speed + m.accel;
  if (v > m.maxSpeed) v = m.maxSpeed;
  if (v < 0) v = 0;
  rt.speed = v;

  let step = v;
  let outcome: StepOutcome = StepOutcome.CONTINUE;
  const range = spec.lifetime.rangePx;
  if (range !== null) {
    const remaining = range - rt.travelled;
    if (step >= remaining) {
      step = remaining > 0 ? remaining : 0;
      outcome = StepOutcome.RANGE;
    }
  }

  const rad = rt.phi * DEG2RAD;
  rt.x += step * Math.cos(rad);
  rt.y += step * Math.sin(rad);
  rt.travelled = outcome === StepOutcome.RANGE && range !== null ? range : rt.travelled + step;
  return outcome;
}

function mismatch(expected: FamilyId, spec: MissileSpec): Error {
  return new Error(`behavior ${expected} used with spec "${spec.id}" of family ${spec.behavior.family}`);
}

// ───────────────────────── F01:直線 ─────────────────────────

export const F01_STRAIGHT: BehaviorImpl = {
  family: 'F01',
  init(): void {
    /* 無私有狀態 */
  },
  update(rt, spec): StepOutcome {
    return advanceLinear(rt, spec);
  },
};

// ───────────────────────── F02:追蹤 ─────────────────────────

/**
 * 每 tick 向目標轉向,每 tick 轉角上限 = turnRateDegPerTick(走最短弧)。
 *  - 生成時若 rt.targetId 有效就沿用,否則在 acquireRadiusPx 內找最近的敵方單位。
 *  - 目標失效後:reacquire = true 則重新索敵;找不到(或 reacquire = false)則依 fallback:
 *      'straight' → 沿當前方向直飛
 *      'expire'   → 本 tick 不移動,回傳 EXPIRE
 */
export const F02_HOMING: BehaviorImpl = {
  family: 'F02',

  init(rt, spec, env): void {
    const p = spec.behavior;
    if (p.family !== 'F02') throw mismatch('F02', spec);
    if (rt.targetId !== NO_TARGET && env.targets.resolve(rt.targetId, env.scratch)) return;
    rt.targetId = env.targets.findNearestUnit(rt.x, rt.y, p.acquireRadiusPx, env.team);
  },

  update(rt, spec, env): StepOutcome {
    const p = spec.behavior;
    if (p.family !== 'F02') throw mismatch('F02', spec);
    const sc = env.scratch;

    let have = false;
    if (rt.targetId !== NO_TARGET) {
      have = env.targets.resolve(rt.targetId, sc);
      if (!have) rt.targetId = NO_TARGET;
    }
    if (!have && p.reacquire) {
      rt.targetId = env.targets.findNearestUnit(rt.x, rt.y, p.acquireRadiusPx, env.team);
      if (rt.targetId !== NO_TARGET) {
        have = env.targets.resolve(rt.targetId, sc);
        if (!have) rt.targetId = NO_TARGET;
      }
    }

    if (have) {
      const dx = sc.x - rt.x;
      const dy = sc.y - rt.y;
      if (dx !== 0 || dy !== 0) {
        let d = normalizeDeg(groundToPhi(dx, dy) - rt.phi);
        if (d > 180) d -= 360; // 最短弧,範圍 (-180, 180]
        const lim = p.turnRateDegPerTick;
        if (d > lim) d = lim;
        else if (d < -lim) d = -lim;
        rt.phi = normalizeDeg(rt.phi + d);
      }
    } else if (p.fallback === 'expire') {
      return StepOutcome.EXPIRE;
    }
    return advanceLinear(rt, spec);
  },
};

// ───────────────────────── F04:隨機折線 ─────────────────────────

/**
 * 每隔 retargetEveryTicks 個 tick(以 ageTicks % N === 0 判定,所以第一個 tick 就會折一次),
 * 方向 = 基準方向 + U(−jitter, +jitter)。其餘 tick 直飛。
 *  - 基準方向:生成時的 phi;若 rt.targetId 有效,每次折線前改為朝向該目標的方位。
 *  - 隨機:用 rt.rngState 與 lcgStep/lcgUnit 推進,每次折線消耗恰好一個亂數。
 */
export const F04_ZIGZAG: BehaviorImpl = {
  family: 'F04',

  init(rt, spec, env): void {
    if (spec.behavior.family !== 'F04') throw mismatch('F04', spec);
    env.state[rt.handle * STATE_STRIDE] = rt.phi;
  },

  update(rt, spec, env): StepOutcome {
    const p = spec.behavior;
    if (p.family !== 'F04') throw mismatch('F04', spec);

    if (rt.ageTicks % p.retargetEveryTicks === 0) {
      const base = rt.handle * STATE_STRIDE;
      if (rt.targetId !== NO_TARGET) {
        if (env.targets.resolve(rt.targetId, env.scratch)) {
          const dx = env.scratch.x - rt.x;
          const dy = env.scratch.y - rt.y;
          if (dx !== 0 || dy !== 0) env.state[base] = groundToPhi(dx, dy);
        } else {
          rt.targetId = NO_TARGET;
        }
      }
      rt.rngState = lcgStep(rt.rngState);
      const jitter = (lcgUnit(rt.rngState) * 2 - 1) * p.stepJitterDeg;
      rt.phi = normalizeDeg(env.state[base]! + jitter);
    }
    return advanceLinear(rt, spec);
  },
};

// ───────────────────────── 註冊表 ─────────────────────────

export class BehaviorRegistry {
  private readonly map = new Map<FamilyId, BehaviorImpl>();

  register(impl: BehaviorImpl): this {
    if (this.map.has(impl.family)) throw new Error(`behavior already registered: ${impl.family}`);
    this.map.set(impl.family, impl);
    return this;
  }

  get(family: FamilyId): BehaviorImpl | undefined {
    return this.map.get(family);
  }

  has(family: FamilyId): boolean {
    return this.map.has(family);
  }
}

export function createDefaultBehaviors(): BehaviorRegistry {
  return new BehaviorRegistry().register(F01_STRAIGHT).register(F02_HOMING).register(F04_ZIGZAG);
}
