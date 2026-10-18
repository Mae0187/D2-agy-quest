import { describe, expect, it } from 'vitest';
import {
  RAD2DEG,
  angularDistance,
  normalizeDeg,
  phiToScreenVelocity,
  phiToScreenVelocityInto,
  screenToPhi,
} from './geometry.js';

const ANGLES_72 = Array.from({ length: 72 }, (_, i) => i * 5); // 0, 5, ..., 355

/** 錯誤公式:直接用螢幕像素做 atan2(dy, dx),只用於對照測試。 */
function wrongPhi(dx: number, dy: number): number {
  return normalizeDeg(Math.atan2(dy, dx) * RAD2DEG);
}

describe('normalizeDeg', () => {
  it.each([
    [0, 0],
    [360, 0],
    [-360, 0],
    [725, 5],
    [-5, 355],
    [-725, 355],
    [359.5, 359.5],
  ])('normalizeDeg(%f) = %f', (input, expected) => {
    expect(normalizeDeg(input)).toBeCloseTo(expected, 12);
  });

  it('never returns -0 or 360', () => {
    expect(Object.is(normalizeDeg(-0), 0)).toBe(true);
    expect(Object.is(normalizeDeg(-360), 0)).toBe(true);
    for (const v of [-1e-300, -1e-14, -1e-17, 359.99999999999994]) {
      const r = normalizeDeg(v);
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThan(360);
    }
  });

  it('throws on non-finite input', () => {
    expect(() => normalizeDeg(NaN)).toThrow(RangeError);
    expect(() => normalizeDeg(Infinity)).toThrow(RangeError);
  });
});

describe('angularDistance', () => {
  it('takes the shortest way around the circle', () => {
    expect(angularDistance(359, 1)).toBeCloseTo(2, 12);
    expect(angularDistance(1, 359)).toBeCloseTo(2, 12);
    expect(angularDistance(0, 180)).toBeCloseTo(180, 12);
    expect(angularDistance(90, 90)).toBe(0);
  });
});

describe('screenToPhi', () => {
  it('maps the four screen axes (Y down => clockwise)', () => {
    expect(screenToPhi(1, 0)).toBeCloseTo(0, 9);
    expect(screenToPhi(0, 1)).toBeCloseTo(90, 9); // 螢幕正下方
    expect(screenToPhi(-1, 0)).toBeCloseTo(180, 9);
    expect(screenToPhi(0, -1)).toBeCloseTo(270, 9); // 螢幕正上方
  });

  it('maps the 2:1 iso diagonals to exact 45° multiples', () => {
    // 螢幕向量 (2, 1) 等距視角下正好是地面 45° 方向
    expect(screenToPhi(2, 1)).toBeCloseTo(45, 9);
    expect(screenToPhi(-2, 1)).toBeCloseTo(135, 9);
    expect(screenToPhi(-2, -1)).toBeCloseTo(225, 9);
    expect(screenToPhi(2, -1)).toBeCloseTo(315, 9);
  });

  it('applies the Y ×2 un-squash (not plain atan2)', () => {
    expect(screenToPhi(1, 1)).toBeCloseTo(Math.atan2(2, 1) * RAD2DEG, 9);
    expect(screenToPhi(1, 1)).not.toBeCloseTo(45, 1);
  });

  it('is scale invariant', () => {
    expect(screenToPhi(3, 2)).toBeCloseTo(screenToPhi(300, 200), 9);
  });

  it('zero vector returns 0 and always lands in [0, 360)', () => {
    expect(screenToPhi(0, 0)).toBe(0);
    for (const [dx, dy] of [[-1, -0], [1, -0], [-0, -1], [1e-300, -1e-300], [-5, 0]] as const) {
      const p = screenToPhi(dx, dy);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThan(360);
    }
  });

  it('throws on non-finite input', () => {
    expect(() => screenToPhi(NaN, 0)).toThrow(RangeError);
    expect(() => screenToPhi(0, Infinity)).toThrow(RangeError);
  });
});

describe('round trip: φ -> screen velocity -> φ (72 angles, every 5°)', () => {
  it.each(ANGLES_72)('φ = %i°', (phi) => {
    const { vx, vy } = phiToScreenVelocity(phi, 7.3);
    const back = screenToPhi(vx, vy);
    expect(angularDistance(back, phi)).toBeLessThan(1e-9);
  });

  it('covers exactly 72 angles from 0° to 355°', () => {
    expect(ANGLES_72).toHaveLength(72);
    expect(ANGLES_72[0]).toBe(0);
    expect(ANGLES_72[71]).toBe(355);
  });
});

describe('speed fidelity', () => {
  it.each(ANGLES_72)('φ = %i°: ground speed preserved, vy/vx = 0.5·tanφ', (phi) => {
    const speed = 12;
    const { vx, vy } = phiToScreenVelocity(phi, speed);

    // 還原地面速度向量(Y×2)後長度應等於 speed
    expect(Math.hypot(vx, vy * 2)).toBeCloseTo(speed, 9);

    // 螢幕斜率 = 0.5 · tanφ(避開 cosφ≈0 的垂直方向)
    if (Math.abs(Math.cos((phi * Math.PI) / 180)) > 1e-6) {
      const tan = Math.tan((phi * Math.PI) / 180);
      expect(vy / vx).toBeCloseTo(0.5 * tan, 9);
    }
  });

  it('pure vertical motion is compressed to half speed', () => {
    const down = phiToScreenVelocity(90, 10);
    expect(down.vx).toBeCloseTo(0, 9);
    expect(down.vy).toBeCloseTo(5, 9); // 向下為正
    const up = phiToScreenVelocity(270, 10);
    expect(up.vy).toBeCloseTo(-5, 9);
  });

  it('pure horizontal motion is not compressed', () => {
    const right = phiToScreenVelocity(0, 10);
    expect(right.vx).toBeCloseTo(10, 9);
    expect(right.vy).toBeCloseTo(0, 9);
  });

  it('negative speed reverses direction', () => {
    const f = phiToScreenVelocity(30, 5);
    const b = phiToScreenVelocity(30, -5);
    expect(b.vx).toBeCloseTo(-f.vx, 12);
    expect(b.vy).toBeCloseTo(-f.vy, 12);
  });

  it('Into-variant writes into and returns the supplied object (zero allocation)', () => {
    const out = { vx: 0, vy: 0 };
    const ret = phiToScreenVelocityInto(60, 8, out);
    expect(ret).toBe(out);
    const ref = phiToScreenVelocity(60, 8);
    expect(out.vx).toBe(ref.vx);
    expect(out.vy).toBe(ref.vy);
  });

  it('throws on non-finite input', () => {
    expect(() => phiToScreenVelocity(NaN, 1)).toThrow(RangeError);
    expect(() => phiToScreenVelocity(0, Infinity)).toThrow(RangeError);
  });
});

describe('contrast: why atan2(dy, dx) is wrong', () => {
  // 設地面角 φ 的螢幕向量為 (cosφ, 0.5·sinφ);錯誤公式直接 atan2(dy, dx)。
  // 令 t = tanφ,誤差 e 滿足 tan(e) = t / (2 + t²),在 t = √2 取最大值 1/(2√2)。
  const ANALYTIC_MAX_DEG = Math.atan(1 / (2 * Math.SQRT2)) * RAD2DEG; // ≈ 19.4712°

  it('analytic maximum is ≈ 19.47° (i.e. ≤ 19.5°)', () => {
    expect(ANALYTIC_MAX_DEG).toBeGreaterThan(19.47);
    expect(ANALYTIC_MAX_DEG).toBeLessThan(19.5);
  });

  it('numerical sweep (0.001° resolution) matches the analytic maximum', () => {
    let maxErr = 0;
    let argMax = 0;
    for (let i = 0; i < 360_000; i++) {
      const phi = i / 1000;
      const { vx, vy } = phiToScreenVelocity(phi, 1);
      const err = angularDistance(wrongPhi(vx, vy), phi);
      if (err > maxErr) {
        maxErr = err;
        argMax = phi;
      }
    }
    expect(maxErr).toBeGreaterThan(19.47);
    expect(maxErr).toBeLessThanOrEqual(19.5);
    expect(maxErr).toBeCloseTo(ANALYTIC_MAX_DEG, 2);

    // 最大誤差出現在 tanφ = √2 ⇒ φ ≈ 54.7356° 及其對稱位置
    const expectedArg = Math.atan(Math.SQRT2) * RAD2DEG;
    const candidates = [expectedArg, 180 - expectedArg, 180 + expectedArg, 360 - expectedArg];
    expect(Math.min(...candidates.map((c) => angularDistance(argMax, c)))).toBeLessThan(0.01);
  });

  it('wrong formula is exact only on the four axes', () => {
    for (const phi of [0, 90, 180, 270]) {
      const { vx, vy } = phiToScreenVelocity(phi, 1);
      expect(angularDistance(wrongPhi(vx, vy), phi)).toBeLessThan(1e-9);
    }
    const { vx, vy } = phiToScreenVelocity(45, 1);
    expect(angularDistance(wrongPhi(vx, vy), 45)).toBeGreaterThan(10);
  });

  it('the correct formula has zero error everywhere (sweep every 0.5°)', () => {
    for (let phi = 0; phi < 360; phi += 0.5) {
      const { vx, vy } = phiToScreenVelocity(phi, 1);
      expect(angularDistance(screenToPhi(vx, vy), phi)).toBeLessThan(1e-9);
    }
  });
});
