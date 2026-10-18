// spiral.test.ts
import { describe, it, expect } from 'vitest';
import { SP, spiralInit, spiralStep, type SpiralParams, type SpiralOut } from './spiral.js';

const P: SpiralParams = { r0: 8, b: 6, speed: 4, rMax: 200, maxDTheta: 0.5, ySquash: 0.5 };

function run(ticks: number, dir: 1 | -1 = 1) {
  const s = new Float64Array(SP.SIZE);
  spiralInit(s, 0, 400, 300, 0, dir, P);
  const out: SpiralOut = { x: 0, y: 0, phi: 0, done: false };
  const pts: { x: number; y: number; r: number }[] = [];
  for (let i = 0; i < ticks; i++) {
    spiralStep(s, 0, P, out);
    pts.push({ x: out.x, y: out.y, r: s[SP.R]! });
  }
  return { pts, out };
}

describe('F03 阿基米德螺旋核心', () => {
  it('半徑單調遞增', () => {
    const { pts } = run(100);
    for (let i = 1; i < pts.length; i++) expect(pts[i]!.r).toBeGreaterThan(pts[i - 1]!.r);
  });

  it('地面圓經 2:1 投影：((x-cx)/r)² + ((y-cy)/(r·0.5))² = 1', () => {
    for (const p of run(80).pts) {
      const u = (p.x - 400) / p.r;
      const v = (p.y - 300) / (p.r * P.ySquash);
      expect(u * u + v * v).toBeCloseTo(1, 9);
    }
  });

  it('等弧長：地面空間相鄰兩點距離 ≈ speed（r 足夠大、未被 maxDTheta 限制時）', () => {
    const { pts } = run(120);
    for (let i = 60; i < 119; i++) {
      const gx = pts[i + 1]!.x - pts[i]!.x;
      const gy = (pts[i + 1]!.y - pts[i]!.y) / P.ySquash; // 還原到地面空間
      expect(Math.hypot(gx, gy)).toBeGreaterThan(P.speed * 0.85);
      expect(Math.hypot(gx, gy)).toBeLessThan(P.speed * 1.15);
    }
  });

  it('dir=-1 與 dir=1 以圓心鏡像（x 相同、y 對圓心反向）', () => {
    const a = run(30, 1).pts, b = run(30, -1).pts;
    for (let i = 0; i < 30; i++) {
      expect(b[i]!.x).toBeCloseTo(a[i]!.x, 9);
      expect(b[i]!.y - 300).toBeCloseTo(-(a[i]!.y - 300), 9);
    }
  });

  it('達到 rMax 時 done=true', () => {
    expect(run(5).out.done).toBe(false);
    expect(run(2000).out.done).toBe(true);
  });
});
