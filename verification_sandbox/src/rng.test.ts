import { describe, expect, it } from 'vitest';
import { Lcg, deriveSeed, lcgStep, lcgUnit, toSeed32 } from './rng.js';

/** 以 BigInt 實作的獨立參考,避免和被測程式碼共用同一套整數運算。 */
function reference(seed: number, n: number): number[] {
  let s = BigInt(seed >>> 0);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    s = (s * 1664525n + 1013904223n) % 4294967296n;
    out.push(Number(s));
  }
  return out;
}

describe('LCG determinism', () => {
  it('matches an independent BigInt reference for 1000 steps (several seeds)', () => {
    for (const seed of [0, 1, 42, 0xdeadbeef, 4294967295]) {
      const r = new Lcg(seed);
      const got = Array.from({ length: 1000 }, () => r.nextU32());
      expect(got).toEqual(reference(seed, 1000));
    }
  });

  it('known first values: seed 0 → c, seed 1 → a + c', () => {
    expect(new Lcg(0).nextU32()).toBe(1013904223);
    expect(new Lcg(1).nextU32()).toBe(1664525 + 1013904223);
  });

  it('same seed → identical sequence; different seeds → different sequences', () => {
    const a = new Lcg(2024);
    const b = new Lcg(2024);
    const c = new Lcg(2025);
    const sa = Array.from({ length: 200 }, () => a.next());
    const sb = Array.from({ length: 200 }, () => b.next());
    const sc = Array.from({ length: 200 }, () => c.next());
    expect(sa).toEqual(sb);
    expect(sa).not.toEqual(sc);
  });

  it('getState / setState replays the exact same continuation', () => {
    const r = new Lcg(7);
    for (let i = 0; i < 13; i++) r.next();
    const saved = r.state;
    const first = Array.from({ length: 5 }, () => r.next());
    r.setState(saved);
    const again = Array.from({ length: 5 }, () => r.next());
    expect(again).toEqual(first);
  });

  it('clone is independent of the original', () => {
    const r = new Lcg(99);
    const c = r.clone();
    const ahead = Array.from({ length: 10 }, () => r.next());
    const cloned = Array.from({ length: 10 }, () => c.next());
    expect(cloned).toEqual(ahead);
    r.next();
    expect(c.state).not.toBe(r.state);
  });

  it('pure helpers agree with the class', () => {
    const r = new Lcg(5);
    let s = toSeed32(5);
    for (let i = 0; i < 50; i++) {
      s = lcgStep(s);
      expect(r.next()).toBe(lcgUnit(s));
    }
  });
});

describe('seed normalisation', () => {
  it('truncates fractions and wraps negatives / large values modulo 2^32', () => {
    expect(new Lcg(-1).state).toBe(4294967295);
    expect(new Lcg(1.9).state).toBe(1);
    expect(new Lcg(4294967296 + 5).state).toBe(5);
    expect(Object.is(new Lcg(-0).state, 0)).toBe(true);
  });

  it('rejects non-finite seeds', () => {
    expect(() => new Lcg(NaN)).toThrow(RangeError);
    expect(() => new Lcg(Infinity)).toThrow(RangeError);
    expect(() => deriveSeed(NaN, 0)).toThrow(RangeError);
  });
});

describe('output ranges and distribution', () => {
  it('next() ∈ [0, 1), nextSigned() ∈ [-1, 1)', () => {
    const r = new Lcg(1);
    for (let i = 0; i < 50_000; i++) {
      const u = r.next();
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThan(1);
      const s = r.nextSigned();
      expect(s).toBeGreaterThanOrEqual(-1);
      expect(s).toBeLessThan(1);
    }
  });

  it('mean of 100k samples is ≈ 0.5', () => {
    const r = new Lcg(31337);
    let sum = 0;
    for (let i = 0; i < 100_000; i++) sum += r.next();
    expect(Math.abs(sum / 100_000 - 0.5)).toBeLessThan(0.01);
  });

  it('16 buckets are roughly uniform (±5%)', () => {
    const r = new Lcg(12345);
    const buckets = new Array<number>(16).fill(0);
    for (let i = 0; i < 160_000; i++) {
      const k = Math.floor(r.next() * 16);
      buckets[k] = (buckets[k] ?? 0) + 1;
    }
    for (const c of buckets) {
      expect(c).toBeGreaterThan(9500);
      expect(c).toBeLessThan(10500);
    }
  });

  it('nextInt stays in range, covers every value, and nextInt(1) is always 0', () => {
    const r = new Lcg(8);
    const seen = new Set<number>();
    for (let i = 0; i < 7000; i++) {
      const v = r.nextInt(7);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(7);
      seen.add(v);
    }
    expect(seen.size).toBe(7);
    for (let i = 0; i < 100; i++) expect(r.nextInt(1)).toBe(0);
  });

  it('nextRange stays within bounds; nextBool honours p = 0 and p = 1', () => {
    const r = new Lcg(3);
    for (let i = 0; i < 10_000; i++) {
      const v = r.nextRange(-3, 5);
      expect(v).toBeGreaterThanOrEqual(-3);
      expect(v).toBeLessThanOrEqual(5);
      expect(r.nextBool(0)).toBe(false);
      expect(r.nextBool(1)).toBe(true);
    }
  });

  it('rejects invalid arguments', () => {
    const r = new Lcg(1);
    expect(() => r.nextInt(0)).toThrow(RangeError);
    expect(() => r.nextInt(1.5)).toThrow(RangeError);
    expect(() => r.nextInt(2 ** 32 + 1)).toThrow(RangeError);
    expect(() => r.nextRange(2, 1)).toThrow(RangeError);
    expect(() => r.nextRange(NaN, 1)).toThrow(RangeError);
    expect(() => r.nextBool(1.1)).toThrow(RangeError);
    expect(() => r.nextBool(-0.1)).toThrow(RangeError);
  });
});

describe('deriveSeed', () => {
  it('is deterministic', () => {
    expect(deriveSeed(123, 7)).toBe(deriveSeed(123, 7));
  });

  it('gives 10,000 distinct seeds for consecutive streams', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 10_000; i++) seen.add(deriveSeed(2024, i));
    expect(seen.size).toBe(10_000);
  });

  it('streams from adjacent derived seeds are decorrelated (first outputs differ)', () => {
    const a = new Lcg(deriveSeed(1, 0)).next();
    const b = new Lcg(deriveSeed(1, 1)).next();
    expect(a).not.toBe(b);
  });

  it('output is a uint32', () => {
    for (let i = 0; i < 1000; i++) {
      const s = deriveSeed(i * 977, i);
      expect(Number.isInteger(s)).toBe(true);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThan(4294967296);
    }
  });
});
