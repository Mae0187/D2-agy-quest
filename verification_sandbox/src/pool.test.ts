import { describe, expect, it } from 'vitest';
import { MissileState } from './missile-types.js';
import { MAX_POOL_CAPACITY, MissileObjectPool, NO_HANDLE } from './pool.js';
import { Lcg } from './rng.js';

describe('construction', () => {
  it.each([0, -1, 1.5, NaN, MAX_POOL_CAPACITY + 1])('rejects capacity %f', (cap) => {
    expect(() => new MissileObjectPool(cap)).toThrow(RangeError);
  });

  it('starts empty, fully free and structurally sound', () => {
    const p = new MissileObjectPool(8);
    expect(p.capacity).toBe(8);
    expect(p.liveCount).toBe(0);
    expect(p.freeCount).toBe(8);
    expect(p.highWater).toBe(0);
    expect(p.checkIntegrity()).toEqual([]);
    for (let i = 0; i < 8; i++) {
      expect(p.at(i).state).toBe(MissileState.DEAD);
      expect(p.at(i).handle).toBe(i);
    }
  });
});

describe('acquire / release', () => {
  it('hands out INIT records in ascending slot order at first', () => {
    const p = new MissileObjectPool(4);
    for (let i = 0; i < 3; i++) {
      const rt = p.acquire()!;
      expect(rt.handle).toBe(i);
      expect(rt.state).toBe(MissileState.INIT);
    }
    expect(p.liveCount).toBe(3);
    expect(p.highWater).toBe(3);
  });

  it('handle round-trips to the same record', () => {
    const p = new MissileObjectPool(4);
    const rt = p.acquire()!;
    const h = p.handleOf(rt);
    expect(p.get(h)).toBe(rt);
    expect(p.isValid(h)).toBe(true);
  });

  it('stale handles are rejected after release, even when the slot is reused', () => {
    const p = new MissileObjectPool(2);
    const rt = p.acquire()!;
    const h1 = p.handleOf(rt);
    expect(p.release(h1)).toBe(true);

    expect(p.get(h1)).toBeNull();
    expect(p.isValid(h1)).toBe(false);
    expect(p.release(h1)).toBe(false); // 重複釋放

    const rt2 = p.acquire()!;
    expect(rt2).toBe(rt); // LIFO:同一個槽位、同一個物件
    const h2 = p.handleOf(rt2);
    expect(h2).not.toBe(h1);
    expect(p.get(h1)).toBeNull();
    expect(p.get(h2)).toBe(rt2);
    expect(p.checkIntegrity()).toEqual([]);
  });

  it('released records are fully reset and DEAD', () => {
    const p = new MissileObjectPool(2);
    const rt = p.acquire()!;
    rt.x = 5;
    rt.ageTicks = 9;
    rt.hitCount = 3;
    p.releaseRecord(rt);
    expect(rt.state).toBe(MissileState.DEAD);
    expect(rt.x).toBe(0);
    expect(rt.ageTicks).toBe(0);
    expect(rt.hitCount).toBe(0);
    expect(p.releaseRecord(rt)).toBe(false);
  });

  it('garbage handles never resolve', () => {
    const p = new MissileObjectPool(4);
    p.acquire();
    for (const h of [NO_HANDLE, NaN, Infinity, 1.5, -7, 1e15, 65536 * 3 + 100]) {
      expect(p.get(h)).toBeNull();
    }
  });

  it('highWater never shrinks on release', () => {
    const p = new MissileObjectPool(8);
    const rts = [p.acquire()!, p.acquire()!, p.acquire()!];
    rts.forEach((r) => p.releaseRecord(r));
    expect(p.highWater).toBe(3);
    expect(p.peakLive).toBe(3);
  });
});

describe('capacity protection', () => {
  it('returns null when exhausted, counts it, and recovers after a release', () => {
    const p = new MissileObjectPool(3);
    const rts = [p.acquire()!, p.acquire()!, p.acquire()!];
    expect(p.acquire()).toBeNull();
    expect(p.acquire()).toBeNull();
    expect(p.exhaustedCount).toBe(2);
    expect(p.liveCount).toBe(3);

    p.releaseRecord(rts[1]!);
    const again = p.acquire();
    expect(again).toBe(rts[1]);
    expect(p.checkIntegrity()).toEqual([]);
  });
});

describe('zero-leak under churn', () => {
  it('10,000 consecutive acquire/release cycles reuse one record and leak nothing', () => {
    const p = new MissileObjectPool(16);
    const before = Array.from({ length: 16 }, (_, i) => p.at(i));
    for (let i = 0; i < 10_000; i++) {
      const rt = p.acquire()!;
      expect(rt.handle).toBe(0);
      expect(p.releaseRecord(rt)).toBe(true);
    }
    expect(p.liveCount).toBe(0);
    expect(p.acquiredTotal).toBe(10_000);
    expect(p.releasedTotal).toBe(10_000);
    expect(p.at(0).generation).toBe(10_000); // 每次釋放恰好 +1
    expect(p.highWater).toBe(1);
    before.forEach((rt, i) => expect(p.at(i)).toBe(rt));
    expect(p.checkIntegrity()).toEqual([]);
  });

  it('random churn (seeded): free list stays intact, record objects never replaced', () => {
    const cap = 64;
    const p = new MissileObjectPool(cap);
    const before = Array.from({ length: cap }, (_, i) => p.at(i));
    const rnd = new Lcg(42);
    const live: number[] = [];

    for (let i = 0; i < 10_000; i++) {
      if (live.length < cap && (live.length === 0 || rnd.next() < 0.55)) {
        const rt = p.acquire();
        expect(rt).not.toBeNull();
        live.push(p.handleOf(rt!));
      } else {
        const k = rnd.nextInt(live.length);
        const h = live[k]!;
        live[k] = live[live.length - 1]!;
        live.pop();
        expect(p.release(h)).toBe(true);
        expect(p.release(h)).toBe(false);
      }
      if (i % 1000 === 0) expect(p.checkIntegrity()).toEqual([]);
    }
    expect(p.liveCount).toBe(live.length);
    for (const h of live) expect(p.release(h)).toBe(true);

    expect(p.liveCount).toBe(0);
    expect(p.freeCount).toBe(cap);
    expect(p.acquiredTotal).toBe(p.releasedTotal);
    expect(p.checkIntegrity()).toEqual([]);
    before.forEach((rt, i) => expect(p.at(i)).toBe(rt));
    expect(before.reduce((s, r) => s + r.generation, 0)).toBe(p.releasedTotal);
  });
});

describe('clear', () => {
  it('releases everything, invalidates old handles and rebuilds the free list', () => {
    const p = new MissileObjectPool(5);
    const hs = [p.acquire()!, p.acquire()!, p.acquire()!].map((r) => p.handleOf(r));
    p.clear();
    expect(p.liveCount).toBe(0);
    expect(p.freeCount).toBe(5);
    for (const h of hs) expect(p.get(h)).toBeNull();
    expect(p.checkIntegrity()).toEqual([]);
    const rts = Array.from({ length: 5 }, () => p.acquire());
    expect(rts.every((r) => r !== null)).toBe(true);
    expect(p.acquire()).toBeNull();
  });
});
