import { describe, expect, it } from 'vitest';
import {
  analyzeFrame,
  calibrateBatch,
  calibrateFromAnalyses,
  calibrateMissile,
  confirmManually,
  fitDirections,
  flipHead,
  reportToJson,
  reportToMarkdown,
  type AlphaImageLike,
  type CalibrationResult,
  type FrameAnalysis,
  type MissileFrames,
} from './calibrate.js';
import { dirIndex, validateCalibration, type DirCount } from './direction.js';
import { DEG2RAD, angularDistance, normalizeDeg } from './geometry.js';

// ───────────────────────── 合成素材產生器 ─────────────────────────

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rnd: () => number): number {
  return Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
}

/**
 * 箭矢(地面空間定義,沿 +t 前進):
 *   尾部羽翼(寬)→ 箭桿(細)→ 箭頭(三角,尖端窄)
 * 質量集中在尾端,偏態指向箭尖。reversed=true 則左右鏡射(前進端變成寬的一端)。
 */
interface ArrowSpec {
  length: number;
  tailLen: number;
  tailHalfW: number;
  shaftHalfW: number;
  headLen: number;
  headHalfW: number;
  reversed: boolean;
}
const ARROW: ArrowSpec = {
  length: 40,
  tailLen: 12,
  tailHalfW: 4,
  shaftHalfW: 1,
  headLen: 8,
  headHalfW: 3,
  reversed: false,
};

function inArrow(t0: number, w: number, spec: ArrowSpec): boolean {
  const t = spec.reversed ? -t0 : t0;
  const L2 = spec.length / 2;
  if (t < -L2 || t > L2) return false;
  let half: number;
  if (t < -L2 + spec.tailLen) half = spec.tailHalfW;
  else if (t < L2 - spec.headLen) half = spec.shaftHalfW;
  else half = (spec.headHalfW * (L2 - t)) / spec.headLen;
  return Math.abs(w) <= half;
}

/** 在螢幕上畫出地面方向 φ 的箭矢:地面點 (gx, gy) ↔ 螢幕點 (gx, gy/2)。3×3 超取樣抗鋸齒。 */
function renderArrow(
  phiDeg: number,
  size: number,
  cx: number,
  cy: number,
  spec: ArrowSpec = ARROW,
  ss = 3,
): AlphaImageLike {
  const c = Math.cos(phiDeg * DEG2RAD);
  const s = Math.sin(phiDeg * DEG2RAD);
  const alpha = new Uint8Array(size * size);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let hit = 0;
      for (let j = 0; j < ss; j++) {
        for (let i = 0; i < ss; i++) {
          const gx = px + (i + 0.5) / ss - cx;
          const gy = (py + (j + 0.5) / ss - cy) * 2;
          const t = gx * c + gy * s;
          const w = -gx * s + gy * c;
          if (inArrow(t, w, spec)) hit++;
        }
      }
      alpha[py * size + px] = Math.round((255 * hit) / (ss * ss));
    }
  }
  return { width: size, height: size, alpha };
}

/** 螢幕空間的橢圓(rx, ry);glow=true 時 alpha 由中心向外線性衰減。 */
function renderEllipse(rx: number, ry: number, size: number, glow = false, ss = 3): AlphaImageLike {
  const alpha = new Uint8Array(size * size);
  const cx = size / 2;
  const cy = size / 2;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let acc = 0;
      for (let j = 0; j < ss; j++) {
        for (let i = 0; i < ss; i++) {
          const x = (px + (i + 0.5) / ss - cx) / rx;
          const y = (py + (j + 0.5) / ss - cy) / ry;
          const r2 = x * x + y * y;
          if (r2 <= 1) acc += glow ? 1 - Math.sqrt(r2) : 1;
        }
      }
      alpha[py * size + px] = Math.round((255 * acc) / (ss * ss));
    }
  }
  return { width: size, height: size, alpha };
}

function addNoise(img: AlphaImageLike, sigma: number, rnd: () => number): AlphaImageLike {
  const out = new Uint8Array(img.alpha.length);
  for (let k = 0; k < out.length; k++) {
    const v = img.alpha[k]! + gaussian(rnd) * sigma;
    out[k] = Math.round(Math.min(255, Math.max(0, v)));
  }
  return { width: img.width, height: img.height, alpha: out };
}

interface RowSetOpts {
  size?: number;
  jitter?: number;
  noiseSigma?: number;
  rnd?: () => number;
  spec?: ArrowSpec;
}

/** 依已知 (dirCount, dir0, clockwise) 產生各方向行:φ_i = dir0 ± i·step。 */
function makeArrowRows(
  dirCount: DirCount,
  dir0: number,
  clockwise: boolean,
  o: RowSetOpts = {},
): AlphaImageLike[] {
  const size = o.size ?? 64;
  const rnd = o.rnd ?? (() => 0.5);
  const jitter = o.jitter ?? 0;
  const step = 360 / dirCount;
  const sgn = clockwise ? 1 : -1;
  const rows: AlphaImageLike[] = [];
  for (let i = 0; i < dirCount; i++) {
    const phi = normalizeDeg(dir0 + sgn * i * step);
    const jx = (rnd() * 2 - 1) * jitter;
    const jy = (rnd() * 2 - 1) * jitter;
    let img = renderArrow(phi, size, size / 2 + jx, size / 2 + jy, o.spec ?? ARROW);
    if (o.noiseSigma !== undefined) img = addNoise(img, o.noiseSigma, rnd);
    rows.push(img);
  }
  return rows;
}

function meta(id: string, dirCount: DirCount) {
  return { missileId: id, celFile: `${id}.dcc`, dirCount } as const;
}

function expectCorrect(r: CalibrationResult, dir0: number, cw: boolean, tolDeg: number): void {
  expect(r.calibration.clockwise).toBe(cw);
  expect(angularDistance(r.calibration.dir0WorldAngle, dir0)).toBeLessThan(tolDeg);
}

const COMBOS = ([8, 16, 32] as const).flatMap((n) =>
  [true, false].flatMap((cw) => [0, 160, 33.3].map((d0) => ({ n, cw, d0 }))),
);

// ───────────────────────── 單幀分析 ─────────────────────────

describe('analyzeFrame on synthetic arrows (every 5°)', () => {
  const ANGLES = Array.from({ length: 72 }, (_, i) => i * 5);

  it.each(ANGLES)('φ = %i°: axis within 1.5°, skew points to the tip, elongated', (phi) => {
    const a = analyzeFrame(renderArrow(phi, 64, 32.3, 31.7));
    expect(a.valid).toBe(true);
    expect(angularDistance(a.axisPhiDeg * 2, normalizeDeg(phi) * 2)).toBeLessThan(3); // 軸向(模 180)
    expect(a.eccScreen).toBeGreaterThan(1.3);
    expect(a.eccGround).toBeGreaterThan(3);
    // 軸在 [0,180);φ ≥ 180 時 u 與前進方向相反,偏態應為負
    expect(Math.sign(a.skew)).toBe(phi < 180 ? 1 : -1);
    expect(Math.abs(a.skew)).toBeGreaterThan(0.3);
  });
});

describe('input formats', () => {
  const img = renderArrow(70, 40, 20, 20);

  it('RGBA (ImageData-like) and bare alpha matrix give identical analysis to the alpha plane', () => {
    const data = new Uint8ClampedArray(img.width * img.height * 4);
    const matrix: number[][] = [];
    for (let y = 0; y < img.height; y++) {
      const row: number[] = [];
      for (let x = 0; x < img.width; x++) {
        const k = y * img.width + x;
        data[k * 4] = 255;
        data[k * 4 + 1] = 128;
        data[k * 4 + 2] = 0;
        data[k * 4 + 3] = img.alpha[k]!;
        row.push(img.alpha[k]!);
      }
      matrix.push(row);
    }
    const ref = analyzeFrame(img);
    expect(analyzeFrame({ width: img.width, height: img.height, data })).toEqual(ref);
    expect(analyzeFrame(matrix)).toEqual(ref);
  });

  it('rejects malformed input', () => {
    expect(() => analyzeFrame({ width: 0, height: 4, alpha: [] })).toThrow(RangeError);
    expect(() => analyzeFrame({ width: 4, height: 4, alpha: new Uint8Array(3) })).toThrow(RangeError);
    expect(() => analyzeFrame({ width: 4, height: 4, data: new Uint8Array(10) })).toThrow(RangeError);
    expect(() => analyzeFrame([])).toThrow(RangeError);
    expect(() => analyzeFrame([[1, 2], [3]])).toThrow(RangeError);
  });

  it('empty and sub-threshold frames are invalid, not errors', () => {
    expect(analyzeFrame({ width: 8, height: 8, alpha: new Uint8Array(64) }).valid).toBe(false);
    expect(analyzeFrame({ width: 8, height: 8, alpha: new Uint8Array(64).fill(10) }).valid).toBe(false);
  });

  it('largest-component filter removes isolated speckle', () => {
    const base = renderArrow(30, 64, 32, 32);
    const speckled = new Uint8Array(base.alpha);
    for (const [x, y] of [[2, 2], [61, 3], [3, 60], [60, 60], [5, 30]] as const) speckled[y * 64 + x] = 255;
    const a = analyzeFrame({ width: 64, height: 64, alpha: speckled });
    const b = analyzeFrame(base);
    expect(a.pixelCount).toBe(b.pixelCount);
    expect(a.axisPhiDeg).toBeCloseTo(b.axisPhiDeg, 9);
  });
});

// ───────────────────────── 已知偏角與順逆時針 ─────────────────────────

describe('known dirCount / dir0 / clockwise are recovered', () => {
  it.each(COMBOS)('clean: n=$n cw=$cw dir0=$d0', ({ n, cw, d0 }) => {
    const r = calibrateMissile({ ...meta('arrow', n), frames: makeArrowRows(n, d0, cw) });
    expect(r.calibration.status).toBe('auto-pass');
    expect(r.calibration.rotationMode).toBe('discrete');
    expectCorrect(r, d0, cw, 2);
    expect(r.calibration.measure.residualMaxDeg).toBeLessThan(3);
    expect(r.calibration.measure.confidence).toBeGreaterThan(0.5);
    expect(validateCalibration(r.calibration).ok).toBe(true);
  });

  it('result is consistent with dirIndex() from direction.ts (end-to-end)', () => {
    for (const { n, cw, d0 } of COMBOS) {
      const r = calibrateMissile({ ...meta('arrow', n), frames: makeArrowRows(n, d0, cw) });
      const step = 360 / n;
      for (let i = 0; i < n; i++) {
        const truthPhi = normalizeDeg(d0 + (cw ? 1 : -1) * i * step);
        expect(dirIndex(truthPhi, r.calibration)).toBe(i);
      }
    }
  });

  it("axisSpace 'screen' still works (looser tolerance: PCA bias on wide shapes)", () => {
    const r = calibrateMissile(
      { ...meta('arrow', 16), frames: makeArrowRows(16, 40, true) },
      { axisSpace: 'screen' },
    );
    expectCorrect(r, 40, true, 6);
  });
});

describe('headPolarity', () => {
  it('a sprite whose wide end is the front is off by 180° under the default polarity', () => {
    const frames = makeArrowRows(16, 100, true, { spec: { ...ARROW, reversed: true } });
    const wrong = calibrateMissile({ ...meta('spear', 16), frames });
    expect(angularDistance(wrong.calibration.dir0WorldAngle, 100)).toBeGreaterThan(170);

    const ok = calibrateMissile({ ...meta('spear', 16), frames, headPolarity: 'skew-away-from-head' });
    expectCorrect(ok, 100, true, 2);
  });

  it('flipHead() corrects a wrong polarity and marks the result manual-confirmed', () => {
    const frames = makeArrowRows(16, 100, true, { spec: { ...ARROW, reversed: true } });
    const wrong = calibrateMissile({ ...meta('spear', 16), frames }).calibration;
    const fixed = flipHead(wrong);
    expect(angularDistance(fixed.dir0WorldAngle, 100)).toBeLessThan(2);
    expect(fixed.status).toBe('manual-confirmed');
    expect(fixed.measure.method).toBe('manual');
    expect(validateCalibration(fixed).ok).toBe(true);
  });

  it('confirmManually applies only the provided fields', () => {
    const base = calibrateMissile({ ...meta('arrow', 8), frames: makeArrowRows(8, 10, true) }).calibration;
    const c = confirmManually(base, { clockwise: false, notes: 'checked by eye' });
    expect(c.clockwise).toBe(false);
    expect(c.dir0WorldAngle).toBe(base.dir0WorldAngle);
    expect(c.notes).toBe('checked by eye');
    expect(c.status).toBe('manual-confirmed');
  });
});

// ───────────────────────── 噪聲與裁切 ─────────────────────────

describe('noise and cropping', () => {
  it('gaussian alpha noise (σ=12): still correct', () => {
    const rnd = mulberry32(7);
    const rows = makeArrowRows(16, 200, false, { noiseSigma: 12, rnd });
    const r = calibrateMissile({ ...meta('noisy', 16), frames: rows });
    expect(r.calibration.status).toBe('auto-pass');
    expectCorrect(r, 200, false, 3);
  });

  it('noise + mild cropping + position jitter: never a wrong auto-pass, ≥95% auto-pass', () => {
    const rnd = mulberry32(20240229);
    const counts: DirCount[] = [8, 16, 32];
    const trials = 30;
    let autoPass = 0;
    let wrongAutoPass = 0;
    for (let t = 0; t < trials; t++) {
      const n = counts[Math.floor(rnd() * counts.length)]!;
      const cw = rnd() < 0.5;
      const dir0 = rnd() * 360;
      // 44px 畫布 + ±3px 抖動:水平方向的箭矢兩端會被裁掉約 1px
      const rows = makeArrowRows(n, dir0, cw, { size: 44, jitter: 3, noiseSigma: 12, rnd });
      const r = calibrateMissile({ ...meta(`trial_${t}`, n), frames: rows });
      if (r.calibration.status === 'auto-pass') {
        autoPass++;
        const correct =
          r.calibration.clockwise === cw && angularDistance(r.calibration.dir0WorldAngle, dir0) < 3;
        if (!correct) wrongAutoPass++;
      }
    }
    expect(wrongAutoPass).toBe(0);
    expect(autoPass / trials).toBeGreaterThanOrEqual(0.95);
  });

  it('an empty row is reported as needs-review, and the fit still uses the remaining rows', () => {
    const rows = makeArrowRows(16, 75, true);
    rows[3] = { width: 64, height: 64, alpha: new Uint8Array(64 * 64) };
    const r = calibrateMissile({ ...meta('broken', 16), frames: rows });
    expect(r.calibration.status).toBe('needs-review');
    expect(r.diagnostics.reasons.join(' ')).toContain('[3]');
    expectCorrect(r, 75, true, 2);
  });
});

// ───────────────────────── 球形無方向性 ─────────────────────────

describe('round sprites → rotationMode none', () => {
  it.each([1, 8, 16, 32] as const)('solid disc, dirCount=%i', (n) => {
    const disc = renderEllipse(12, 12, 48);
    const r = calibrateMissile({ ...meta('fireball', n), frames: Array<AlphaImageLike>(n).fill(disc) });
    expect(r.calibration.rotationMode).toBe('none');
    expect(r.calibration.status).toBe('auto-pass');
    expect(r.calibration.measure.eccentricity).toBeLessThan(1.1);
    expect(validateCalibration(r.calibration).ok).toBe(true);
  });

  it('soft glow disc with noise is still round', () => {
    const rnd = mulberry32(99);
    const frames = Array.from({ length: 16 }, () => addNoise(renderEllipse(14, 14, 48, true), 10, rnd));
    const r = calibrateMissile({ ...meta('glow', 16), frames });
    expect(r.calibration.rotationMode).toBe('none');
    expect(r.calibration.status).toBe('auto-pass');
  });

  it('a screen-space 2:1 ellipse (flat ring effect) is NOT labelled round and goes to review', () => {
    // 螢幕 2:1 橢圓 = 地面上的圓:軸不可信,必須人工確認,不能輸出看似可信的結果
    const ring = renderEllipse(16, 8, 48);
    const r = calibrateMissile({ ...meta('ground_ring', 16), frames: Array<AlphaImageLike>(16).fill(ring) });
    expect(r.calibration.rotationMode).toBe('discrete');
    expect(r.calibration.status).toBe('needs-review');
    expect(r.diagnostics.usableRows).toBe(0);
  });
});

// ───────────────────────── 擬合與判定邏輯(不經過影像) ─────────────────────────

function fakeAnalysis(phiTrue: number, wrongSign = false, skewMag = 0.7): FrameAnalysis {
  const phi = normalizeDeg(phiTrue);
  const axis = phi % 180;
  let sign = phi < 180 ? 1 : -1; // u 指向前進方向時偏態為正
  if (wrongSign) sign = -sign;
  return {
    valid: true,
    pixelCount: 200,
    mass: 200,
    centroid: { x: 0, y: 0 },
    axisPhiDeg: axis,
    eccScreen: 4,
    eccGround: 5,
    skew: sign * skewMag,
  };
}

function fakeRows(
  n: DirCount,
  dir0: number,
  cw: boolean,
  wrong: ReadonlySet<number> = new Set(),
): FrameAnalysis[] {
  const step = 360 / n;
  return Array.from({ length: n }, (_, i) =>
    fakeAnalysis(dir0 + (cw ? 1 : -1) * i * step, wrong.has(i)),
  );
}

describe('fit logic on exact analyses', () => {
  const dir0s = [0, 12.5, 45, 135, 160, 270, 359];

  it('recovers every (n, cw, dir0) exactly', () => {
    for (const n of [8, 16, 32] as const) {
      for (const cw of [true, false]) {
        for (const d0 of dir0s) {
          const r = calibrateFromAnalyses(meta('x', n), fakeRows(n, d0, cw));
          expect(r.calibration.clockwise).toBe(cw);
          expect(angularDistance(r.calibration.dir0WorldAngle, d0)).toBeLessThan(0.01);
          expect(r.calibration.status).toBe('auto-pass');
        }
      }
    }
  });

  it('tolerates a few rows with the wrong head sign (2 of 16 → still auto-pass)', () => {
    const r = calibrateFromAnalyses(meta('x', 16), fakeRows(16, 130, false, new Set([2, 9])));
    expect(r.calibration.status).toBe('auto-pass');
    expectCorrect(r, 130, false, 0.01);
    expect(r.diagnostics.headAgreement).toBeCloseTo(14 / 16, 3);
  });

  it('many wrong head rows (5 of 16): the majority still wins but status is needs-review', () => {
    const r = calibrateFromAnalyses(meta('x', 16), fakeRows(16, 130, true, new Set([0, 3, 5, 8, 12])));
    expect(r.calibration.status).toBe('needs-review');
    expectCorrect(r, 130, true, 0.01);
    expect(r.diagnostics.reasons.join(' ')).toContain('一致率');
  });

  it('no usable skew → head is undecidable → needs-review', () => {
    const rows = fakeRows(16, 50, true).map((a) => ({ ...a, skew: 0.01 }));
    const r = calibrateFromAnalyses(meta('x', 16), rows);
    expect(r.calibration.status).toBe('needs-review');
    expect(r.diagnostics.headVoters).toBe(0);
  });

  it('sprite that does not rotate (identical axis on every row) → needs-review', () => {
    const rows = Array.from({ length: 16 }, () => fakeAnalysis(30));
    const r = calibrateFromAnalyses(meta('x', 16), rows);
    expect(r.calibration.status).toBe('needs-review');
    expect(r.calibration.measure.residualMaxDeg).toBeGreaterThan(11.25);
  });

  it('too many unreliable axes (low ground eccentricity) → needs-review', () => {
    const rows = fakeRows(16, 50, true).map((a, i) => (i < 10 ? { ...a, eccGround: 1.0 } : a));
    const r = calibrateFromAnalyses(meta('x', 16), rows);
    expect(r.calibration.status).toBe('needs-review');
    expect(r.diagnostics.usableRows).toBe(6);
  });

  it('wrong rotation sense is rejected with a clear margin', () => {
    const fit = fitDirections(fakeRows(16, 20, false), 16);
    expect(fit.clockwise).toBe(false);
    expect(fit.clockwiseConfidence).toBeGreaterThan(0.9);
    expect(fit.residualMaxDeg).toBeLessThan(1e-6);
  });

  it('fitDirections reports per-row residuals and head votes', () => {
    const fit = fitDirections(fakeRows(8, 0, true, new Set([4])), 8);
    expect(fit.rows).toHaveLength(8);
    expect(fit.rows[4]!.headVote).toBe('disagree');
    expect(fit.rows[0]!.headVote).toBe('agree');
    for (const r of fit.rows) expect(r.residualDeg).toBeLessThan(1e-6);
  });

  it('works when the true dir0 sits at the 0/180 axis wrap', () => {
    for (const d0 of [0, 180, 179.9, 359.9]) {
      const r = calibrateFromAnalyses(meta('x', 16), fakeRows(16, d0, true));
      expect(angularDistance(r.calibration.dir0WorldAngle, d0)).toBeLessThan(0.01);
    }
  });
});

describe('input validation', () => {
  it('throws on frame count mismatch and invalid dirCount', () => {
    expect(() => calibrateMissile({ ...meta('x', 16), frames: makeArrowRows(8, 0, true) })).toThrow(RangeError);
    expect(() =>
      calibrateFromAnalyses({ missileId: 'x', celFile: 'x', dirCount: 12 as never }, fakeRows(8, 0, true)),
    ).toThrow(RangeError);
  });

  it('rejects out-of-range options', () => {
    const frames = makeArrowRows(8, 0, true);
    expect(() => calibrateMissile({ ...meta('x', 8), frames }, { roundEccentricity: 1 })).toThrow(RangeError);
    expect(() => calibrateMissile({ ...meta('x', 8), frames }, { alphaThreshold: 300 })).toThrow(RangeError);
  });
});

// ───────────────────────── 批次報告 ─────────────────────────

describe('batch report', () => {
  const brokenRows = makeArrowRows(16, 10, true);
  brokenRows[5] = { width: 64, height: 64, alpha: new Uint8Array(64 * 64) };

  const inputs: MissileFrames[] = [
    { ...meta('arrow16', 16), frames: makeArrowRows(16, 135, true) },
    { ...meta('fireball16', 16), frames: Array<AlphaImageLike>(16).fill(renderEllipse(12, 12, 48)) },
    { ...meta('broken16', 16), frames: brokenRows },
    { ...meta('mismatch', 16), frames: makeArrowRows(8, 0, true) },
  ];
  const report = calibrateBatch(inputs);

  it('counts every outcome and never aborts on a bad input', () => {
    expect(report.total).toBe(4);
    expect(report.autoPass).toBe(2);
    expect(report.needsReview).toBe(1);
    expect(report.failed).toBe(1);
  });

  it('every successful calibration conforms to the DirectionCalibration schema', () => {
    for (const e of report.entries) {
      if (e.ok) expect(validateCalibration(e.result.calibration).ok).toBe(true);
    }
  });

  it('JSON report round-trips', () => {
    const parsed = JSON.parse(reportToJson(report)) as { total: number; entries: unknown[] };
    expect(parsed.total).toBe(4);
    expect(parsed.entries).toHaveLength(4);
  });

  it('Markdown report lists problems first and contains every missile', () => {
    const md = reportToMarkdown(report);
    expect(md).toContain('共 4 筆:auto-pass 2、needs-review 1、失敗 1');
    for (const id of ['arrow16', 'fireball16', 'broken16', 'mismatch']) expect(md).toContain(id);
    expect(md.indexOf('mismatch')).toBeLessThan(md.indexOf('broken16'));
    expect(md.indexOf('broken16')).toBeLessThan(md.indexOf('arrow16'));
    expect(md).toContain('**failed**');
  });
});
