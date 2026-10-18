/**
 * manager.ts — MissileManager:一個 tick 的投射物邏輯推進
 *
 * 每次 step() 就是一個固定 40ms 的邏輯 tick(沒有 dt 參數,見交付說明)。
 *
 * 每筆記錄在一個 tick 內的處理順序:
 *   INIT(且生成於先前的 tick)→ 啟用(ACTIVATE 鉤子)→ 與 ACTIVE 相同處理
 *   ACTIVE:
 *     1. prev = curr,teleported = false(渲染插值用)
 *     2. 行為更新(轉向 + 移動)
 *     3. ageTicks++
 *     4. 碰撞:命中 → HIT 鉤子 → 穿透則繼續、否則 finish('hit')
 *     5. 到期:射程 → RANGE;lifetime 或行為要求 → LIFETIME → EXPIRE 鉤子 → finish('expire')
 *   EXPLODING:倒數,歸零後 DEAD
 *   finish:explodesOn(...) 為真 → EXPLODING(EXPLODE 鉤子、可選子投射物),否則 DEAD
 *
 * 鉤子可以安全地呼叫 spawn() / kill():每個處理步驟後都會檢查記錄是否仍是同一代、同一狀態。
 */

import {
  StepOutcome,
  clearBehaviorState,
  createBehaviorEnv,
  createDefaultBehaviors,
  type BehaviorEnv,
  type BehaviorImpl,
  type BehaviorRegistry,
} from './behaviors.js';
import { normalizeDeg } from './geometry.js';
import {
  ExpireReason,
  MissileEventKind,
  MissileState,
  canPierce,
  consumePierce,
  dispatchMissileEvent,
  explodesOn,
  validateMissileSpec,
  type MissileHooks,
  type MissileRuntime,
  type MissileSpec,
} from './missile-types.js';
import { MissileObjectPool, NO_HANDLE } from './pool.js';
import { deriveSeed } from './rng.js';
import { NO_TARGET, type TargetRegistry } from './targets.js';

export const NO_TEAM = -1;
/** 每顆投射物記住的最近命中目標數(也是單 tick 最大命中處理數)。 */
export const HIT_MEMORY = 8;

export type ExhaustionPolicy = 'reject' | 'evict-oldest';

export interface MissileManagerOptions {
  /** 規格表。建構後不可變;spawn 以索引(或 spawnById)引用。 */
  readonly specs: readonly MissileSpec[];
  readonly targets: TargetRegistry;
  /** 池容量,預設 512,上限 65536。 */
  readonly capacity?: number;
  /** 世界種子:每顆投射物的種子 = deriveSeed(worldSeed, 生成序號)。預設 1。 */
  readonly worldSeed?: number;
  readonly hooks?: MissileHooks | null;
  readonly behaviors?: BehaviorRegistry;
  readonly onExhausted?: ExhaustionPolicy;
}

export interface ManagerStats {
  spawned: number;
  rejected: number;
  evicted: number;
  hits: number;
  expired: number;
  exploded: number;
  died: number;
}

export class MissileManager {
  readonly pool: MissileObjectPool;
  readonly stats: ManagerStats = {
    spawned: 0,
    rejected: 0,
    evicted: 0,
    hits: 0,
    expired: 0,
    exploded: 0,
    died: 0,
  };
  /** 已執行的 step() 次數。 */
  tickCount = 0;

  public readonly specs: readonly MissileSpec[];
  private readonly specIndexById = new Map<string, number>();
  private readonly behaviors: BehaviorImpl[] = [];
  private readonly childIndex: Int32Array;
  private readonly env: BehaviorEnv;
  private readonly targets: TargetRegistry;
  private readonly hitTeam: Int16Array;
  private readonly hitMem: Int32Array;
  private readonly spawnTick: Float64Array;
  private readonly worldSeed: number;
  private readonly policy: ExhaustionPolicy;
  private hooks: MissileHooks | null;
  private spawnCounter = 0;

  constructor(opts: MissileManagerOptions) {
    const capacity = opts.capacity ?? 512;
    this.pool = new MissileObjectPool(capacity);
    this.targets = opts.targets;
    this.worldSeed = opts.worldSeed ?? 1;
    this.hooks = opts.hooks ?? null;
    this.policy = opts.onExhausted ?? 'reject';
    this.specs = [...opts.specs];

    const registry = opts.behaviors ?? createDefaultBehaviors();
    const n = this.specs.length;
    const errors: string[] = [];

    this.specs.forEach((s, i) => {
      for (const e of validateMissileSpec(s)) errors.push(`${s.id || `#${i}`}: ${e}`);
      if (this.specIndexById.has(s.id)) errors.push(`duplicate spec id: ${s.id}`);
      else this.specIndexById.set(s.id, i);
    });

    this.childIndex = new Int32Array(n).fill(-1);
    this.specs.forEach((s, i) => {
      const impl = registry.get(s.behavior.family);
      if (impl === undefined) errors.push(`${s.id}: no behavior registered for ${s.behavior.family}`);
      else this.behaviors.push(impl);

      const child = s.explosion?.spawnMissileId ?? null;
      if (child !== null) {
        const ci = this.specIndexById.get(child);
        if (ci === undefined) errors.push(`${s.id}: explosion.spawnMissileId "${child}" does not exist`);
        else this.childIndex[i] = ci;
      }
    });

    // 子投射物鏈每個節點最多一個後繼;走 n+1 步仍未結束就表示有循環。
    for (let i = 0; i < n; i++) {
      let cur = i;
      let k = 0;
      for (; k <= n; k++) {
        cur = this.childIndex[cur]!;
        if (cur < 0) break;
      }
      if (k > n) errors.push(`${this.specs[i]!.id}: spawn chain contains a cycle`);
    }

    if (errors.length > 0) throw new Error(`invalid missile specs:\n${errors.join('\n')}`);

    this.env = createBehaviorEnv(this.targets, capacity);
    this.hitTeam = new Int16Array(capacity).fill(NO_TEAM);
    this.hitMem = new Int32Array(capacity * HIT_MEMORY).fill(NO_TARGET);
    this.spawnTick = new Float64Array(capacity);
  }

  get liveCount(): number {
    return this.pool.liveCount;
  }

  setHooks(hooks: MissileHooks | null): void {
    this.hooks = hooks;
  }

  /** 規格 id → 索引,找不到回傳 -1。請在載入時查一次,熱路徑用索引。 */
  specIndexOf(id: string): number {
    return this.specIndexById.get(id) ?? -1;
  }

  specAt(index: number): MissileSpec {
    return this.specs[index]!;
  }

  // ───────────────────────── 生成與銷毀 ─────────────────────────

  /**
   * 生成投射物。
   * @param specIndex 規格索引
   * @param x,y       Ground 座標
   * @param phi       方向(度)
   * @param hitTeam   要攻擊的陣營;NO_TEAM(-1)= 不做碰撞
   * @param targetId  初始目標(NO_TARGET 則由行為自行索敵)
   * @returns handle;池滿且無法回收時回傳 NO_HANDLE
   */
  spawn(
    specIndex: number,
    x: number,
    y: number,
    phi: number,
    hitTeam: number = NO_TEAM,
    targetId: number = NO_TARGET,
  ): number {
    return this.spawnInternal(specIndex, x, y, phi, hitTeam, targetId, -1);
  }

  spawnById(
    id: string,
    x: number,
    y: number,
    phi: number,
    hitTeam: number = NO_TEAM,
    targetId: number = NO_TARGET,
  ): number {
    const idx = this.specIndexOf(id);
    if (idx < 0) throw new RangeError(`unknown missile spec id: ${id}`);
    return this.spawnInternal(idx, x, y, phi, hitTeam, targetId, -1);
  }

  /** 立即銷毀(會分派 DEAD 鉤子)。過期或已死亡的 handle 回傳 false。 */
  kill(handle: number): boolean {
    const rt = this.pool.get(handle);
    if (rt === null || rt.state === MissileState.DEAD) return false;
    this.terminate(rt);
    return true;
  }

  isAlive(handle: number): boolean {
    const rt = this.pool.get(handle);
    return rt !== null && rt.state !== MissileState.DEAD;
  }

  /** 清空所有投射物,不分派鉤子(換場景、從隱藏狀態恢復時使用)。 */
  clearAll(): void {
    this.pool.clear();
  }

  // ───────────────────────── 單 tick 推進 ─────────────────────────

  step(): void {
    this.tickCount++;
    const tick = this.tickCount;
    const pool = this.pool;
    const hw = pool.highWater;

    for (let i = 0; i < hw; i++) {
      const rt = pool.at(i);
      const st = rt.state;
      if (st === MissileState.DEAD) continue;
      if (st === MissileState.INIT) {
        // 本 tick 內才生成的(例如鉤子裡生成),留到下一個 tick 啟用,結果與槽位順序無關。
        if (this.spawnTick[i]! >= tick) continue;
        this.activate(rt);
        if (rt.state !== MissileState.ACTIVE) continue;
        this.stepActive(rt);
      } else if (st === MissileState.ACTIVE) {
        this.stepActive(rt);
      } else {
        this.stepExploding(rt);
      }
    }
  }

  // ───────────────────────── 內部實作 ─────────────────────────

  private spawnInternal(
    specIndex: number,
    x: number,
    y: number,
    phi: number,
    hitTeam: number,
    targetId: number,
    protectSlot: number,
  ): number {
    if (!Number.isInteger(specIndex) || specIndex < 0 || specIndex >= this.specs.length) {
      throw new RangeError(`specIndex out of range: ${specIndex}`);
    }
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(phi)) {
      throw new RangeError(`spawn position/direction must be finite, got (${x}, ${y}, ${phi})`);
    }
    if (!Number.isInteger(hitTeam) || hitTeam < -1 || hitTeam > 32767) {
      throw new RangeError(`hitTeam must be an integer in [-1, 32767], got ${hitTeam}`);
    }
    if (!Number.isInteger(targetId)) throw new RangeError(`targetId must be an integer, got ${targetId}`);

    let rt = this.pool.acquire();
    if (rt === null && this.policy === 'evict-oldest' && this.evictOne(protectSlot)) {
      rt = this.pool.acquire();
    }
    if (rt === null) {
      this.stats.rejected++;
      return NO_HANDLE;
    }

    const spec = this.specs[specIndex]!;
    const slot = rt.handle;
    rt.specIndex = specIndex;
    rt.ageTicks = 0;
    rt.x = x;
    rt.y = y;
    rt.prevX = x;
    rt.prevY = y;
    rt.phi = normalizeDeg(phi);
    rt.speed = spec.motion.speed;
    rt.travelled = 0;
    rt.pierceLeft = spec.collision.pierce;
    rt.hitCount = 0;
    rt.targetId = targetId;
    rt.rngState = deriveSeed(this.worldSeed, this.spawnCounter++);
    rt.explodeTicksLeft = 0;
    rt.teleported = true; // 生成不插值

    this.hitTeam[slot] = hitTeam;
    this.hitMem.fill(NO_TARGET, slot * HIT_MEMORY, (slot + 1) * HIT_MEMORY);
    this.spawnTick[slot] = this.tickCount;
    clearBehaviorState(this.env, slot);
    this.env.team = hitTeam;
    this.behaviors[specIndex]!.init(rt, spec, this.env);

    this.stats.spawned++;
    dispatchMissileEvent(this.hooks, MissileEventKind.SPAWN, rt, spec);
    return this.pool.handleOf(rt);
  }

  private activate(rt: MissileRuntime): void {
    rt.state = MissileState.ACTIVE;
    dispatchMissileEvent(this.hooks, MissileEventKind.ACTIVATE, rt, this.specs[rt.specIndex]!);
  }

  private stepActive(rt: MissileRuntime): void {
    const spec = this.specs[rt.specIndex]!;
    const team = this.hitTeam[rt.handle]!;

    rt.prevX = rt.x;
    rt.prevY = rt.y;
    rt.teleported = false;

    this.env.team = team;
    const outcome = this.behaviors[rt.specIndex]!.update(rt, spec, this.env);
    rt.ageTicks++;

    if (team >= 0 && this.resolveHits(rt, spec, team)) return;

    if (outcome === StepOutcome.RANGE) {
      this.expire(rt, spec, ExpireReason.RANGE);
    } else if (outcome === StepOutcome.EXPIRE || rt.ageTicks >= spec.lifetime.maxLifeTicks) {
      this.expire(rt, spec, ExpireReason.LIFETIME);
    }
  }

  /** 處理本 tick 的所有命中。回傳 true 表示該記錄已不再是 ACTIVE(轉換、死亡或被鉤子改動)。 */
  private resolveHits(rt: MissileRuntime, spec: MissileSpec, team: number): boolean {
    const gen = rt.generation;
    const base = rt.handle * HIT_MEMORY;
    for (let n = 0; n < HIT_MEMORY; n++) {
      const known = rt.hitCount < HIT_MEMORY ? rt.hitCount : HIT_MEMORY;
      const id = this.targets.findNearestUnitSkipping(
        rt.x,
        rt.y,
        spec.collision.radiusPx,
        team,
        this.hitMem,
        base,
        known,
      );
      if (id === NO_TARGET) return false;

      this.hitMem[base + (rt.hitCount % HIT_MEMORY)] = id;
      rt.hitCount++;
      this.stats.hits++;
      dispatchMissileEvent(this.hooks, MissileEventKind.HIT, rt, spec, id);
      if (rt.generation !== gen || rt.state !== MissileState.ACTIVE) return true;

      if (canPierce(rt.pierceLeft)) {
        rt.pierceLeft = consumePierce(rt.pierceLeft);
        continue;
      }
      this.finish(rt, spec, 'hit');
      return true;
    }
    return false;
  }

  private expire(rt: MissileRuntime, spec: MissileSpec, reason: ExpireReason): void {
    const gen = rt.generation;
    this.stats.expired++;
    dispatchMissileEvent(this.hooks, MissileEventKind.EXPIRE, rt, spec, reason);
    if (rt.generation !== gen || rt.state !== MissileState.ACTIVE) return;
    this.finish(rt, spec, 'expire');
  }

  private finish(rt: MissileRuntime, spec: MissileSpec, trigger: 'hit' | 'expire'): void {
    if (explodesOn(spec, trigger)) this.beginExplosion(rt, spec);
    else this.terminate(rt);
  }

  private beginExplosion(rt: MissileRuntime, spec: MissileSpec): void {
    const x = spec.explosion;
    if (x === null) {
      this.terminate(rt);
      return;
    }
    const gen = rt.generation;
    const slot = rt.handle;

    rt.state = MissileState.EXPLODING;
    rt.explodeTicksLeft = x.durationTicks;
    rt.speed = 0;
    this.stats.exploded++;
    dispatchMissileEvent(this.hooks, MissileEventKind.EXPLODE, rt, spec);
    if (rt.generation !== gen || rt.state !== MissileState.EXPLODING) return;

    const child = this.childIndex[rt.specIndex]!;
    if (child >= 0) {
      this.spawnInternal(child, rt.x, rt.y, rt.phi, this.hitTeam[slot]!, NO_TARGET, slot);
      if (rt.generation !== gen || rt.state !== MissileState.EXPLODING) return;
    }
    if (x.durationTicks === 0) this.terminate(rt);
  }

  private stepExploding(rt: MissileRuntime): void {
    rt.prevX = rt.x;
    rt.prevY = rt.y;
    rt.teleported = false;
    rt.ageTicks++;
    rt.explodeTicksLeft--;
    if (rt.explodeTicksLeft <= 0) this.terminate(rt);
  }

  /** 標為 DEAD → DEAD 鉤子(此時資料仍完整)→ 放回池。 */
  private terminate(rt: MissileRuntime): void {
    const spec = this.specs[rt.specIndex]!;
    rt.state = MissileState.DEAD;
    this.stats.died++;
    dispatchMissileEvent(this.hooks, MissileEventKind.DEAD, rt, spec);
    this.pool.releaseRecord(rt);
  }

  /** 池滿時回收一筆:優先 EXPLODING 中最接近結束的,否則存活最久的。同分取較小槽位。 */
  private evictOne(protectSlot: number): boolean {
    const pool = this.pool;
    let victim: MissileRuntime | null = null;
    let best = -1;
    for (let i = 0; i < pool.highWater; i++) {
      const rt = pool.at(i);
      if (rt.state === MissileState.DEAD || i === protectSlot) continue;
      const score = rt.state === MissileState.EXPLODING ? 1e9 - rt.explodeTicksLeft : rt.ageTicks;
      if (score > best) {
        best = score;
        victim = rt;
      }
    }
    if (victim === null) return false;
    this.stats.evicted++;
    this.terminate(victim);
    return true;
  }
}
