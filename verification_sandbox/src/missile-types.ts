/**
 * missile-types.ts — 投射物生命週期、屬性規格、執行期記錄與事件鉤子的型別
 *
 * 單位約定:
 *  - 所有速度、加速度、距離、半徑都是 Ground(地面未壓縮)像素 / tick 系列。
 *  - φ 為度,與 geometry.ts 一致。
 *  - 螢幕 Y × 0.5 只發生在繪製前最後一步。
 *
 * 分層:
 *  - MissileSpec:不可變的資料(來自 Manifest / Missiles.txt 的映射),可被大量投射物共用。
 *  - MissileRuntime:每顆投射物的可變狀態,由物件池(3-B)預先配置並重複使用。
 */

import { isBlendMode, type BlendMode } from './blend.js';
import { NO_TARGET } from './targets.js';

// ───────────────────────── 家族 ID ─────────────────────────

export const FAMILY_IDS = [
  'F01', 'F02', 'F03', 'F04', 'F05', 'F06', 'F07', 'F08', 'F09', 'F10',
  'F11', 'F12', 'F13', 'F14', 'F15', 'F16', 'F17', 'F18', 'F19', 'F20',
] as const;
export type FamilyId = (typeof FAMILY_IDS)[number];

// ───────────────────────── 生命週期 ─────────────────────────

/**
 * INIT      已配置,尚未開始運動(施法錨點對齊、延遲生成)。
 * ACTIVE    飛行中,參與運動與碰撞。
 * EXPLODING 命中或到期後播放爆裂動畫,不再運動與碰撞。
 * DEAD      已回收。池中的空閒槽位也是 DEAD。
 */
export const MissileState = {
  INIT: 0,
  ACTIVE: 1,
  EXPLODING: 2,
  DEAD: 3,
} as const;
export type MissileState = (typeof MissileState)[keyof typeof MissileState];

const STATE_NAMES: readonly string[] = ['INIT', 'ACTIVE', 'EXPLODING', 'DEAD'];

export function stateName(state: MissileState): string {
  return STATE_NAMES[state] ?? 'UNKNOWN';
}

// 允許的轉移,以位元遮罩表示:ALLOWED[from] 的第 `to` 位為 1 即合法。
const ALLOWED: readonly number[] = [
  (1 << MissileState.ACTIVE) | (1 << MissileState.DEAD), // INIT
  (1 << MissileState.EXPLODING) | (1 << MissileState.DEAD), // ACTIVE
  1 << MissileState.DEAD, // EXPLODING
  0, // DEAD:只能由物件池 reset 重新配置,不屬於狀態轉移
];

export function canTransition(from: MissileState, to: MissileState): boolean {
  return (((ALLOWED[from] ?? 0) >> to) & 1) === 1;
}

// ───────────────────────── 穿透 ─────────────────────────

/** pierce 欄位的特殊值:無限穿透(骨矛之類)。JSON 無法存 Infinity,所以用 -1。 */
export const UNLIMITED_PIERCE = -1;

/** 命中後還能否穿過(true = 繼續飛;false = 停止並進入爆裂或回收)。 */
export function canPierce(pierceLeft: number): boolean {
  return pierceLeft !== 0;
}

/** 穿過一個目標後的剩餘穿透數。無限穿透保持不變;0 保持 0。 */
export function consumePierce(pierceLeft: number): number {
  if (pierceLeft === UNLIMITED_PIERCE) return UNLIMITED_PIERCE;
  return pierceLeft > 0 ? pierceLeft - 1 : 0;
}

// ───────────────────────── 規格(不可變資料) ─────────────────────────

export interface MissileMotion {
  /** 初速,≥ 0。 */
  readonly speed: number;
  /** 每 tick 速度增量(可為負)。 */
  readonly accel: number;
  /** 速度上限,≥ speed。減速型投射物令其等於 speed。 */
  readonly maxSpeed: number;
}

export interface MissileLifetime {
  /** 存活 tick 上限(整數 ≥ 1)。永遠必填,保證任何投射物都有界。 */
  readonly maxLifeTicks: number;
  /** 最大飛行距離(Ground px)。null = 不以距離限制。 */
  readonly rangePx: number | null;
}

export interface MissileCollision {
  /** 碰撞圓半徑(Ground px),≥ 0。 */
  readonly radiusPx: number;
  /** 可穿過的目標數(整數 ≥ 0),或 UNLIMITED_PIERCE。0 = 命中第一個就停。 */
  readonly pierce: number;
}

export interface MissileExplosion {
  /** 爆裂動畫持續 tick(整數 ≥ 0)。0 = 立即回收。 */
  readonly durationTicks: number;
  readonly onHit: boolean;
  readonly onExpire: boolean;
  /** 爆裂時再生成的投射物(如冰封球子彈)。null = 不生成。 */
  readonly spawnMissileId: string | null;
}

// 各家族專屬參數(第 1.2 節家族表中屬於 F01/F02/F04 的部分)。
export interface F01Params {
  readonly family: 'F01';
}

export interface F02Params {
  readonly family: 'F02';
  /** 每 tick 最大轉向角(度),> 0。 */
  readonly turnRateDegPerTick: number;
  /** 索敵半徑(Ground px),≥ 0。 */
  readonly acquireRadiusPx: number;
  /** 目標失效後是否重新索敵。 */
  readonly reacquire: boolean;
  /** 沒有目標時:沿當前方向直飛,或直接到期。 */
  readonly fallback: 'straight' | 'expire';
}

export interface F04Params {
  readonly family: 'F04';
  /** 每次轉向的隨機擾動幅度(度),[0, 180]。 */
  readonly stepJitterDeg: number;
  /** 每隔幾個 tick 重新擾動一次,整數 ≥ 1。 */
  readonly retargetEveryTicks: number;
}

export type BehaviorParams = F01Params | F02Params | F04Params;

export interface MissileSpec {
  /** Missiles.txt 的名稱。 */
  readonly id: string;
  /** 對應 DirectionCalibration.missileId。 */
  readonly calibrationId: string;
  readonly blend: BlendMode;
  readonly motion: MissileMotion;
  readonly lifetime: MissileLifetime;
  readonly collision: MissileCollision;
  /** null = 沒有爆裂階段,命中或到期後直接 DEAD。 */
  readonly explosion: MissileExplosion | null;
  readonly behavior: BehaviorParams;
}

/** 檢查數值域,回傳錯誤清單(空 = 通過)。原始 JSON 的結構驗證由 Schema 負責。 */
export function validateMissileSpec(spec: MissileSpec): readonly string[] {
  const e: string[] = [];
  const fin = Number.isFinite;

  if (spec.id.length === 0) e.push('id must be non-empty');
  if (spec.calibrationId.length === 0) e.push('calibrationId must be non-empty');
  if (!isBlendMode(spec.blend)) e.push(`blend is not a known BlendMode: ${String(spec.blend)}`);

  const m = spec.motion;
  if (!(fin(m.speed) && m.speed >= 0)) e.push('motion.speed must be a finite number >= 0');
  if (!fin(m.accel)) e.push('motion.accel must be finite');
  if (!(fin(m.maxSpeed) && m.maxSpeed >= m.speed)) e.push('motion.maxSpeed must be finite and >= motion.speed');

  const l = spec.lifetime;
  if (!(Number.isInteger(l.maxLifeTicks) && l.maxLifeTicks >= 1)) {
    e.push('lifetime.maxLifeTicks must be an integer >= 1');
  }
  if (l.rangePx !== null && !(fin(l.rangePx) && l.rangePx > 0)) {
    e.push('lifetime.rangePx must be null or a finite number > 0');
  }

  const c = spec.collision;
  if (!(fin(c.radiusPx) && c.radiusPx >= 0)) e.push('collision.radiusPx must be a finite number >= 0');
  if (!(Number.isInteger(c.pierce) && (c.pierce >= 0 || c.pierce === UNLIMITED_PIERCE))) {
    e.push('collision.pierce must be an integer >= 0 or UNLIMITED_PIERCE (-1)');
  }

  if (spec.explosion !== null) {
    const x = spec.explosion;
    if (!(Number.isInteger(x.durationTicks) && x.durationTicks >= 0)) {
      e.push('explosion.durationTicks must be an integer >= 0');
    }
    if (x.spawnMissileId !== null && x.spawnMissileId.length === 0) {
      e.push('explosion.spawnMissileId must be null or non-empty');
    }
  }

  const b = spec.behavior;
  switch (b.family) {
    case 'F01':
      break;
    case 'F02':
      if (!(fin(b.turnRateDegPerTick) && b.turnRateDegPerTick > 0)) {
        e.push('behavior.turnRateDegPerTick must be a finite number > 0');
      }
      if (!(fin(b.acquireRadiusPx) && b.acquireRadiusPx >= 0)) {
        e.push('behavior.acquireRadiusPx must be a finite number >= 0');
      }
      if (b.fallback !== 'straight' && b.fallback !== 'expire') {
        e.push("behavior.fallback must be 'straight' or 'expire'");
      }
      break;
    case 'F04':
      if (!(fin(b.stepJitterDeg) && b.stepJitterDeg >= 0 && b.stepJitterDeg <= 180)) {
        e.push('behavior.stepJitterDeg must be in [0, 180]');
      }
      if (!(Number.isInteger(b.retargetEveryTicks) && b.retargetEveryTicks >= 1)) {
        e.push('behavior.retargetEveryTicks must be an integer >= 1');
      }
      break;
    default:
      e.push(`behavior.family unsupported: ${String((b as { family: unknown }).family)}`);
  }
  return e;
}

// ───────────────────────── 執行期記錄(可變,由物件池持有) ─────────────────────────

export interface MissileRuntime {
  state: MissileState;
  /** 池中的固定槽位編號。 */
  readonly handle: number;
  /** 每次重新配置遞增,用來偵測過期的 handle。 */
  generation: number;
  /** 指向規格表的索引,避免在記錄中持有物件引用。 */
  specIndex: number;
  ageTicks: number;

  // Ground 座標。prevX/prevY 是上一個 tick 的位置,給渲染插值使用。
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  /** 前進方向 φ(度,[0, 360))。 */
  phi: number;
  /** 目前速度(Ground px/tick)。 */
  speed: number;
  /** 累計飛行距離(Ground px)。 */
  travelled: number;

  pierceLeft: number;
  hitCount: number;
  targetId: number;
  /** 本顆投射物自己的 LCG 狀態(uint32),可直接用 lcgStep / lcgUnit 推進。 */
  rngState: number;

  explodeTicksLeft: number;
  /** 動畫整數累加器(speed 累加至 256 進一幀)與當前幀。 */
  animAcc: number;
  animFrame: number;

  /** true = 本 tick 的 prev 已被設為 curr,渲染不得插值(生成、瞬移)。 */
  teleported: boolean;
}

/** 建立一個 DEAD 狀態的空記錄。物件池啟動時預先配置用。 */
export function createMissileRuntime(handle: number): MissileRuntime {
  return {
    state: MissileState.DEAD,
    handle,
    generation: 0,
    specIndex: -1,
    ageTicks: 0,
    x: 0,
    y: 0,
    prevX: 0,
    prevY: 0,
    phi: 0,
    speed: 0,
    travelled: 0,
    pierceLeft: 0,
    hitCount: 0,
    targetId: NO_TARGET,
    rngState: 0,
    explodeTicksLeft: 0,
    animAcc: 0,
    animFrame: 0,
    teleported: false,
  };
}

/** 回收或重新配置前重置所有欄位。保留 handle、遞增 generation。零配置。 */
export function resetMissileRuntime(rt: MissileRuntime): void {
  rt.state = MissileState.DEAD;
  rt.generation = (rt.generation + 1) >>> 0;
  rt.specIndex = -1;
  rt.ageTicks = 0;
  rt.x = 0;
  rt.y = 0;
  rt.prevX = 0;
  rt.prevY = 0;
  rt.phi = 0;
  rt.speed = 0;
  rt.travelled = 0;
  rt.pierceLeft = 0;
  rt.hitCount = 0;
  rt.targetId = NO_TARGET;
  rt.rngState = 0;
  rt.explodeTicksLeft = 0;
  rt.animAcc = 0;
  rt.animFrame = 0;
  rt.teleported = false;
}

// ───────────────────────── 事件鉤子 ─────────────────────────

export const MissileEventKind = {
  SPAWN: 0,
  ACTIVATE: 1,
  HIT: 2,
  EXPIRE: 3,
  EXPLODE: 4,
  DEAD: 5,
} as const;
export type MissileEventKind = (typeof MissileEventKind)[keyof typeof MissileEventKind];

export const ExpireReason = {
  LIFETIME: 0,
  RANGE: 1,
} as const;
export type ExpireReason = (typeof ExpireReason)[keyof typeof ExpireReason];

/**
 * 所有鉤子都直接傳入既有的 runtime 與 spec(不配置事件物件)。
 * 鉤子內不得保存 rt 的引用,它會被池重用。需要保留請複製所需欄位。
 */
export interface MissileHooks {
  onSpawn?(rt: Readonly<MissileRuntime>, spec: MissileSpec): void;
  onActivate?(rt: Readonly<MissileRuntime>, spec: MissileSpec): void;
  onHit?(rt: Readonly<MissileRuntime>, spec: MissileSpec, targetId: number): void;
  onExpire?(rt: Readonly<MissileRuntime>, spec: MissileSpec, reason: ExpireReason): void;
  onExplode?(rt: Readonly<MissileRuntime>, spec: MissileSpec): void;
  onDead?(rt: Readonly<MissileRuntime>, spec: MissileSpec): void;
}

/**
 * 分派事件。aux 的意義:HIT = targetId,EXPIRE = ExpireReason,其餘忽略。
 * hooks 為 null 時為空操作。
 */
export function dispatchMissileEvent(
  hooks: MissileHooks | null,
  kind: MissileEventKind,
  rt: Readonly<MissileRuntime>,
  spec: MissileSpec,
  aux: number = NO_TARGET,
): void {
  if (hooks === null) return;
  switch (kind) {
    case MissileEventKind.SPAWN:
      hooks.onSpawn?.(rt, spec);
      break;
    case MissileEventKind.ACTIVATE:
      hooks.onActivate?.(rt, spec);
      break;
    case MissileEventKind.HIT:
      hooks.onHit?.(rt, spec, aux);
      break;
    case MissileEventKind.EXPIRE:
      hooks.onExpire?.(rt, spec, aux as ExpireReason);
      break;
    case MissileEventKind.EXPLODE:
      hooks.onExplode?.(rt, spec);
      break;
    case MissileEventKind.DEAD:
      hooks.onDead?.(rt, spec);
      break;
  }
}

// ───────────────────────── 爆裂判定 ─────────────────────────

/** 依規格判斷該觸發原因是否進入 EXPLODING(否則直接 DEAD)。 */
export function explodesOn(spec: MissileSpec, trigger: 'hit' | 'expire'): boolean {
  const x = spec.explosion;
  if (x === null) return false;
  return trigger === 'hit' ? x.onHit : x.onExpire;
}
