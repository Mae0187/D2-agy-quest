/**
 * rng.ts — 可重現的種子偽隨機數產生器(線性同餘 LCG)
 *
 *   state' = (state × 1664525 + 1013904223) mod 2^32      (Numerical Recipes 常數)
 *
 * 用途:彈道軌跡(充能彈折線、散射)的確定性回放。同一個種子、同一個呼叫序列,
 * 在任何環境都產生逐位元相同的結果。
 *
 * 注意:
 *  - 2^k 模數 LCG 的低位元週期很短,切勿用 `nextU32() % n`。請用 nextInt()。
 *  - 不適合密碼學,也不適合需要高品質統計性質的場合。
 *  - 物件池若要把狀態存進 Uint32Array,直接使用 lcgStep() / lcgUnit(),不必持有 Lcg 實例。
 */

const LCG_A = 1664525;
const LCG_C = 1013904223;
const TWO32 = 4294967296;

/** 任意有限數 → uint32 種子(截斷小數,負數與大數以 2^32 為模)。 */
export function toSeed32(seed: number): number {
  if (!Number.isFinite(seed)) {
    throw new RangeError(`seed must be a finite number, got ${seed}`);
  }
  return Math.trunc(seed) >>> 0;
}

/** 純函式:推進一步,回傳新狀態(uint32)。零配置。 */
export function lcgStep(state: number): number {
  return (Math.imul(state, LCG_A) + LCG_C) >>> 0;
}

/** 純函式:uint32 狀態 → [0, 1)。 */
export function lcgUnit(state: number): number {
  return state / TWO32;
}

/**
 * 由基礎種子與串流編號衍生獨立種子(murmur3 finalizer 混合)。
 * 對固定的 base,stream 在 uint32 範圍內是一對一映射,不會碰撞。
 * 用途:每顆投射物 seed = deriveSeed(worldSeed, spawnCounter)。
 */
export function deriveSeed(base: number, stream: number): number {
  let h = (toSeed32(base) + Math.imul(toSeed32(stream), 0x9e3779b1)) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

export class Lcg {
  private s: number;

  constructor(seed: number) {
    this.s = toSeed32(seed);
  }

  /** 目前內部狀態(uint32),可存檔後以 setState() 還原。 */
  get state(): number {
    return this.s;
  }

  setState(state: number): void {
    this.s = toSeed32(state);
  }

  clone(): Lcg {
    return new Lcg(this.s);
  }

  /** 下一個 uint32 原始狀態。僅供需要原始位元的場合使用。 */
  nextU32(): number {
    this.s = lcgStep(this.s);
    return this.s;
  }

  /** [0, 1)。 */
  next(): number {
    return lcgUnit(this.nextU32());
  }

  /** [-1, 1)。 */
  nextSigned(): number {
    return this.next() * 2 - 1;
  }

  /** 整數 ∈ [0, maxExclusive)。maxExclusive 必須是 1 ~ 2^32 的整數。 */
  nextInt(maxExclusive: number): number {
    if (!Number.isInteger(maxExclusive) || maxExclusive < 1 || maxExclusive > TWO32) {
      throw new RangeError(`maxExclusive must be an integer in [1, 2^32], got ${maxExclusive}`);
    }
    return Math.floor(this.next() * maxExclusive);
  }

  /** 實數 ∈ [min, max)。 */
  nextRange(min: number, max: number): number {
    if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) {
      throw new RangeError(`invalid range [${min}, ${max})`);
    }
    return min + this.next() * (max - min);
  }

  /** 以機率 p(預設 0.5)回傳 true。p=0 恆 false,p=1 恆 true。 */
  nextBool(p = 0.5): boolean {
    if (!(p >= 0 && p <= 1)) throw new RangeError(`p must be in [0, 1], got ${p}`);
    return this.next() < p;
  }
}
