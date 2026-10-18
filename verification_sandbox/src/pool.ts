/**
 * pool.ts — 投射物物件池(預先配置 + free-list + generation handle)
 *
 * 設計:
 *  - 建構時一次配置 capacity 筆 MissileRuntime,之後永不新增、永不丟棄。
 *  - free-list 以 Int32Array 串成鏈(LIFO):acquire/release 都是 O(1),零配置。
 *  - handle = generation × 65536 + 槽位索引,純數字(不配置物件)。
 *    釋放時 resetMissileRuntime 會遞增 generation,所以舊 handle 立刻失效;
 *    即使槽位被重用,舊 handle 也不會指到新的投射物。
 *  - 迭代請用 `for (i = 0; i < highWater; i++) at(i)`:highWater 是曾經使用過的最大槽位 + 1,
 *    不會隨釋放而縮小,迴圈成本與「峰值併發」而非 capacity 成正比。
 *
 * 限制:
 *  - capacity ≤ 65536(索引占 16 位)。
 *  - generation 為 uint32,同一槽位重用 2^32 次後 handle 會重複,實務上不可能發生。
 *  - 本類別不分派事件鉤子。需要鉤子請透過 MissileManager.kill()。
 */

import {
  MissileState,
  createMissileRuntime,
  resetMissileRuntime,
  type MissileRuntime,
} from './missile-types.js';

export const NO_HANDLE = -1;
export const POOL_INDEX_RADIX = 65536;
export const MAX_POOL_CAPACITY = POOL_INDEX_RADIX;

export class MissileObjectPool {
  readonly capacity: number;

  private readonly records: MissileRuntime[];
  private readonly nextFree: Int32Array;
  private readonly live: Uint8Array;
  private freeHead = 0;
  private liveN = 0;
  private hw = 0;
  private peak = 0;
  private exhausted = 0;
  private acquired = 0;
  private released = 0;

  constructor(capacity: number) {
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > MAX_POOL_CAPACITY) {
      throw new RangeError(`capacity must be an integer in [1, ${MAX_POOL_CAPACITY}], got ${capacity}`);
    }
    this.capacity = capacity;
    this.records = Array.from({ length: capacity }, (_, i) => createMissileRuntime(i));
    this.nextFree = new Int32Array(capacity);
    this.live = new Uint8Array(capacity);
    this.rebuildFreeList();
  }

  get liveCount(): number {
    return this.liveN;
  }
  get freeCount(): number {
    return this.capacity - this.liveN;
  }
  /** 曾使用過的最大槽位 + 1。迭代上限。 */
  get highWater(): number {
    return this.hw;
  }
  get peakLive(): number {
    return this.peak;
  }
  /** acquire() 因池已滿而失敗的累計次數。 */
  get exhaustedCount(): number {
    return this.exhausted;
  }
  get acquiredTotal(): number {
    return this.acquired;
  }
  get releasedTotal(): number {
    return this.released;
  }

  /**
   * 取出一筆空閒記錄,狀態設為 INIT,其餘欄位為乾淨預設值。
   * 池已滿回傳 null 並累計 exhaustedCount。
   */
  acquire(): MissileRuntime | null {
    if (this.freeHead === -1) {
      this.exhausted++;
      return null;
    }
    const idx = this.freeHead;
    this.freeHead = this.nextFree[idx]!;
    this.nextFree[idx] = -1;
    this.live[idx] = 1;
    this.liveN++;
    this.acquired++;
    if (this.liveN > this.peak) this.peak = this.liveN;
    if (idx + 1 > this.hw) this.hw = idx + 1;
    const rt = this.records[idx]!;
    rt.state = MissileState.INIT;
    return rt;
  }

  /** 記錄 → handle。只對仍存活的記錄有意義。 */
  handleOf(rt: MissileRuntime): number {
    return rt.generation * POOL_INDEX_RADIX + rt.handle;
  }

  /** handle → 記錄。過期、已釋放、格式錯誤一律回傳 null。 */
  get(handle: number): MissileRuntime | null {
    if (!Number.isInteger(handle) || handle < 0) return null;
    const idx = handle % POOL_INDEX_RADIX;
    if (idx >= this.capacity || this.live[idx] === 0) return null;
    const rt = this.records[idx]!;
    return rt.generation * POOL_INDEX_RADIX + idx === handle ? rt : null;
  }

  isValid(handle: number): boolean {
    return this.get(handle) !== null;
  }

  /** 依索引取記錄(迭代用,不檢查範圍;請用 0 ≤ i < highWater)。可能是 DEAD 狀態的空閒槽位。 */
  at(index: number): MissileRuntime {
    return this.records[index]!;
  }

  /** 以 handle 釋放。過期或重複釋放回傳 false。 */
  release(handle: number): boolean {
    const rt = this.get(handle);
    return rt === null ? false : this.releaseRecord(rt);
  }

  /** 以記錄釋放:重置所有欄位、遞增 generation、放回 free-list 頭。重複釋放回傳 false。 */
  releaseRecord(rt: MissileRuntime): boolean {
    const idx = rt.handle;
    if (idx < 0 || idx >= this.capacity || this.records[idx] !== rt || this.live[idx] === 0) {
      return false;
    }
    resetMissileRuntime(rt);
    this.live[idx] = 0;
    this.nextFree[idx] = this.freeHead;
    this.freeHead = idx;
    this.liveN--;
    this.released++;
    return true;
  }

  /** 釋放全部存活記錄並重建 free-list。計數器保留。 */
  clear(): void {
    for (let i = 0; i < this.hw; i++) {
      if (this.live[i] === 1) {
        resetMissileRuntime(this.records[i]!);
        this.released++;
      }
    }
    this.liveN = 0;
    this.live.fill(0);
    this.rebuildFreeList();
  }

  /** 診斷用(會配置記憶體,請勿放在熱路徑)。回傳空陣列代表結構完整。 */
  checkIntegrity(): string[] {
    const errors: string[] = [];
    const cap = this.capacity;
    const seen = new Uint8Array(cap);
    let n = 0;
    let cur = this.freeHead;
    while (cur !== -1) {
      if (cur < 0 || cur >= cap) {
        errors.push(`free list index out of range: ${cur}`);
        break;
      }
      if (seen[cur]) {
        errors.push(`free list cycle or duplicate at slot ${cur}`);
        break;
      }
      seen[cur] = 1;
      n++;
      if (this.live[cur] === 1) errors.push(`live slot ${cur} is in the free list`);
      if (this.records[cur]!.state !== MissileState.DEAD) errors.push(`free slot ${cur} is not DEAD`);
      cur = this.nextFree[cur]!;
    }
    if (n !== cap - this.liveN) errors.push(`free list length ${n} != capacity - live (${cap - this.liveN})`);
    let flags = 0;
    for (let i = 0; i < cap; i++) if (this.live[i] === 1) flags++;
    if (flags !== this.liveN) errors.push(`live flags ${flags} != liveCount ${this.liveN}`);
    return errors;
  }

  private rebuildFreeList(): void {
    const cap = this.capacity;
    for (let i = 0; i < cap - 1; i++) this.nextFree[i] = i + 1;
    this.nextFree[cap - 1] = -1;
    this.freeHead = 0;
  }
}
