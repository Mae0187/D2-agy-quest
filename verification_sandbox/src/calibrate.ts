/**
 * calibrate.ts — 投射物方向校準量測(純數學,無 DOM 依賴)
 *
 * 流程:
 *   FrameInput[](各方向行的代表幀)
 *     → analyzeFrame():alpha 加權 PCA、離心率、沿軸偏態
 *     → fitDirections():φ_i = dir0 ± i·(360/N) 的擬合(先軸向、再全域頭尾投票)
 *     → calibrateFromAnalyses():套用門檻,輸出 DirectionCalibration + 診斷資訊
 *
 * 座標約定與 geometry.ts 一致:φ = atan2(dy*2, dx),φ 遞增 = 視覺順時針。
 *
 * 重要限制:
 *  - 頭尾判定依賴「偏態指向前進端」的假設,見 CalibrationOptions.headPolarity。
 *  - 本模組只負責量測;不確定時一律標 needs-review,不輸出看似可信的錯誤結果。
 */

import {
  DIR_COUNTS,
  type CalibrationStatus,
  type DirCount,
  type DirectionCalibration,
  type RotationMode,
} from './direction.js';
import { DEG2RAD, RAD2DEG, normalizeDeg, screenToPhi } from './geometry.js';

// ───────────────────────── 輸入型別 ─────────────────────────

/** 與 ImageData 結構相容(RGBA,每像素 4 個值,alpha 在第 4 個)。 */
export interface RgbaImageLike {
  readonly width: number;
  readonly height: number;
  readonly data: ArrayLike<number>;
}

/** 單通道 alpha 平面(列優先,長度 ≥ width*height,值域 0~255)。 */
export interface AlphaImageLike {
  readonly width: number;
  readonly height: number;
  readonly alpha: ArrayLike<number>;
}

/** 純像素矩陣:rows[y][x] = alpha(0~255)。每列長度必須相同。 */
export type AlphaMatrix = ReadonlyArray<ArrayLike<number>>;

export type FrameInput = RgbaImageLike | AlphaImageLike | AlphaMatrix;

// ───────────────────────── 選項 ─────────────────────────

export type HeadPolarity = 'skew-toward-head' | 'skew-away-from-head';
export type AxisSpace = 'ground' | 'screen';

export interface CalibrationOptions {
  /** alpha 低於此值的像素視為背景(0~255)。可抑制雜訊與半透明光暈。 */
  alphaThreshold: number;
  /** 只保留最大的 8 連通分量,濾掉孤立雜點。 */
  keepLargestComponent: boolean;
  /** 有效像素數下限,低於此值視為空幀。 */
  minPixels: number;
  /** 螢幕離心率(√(λ1/λ2))低於此值判定為球形、無方向性。 */
  roundEccentricity: number;
  /** 地面離心率低於此值的行,其主軸不可信,不參與擬合。 */
  minAxisEccentricity: number;
  /** 主軸在哪個空間做 PCA。預設 'ground'(見檔頭說明)。 */
  axisSpace: AxisSpace;
  /**
   * 偏態與前進端的關係。
   *  'skew-toward-head':偏態指向前進端(尖端窄、尾部寬的箭矢)。
   *  'skew-away-from-head':偏態背向前進端(前端寬、尾部細的素材)。
   */
  headPolarity: HeadPolarity;
  /** |偏態| 低於此值的行棄權(不投票)。 */
  minAbsSkew: number;
  /** |偏態| 達到此值時投票權重為 1,以下線性縮放。 */
  skewFull: number;
  /** 可用行佔全部方向數的比例下限。 */
  minUsableFraction: number;
  /** 頭尾投票中,與最終結論一致的行所佔比例下限。 */
  minHeadAgreement: number;
  /** 順逆時針判定把握下限:1 − rms(最佳) / rms(另一方向)。 */
  minDirectionConfidence: number;
  /** 最大軸向殘差上限 = 此值 × (360/N)。0.5 即「半個離散格」。 */
  maxResidualScale: number;
}

export const DEFAULT_CALIBRATION_OPTIONS: Readonly<CalibrationOptions> = {
  alphaThreshold: 32,
  keepLargestComponent: true,
  minPixels: 12,
  roundEccentricity: 1.3,
  minAxisEccentricity: 1.3,
  axisSpace: 'ground',
  headPolarity: 'skew-toward-head',
  minAbsSkew: 0.1,
  skewFull: 0.5,
  minUsableFraction: 0.75,
  minHeadAgreement: 0.8,
  minDirectionConfidence: 0.3,
  maxResidualScale: 0.5,
};

export function resolveOptions(partial: Partial<CalibrationOptions> = {}): CalibrationOptions {
  const merged: CalibrationOptions = { ...DEFAULT_CALIBRATION_OPTIONS };
  for (const key of Object.keys(partial) as Array<keyof CalibrationOptions>) {
    const v = partial[key];
    if (v !== undefined) (merged as unknown as Record<string, unknown>)[key] = v;
  }
  if (!(merged.alphaThreshold >= 0 && merged.alphaThreshold <= 255))
    throw new RangeError('alphaThreshold must be in [0, 255]');
  if (!(merged.roundEccentricity > 1)) throw new RangeError('roundEccentricity must be > 1');
  if (!(merged.minAxisEccentricity >= 1)) throw new RangeError('minAxisEccentricity must be >= 1');
  if (!(merged.skewFull > 0)) throw new RangeError('skewFull must be > 0');
  if (!(merged.minPixels >= 1)) throw new RangeError('minPixels must be >= 1');
  return merged;
}

// ───────────────────────── 單幀分析 ─────────────────────────

export interface FrameAnalysis {
  /** 有足夠有效像素。false 時其餘欄位為預設值,不可使用。 */
  readonly valid: boolean;
  readonly pixelCount: number;
  /** Σ alpha/255。 */
  readonly mass: number;
  /** 螢幕空間的質心(像素)。 */
  readonly centroid: { readonly x: number; readonly y: number };
  /** 主軸的 φ(度),範圍 [0, 180)。軸沒有頭尾,故只有 180° 週期。 */
  readonly axisPhiDeg: number;
  /** 螢幕空間離心率 √(λ1/λ2),上限 1000。用於球形判斷。 */
  readonly eccScreen: number;
  /** 地面空間(y×2)離心率,上限 1000。用於判斷主軸是否可信。 */
  readonly eccGround: number;
  /**
   * 沿主軸單位向量 u = (cos a, sin a)(地面空間)的偏態係數 m3/m2^1.5。
   * 正值 = 質量尾端延伸向 +u 方向。
   */
  readonly skew: number;
}

const ECC_CAP = 1000;
const EPS = 1e-12;

interface AlphaPlane {
  readonly width: number;
  readonly height: number;
  readonly alpha: Float64Array;
}

function isMatrix(f: FrameInput): f is AlphaMatrix {
  return Array.isArray(f);
}

function clampAlpha(v: number): number {
  return v > 0 ? (v < 255 ? v : 255) : 0; // NaN → 0
}

function checkDims(width: number, height: number): void {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new RangeError(`invalid frame size ${width}x${height}`);
  }
}

function toAlphaPlane(frame: FrameInput): AlphaPlane {
  if (isMatrix(frame)) {
    const height = frame.length;
    const first = frame[0];
    if (first === undefined) throw new RangeError('empty alpha matrix');
    const width = first.length;
    checkDims(width, height);
    const alpha = new Float64Array(width * height);
    for (let y = 0; y < height; y++) {
      const row = frame[y]!;
      if (row.length !== width) {
        throw new RangeError(`matrix row ${y} has length ${row.length}, expected ${width}`);
      }
      for (let x = 0; x < width; x++) alpha[y * width + x] = clampAlpha(row[x]!);
    }
    return { width, height, alpha };
  }

  checkDims(frame.width, frame.height);
  const n = frame.width * frame.height;
  const alpha = new Float64Array(n);
  if ('alpha' in frame) {
    if (frame.alpha.length < n) throw new RangeError(`alpha length ${frame.alpha.length} < ${n}`);
    for (let k = 0; k < n; k++) alpha[k] = clampAlpha(frame.alpha[k]!);
  } else {
    if (frame.data.length < n * 4) throw new RangeError(`data length ${frame.data.length} < ${n * 4}`);
    for (let k = 0; k < n; k++) alpha[k] = clampAlpha(frame.data[k * 4 + 3]!);
  }
  return { width: frame.width, height: frame.height, alpha };
}

function largestComponent(
  mask: Uint8Array,
  w: number,
  h: number,
): { mask: Uint8Array; size: number } {
  const n = w * h;
  const label = new Int32Array(n);
  const stack = new Int32Array(n); // 每個像素只會在上標時推入一次,容量足夠
  let next = 0;
  let best = 0;
  let bestSize = 0;

  for (let start = 0; start < n; start++) {
    if (mask[start] !== 1 || label[start] !== 0) continue;
    next++;
    let sp = 0;
    stack[sp++] = start;
    label[start] = next;
    let size = 0;
    while (sp > 0) {
      const p = stack[--sp]!;
      size++;
      const x = p % w;
      const y = (p - x) / w;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          if (nx < 0 || nx >= w) continue;
          const q = ny * w + nx;
          if (mask[q] === 1 && label[q] === 0) {
            label[q] = next;
            stack[sp++] = q;
          }
        }
      }
    }
    if (size > bestSize) {
      bestSize = size;
      best = next;
    }
  }

  const out = new Uint8Array(n);
  if (best > 0) {
    for (let k = 0; k < n; k++) if (label[k] === best) out[k] = 1;
  }
  return { mask: out, size: bestSize };
}

function eigen2(xx: number, yy: number, xy: number): { l1: number; l2: number; theta: number } {
  const mean = (xx + yy) / 2;
  const r = Math.hypot((xx - yy) / 2, xy);
  return {
    l1: mean + r,
    l2: Math.max(0, mean - r),
    theta: 0.5 * Math.atan2(2 * xy, xx - yy), // 主軸方向(弧度),落在 (-π/2, π/2]
  };
}

function eccentricityOf(l1: number, l2: number): number {
  if (l1 <= EPS) return 1; // 退化成一個點
  if (l2 <= l1 / (ECC_CAP * ECC_CAP)) return ECC_CAP;
  return Math.sqrt(l1 / l2);
}

function mod180(x: number): number {
  return ((x % 180) + 180) % 180;
}

function axialDistance(a: number, b: number): number {
  const d = mod180(a - b);
  return d > 90 ? 180 - d : d;
}

function invalidAnalysis(pixelCount: number): FrameAnalysis {
  return {
    valid: false,
    pixelCount,
    mass: 0,
    centroid: { x: 0, y: 0 },
    axisPhiDeg: 0,
    eccScreen: 1,
    eccGround: 1,
    skew: 0,
  };
}

/**
 * 分析單一方向行的代表幀:alpha 加權質心 / 共變異數 / PCA 主軸 / 離心率 / 偏態。
 */
export function analyzeFrame(
  frame: FrameInput,
  options: Partial<CalibrationOptions> = {},
): FrameAnalysis {
  const o = resolveOptions(options);
  const { width: w, height: h, alpha } = toAlphaPlane(frame);
  const n = w * h;

  let mask: Uint8Array = new Uint8Array(n);
  let count = 0;
  for (let k = 0; k < n; k++) {
    const a = alpha[k]!;
    if (a > 0 && a >= o.alphaThreshold) {
      mask[k] = 1;
      count++;
    }
  }
  if (o.keepLargestComponent && count > 0) {
    const lc = largestComponent(mask, w, h);
    mask = lc.mask;
    count = lc.size;
  }
  if (count < o.minPixels) return invalidAnalysis(count);

  // 第一遍:質心
  let mass = 0;
  let sx = 0;
  let sy = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const k = y * w + x;
      if (mask[k] !== 1) continue;
      const wt = alpha[k]! / 255;
      mass += wt;
      sx += wt * x;
      sy += wt * y;
    }
  }
  const cx = sx / mass;
  const cy = sy / mass;

  // 第二遍:螢幕空間共變異數
  let cxx = 0;
  let cyy = 0;
  let cxy = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const k = y * w + x;
      if (mask[k] !== 1) continue;
      const wt = alpha[k]! / 255;
      const dx = x - cx;
      const dy = y - cy;
      cxx += wt * dx * dx;
      cyy += wt * dy * dy;
      cxy += wt * dx * dy;
    }
  }
  cxx /= mass;
  cyy /= mass;
  cxy /= mass;

  // 地面空間共變異數:y' = 2y ⇒ var(y') = 4 var(y),cov(x, y') = 2 cov(x, y)
  const es = eigen2(cxx, cyy, cxy);
  const eg = eigen2(cxx, 4 * cyy, 2 * cxy);

  const axisPhiDeg =
    o.axisSpace === 'ground'
      ? mod180(eg.theta * RAD2DEG)
      : mod180(screenToPhi(Math.cos(es.theta), Math.sin(es.theta)));

  // 沿主軸(地面空間單位向量 u)的偏態
  const ca = Math.cos(axisPhiDeg * DEG2RAD);
  const sa = Math.sin(axisPhiDeg * DEG2RAD);
  let m2 = 0;
  let m3 = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const k = y * w + x;
      if (mask[k] !== 1) continue;
      const wt = alpha[k]! / 255;
      const t = (x - cx) * ca + (y - cy) * 2 * sa;
      m2 += wt * t * t;
      m3 += wt * t * t * t;
    }
  }
  m2 /= mass;
  m3 /= mass;
  const skew = m2 > EPS ? m3 / Math.pow(m2, 1.5) : 0;

  return {
    valid: true,
    pixelCount: count,
    mass,
    centroid: { x: cx, y: cy },
    axisPhiDeg,
    eccScreen: eccentricityOf(es.l1, es.l2),
    eccGround: eccentricityOf(eg.l1, eg.l2),
    skew,
  };
}

// ───────────────────────── 方向擬合 ─────────────────────────

export type HeadVote = 'agree' | 'disagree' | 'abstain';

export interface RowFit {
  readonly index: number;
  readonly usable: boolean;
  readonly axisPhiDeg: number | null;
  /** 與擬合軸的夾角(度,[0, 90]);不可用的行為 null。與頭尾無關。 */
  readonly residualDeg: number | null;
  readonly headVote: HeadVote | null;
}

export interface DirectionFit {
  /** false:可用行少於 3,沒有執行擬合,其餘欄位為預設值。 */
  readonly ok: boolean;
  readonly clockwise: boolean;
  /** [0, 360)。已套用頭尾投票。 */
  readonly dir0WorldAngle: number;
  readonly rmsResidualDeg: number;
  readonly residualMaxDeg: number;
  /** 1 − rms(最佳)/rms(另一方向),0~1。 */
  readonly clockwiseConfidence: number;
  /** 投票行中與最終結論一致的比例(0~1)。沒有任何投票時為 0。 */
  readonly headAgreement: number;
  readonly headVoters: number;
  /** |Σ w·dot| / Σ w,0~1。 */
  readonly headStrength: number;
  readonly usableCount: number;
  readonly rows: readonly RowFit[];
}

function assertDirCountMatches(dirCount: number, rowCount: number): void {
  if (!(DIR_COUNTS as readonly number[]).includes(dirCount)) {
    throw new RangeError(`dirCount must be one of ${DIR_COUNTS.join(', ')}, got ${dirCount}`);
  }
  if (rowCount !== dirCount) {
    throw new RangeError(`expected ${dirCount} direction rows, got ${rowCount}`);
  }
}

interface Candidate {
  readonly s: 1 | -1;
  readonly d: number; // dir0 mod 180
  readonly rms: number;
  readonly max: number;
}

/**
 * 擬合 φ_i = dir0 + s·i·step(s = ±1,step = 360/N)。
 *  1. 軸向擬合:對 2·(a_i − s·i·step) 取圓形平均得 dir0 mod 180;s 取兩者中 RMS 殘差較小者。
 *  2. 頭尾:各行以偏態符號投票(權重隨 |偏態| 增加),決定 dir0 或 dir0+180。
 */
export function fitDirections(
  analyses: readonly FrameAnalysis[],
  dirCount: DirCount,
  options: Partial<CalibrationOptions> = {},
): DirectionFit {
  const o = resolveOptions(options);
  assertDirCountMatches(dirCount, analyses.length);
  const n = dirCount;
  const step = 360 / n;

  const usableIdx: number[] = [];
  analyses.forEach((a, i) => {
    if (a.valid && a.eccGround >= o.minAxisEccentricity) usableIdx.push(i);
  });
  const usableSet = new Set(usableIdx);

  if (usableIdx.length < 3) {
    return {
      ok: false,
      clockwise: true,
      dir0WorldAngle: 0,
      rmsResidualDeg: 90,
      residualMaxDeg: 90,
      clockwiseConfidence: 0,
      headAgreement: 0,
      headVoters: 0,
      headStrength: 0,
      usableCount: usableIdx.length,
      rows: analyses.map((a, i) => ({
        index: i,
        usable: usableSet.has(i),
        axisPhiDeg: a.valid ? a.axisPhiDeg : null,
        residualDeg: null,
        headVote: null,
      })),
    };
  }

  const evaluate = (s: 1 | -1): Candidate => {
    let zr = 0;
    let zi = 0;
    for (const i of usableIdx) {
      const ang = 2 * (analyses[i]!.axisPhiDeg - s * i * step) * DEG2RAD;
      zr += Math.cos(ang);
      zi += Math.sin(ang);
    }
    const d = mod180(0.5 * Math.atan2(zi, zr) * RAD2DEG);
    let sumSq = 0;
    let max = 0;
    for (const i of usableIdx) {
      const r = axialDistance(analyses[i]!.axisPhiDeg, d + s * i * step);
      sumSq += r * r;
      if (r > max) max = r;
    }
    return { s, d, rms: Math.sqrt(sumSq / usableIdx.length), max };
  };

  const plus = evaluate(1);
  const minus = evaluate(-1);
  const best = plus.rms <= minus.rms + 1e-9 ? plus : minus; // 平手偏向順時針
  const other = best === plus ? minus : plus;
  const clockwiseConfidence =
    other.rms > 1e-9 ? Math.min(1, Math.max(0, 1 - best.rms / other.rms)) : 0;

  // 頭尾投票
  const polarity = o.headPolarity === 'skew-toward-head' ? 1 : -1;
  const residuals = new Array<number | null>(n).fill(null);
  const votes = new Array<HeadVote | null>(n).fill(null);
  const dots = new Array<number>(n).fill(0);
  let V = 0;
  let Wsum = 0;
  for (const i of usableIdx) {
    const a = analyses[i]!;
    const e = best.d + best.s * i * step;
    residuals[i] = axialDistance(a.axisPhiDeg, e);
    const absSk = Math.abs(a.skew);
    if (absSk < o.minAbsSkew) {
      votes[i] = 'abstain';
      continue;
    }
    const w = Math.min(1, absSk / o.skewFull);
    const headSign = (a.skew > 0 ? 1 : -1) * polarity;
    // 該行判定的頭方向 = headSign · u(a);期望方向 = e。兩者內積 = headSign·cos(a − e)
    const dot = headSign * Math.cos((a.axisPhiDeg - e) * DEG2RAD);
    dots[i] = dot;
    V += w * dot;
    Wsum += w;
  }
  const flip = V < 0;
  let voters = 0;
  let agree = 0;
  for (const i of usableIdx) {
    if (votes[i] === 'abstain') continue;
    voters++;
    const ok = (flip ? -dots[i]! : dots[i]!) > 0;
    votes[i] = ok ? 'agree' : 'disagree';
    if (ok) agree++;
  }

  return {
    ok: true,
    clockwise: best.s === 1,
    dir0WorldAngle: normalizeDeg(flip ? best.d + 180 : best.d),
    rmsResidualDeg: best.rms,
    residualMaxDeg: best.max,
    clockwiseConfidence,
    headAgreement: voters > 0 ? agree / voters : 0,
    headVoters: voters,
    headStrength: Wsum > 0 ? Math.abs(V) / Wsum : 0,
    usableCount: usableIdx.length,
    rows: analyses.map((a, i) => ({
      index: i,
      usable: usableSet.has(i),
      axisPhiDeg: a.valid ? a.axisPhiDeg : null,
      residualDeg: residuals[i] ?? null,
      headVote: votes[i] ?? null,
    })),
  };
}

// ───────────────────────── 單一 missile 校準 ─────────────────────────

export interface MissileMeta {
  readonly missileId: string;
  readonly celFile: string;
  readonly dirCount: DirCount;
}

export interface MissileFrames extends MissileMeta {
  /** 依方向索引排列的代表幀,長度必須等於 dirCount。 */
  readonly frames: readonly FrameInput[];
  /** 覆寫此 missile 的頭尾極性(預設用 options.headPolarity)。 */
  readonly headPolarity?: HeadPolarity;
}

export interface RowDiagnostic {
  readonly index: number;
  readonly valid: boolean;
  readonly pixelCount: number;
  readonly axisPhiDeg: number | null;
  readonly eccScreen: number;
  readonly eccGround: number;
  readonly skew: number;
  readonly usable: boolean;
  readonly residualDeg: number | null;
  readonly headVote: HeadVote | null;
}

export interface CalibrationDiagnostics {
  /** needs-review 的原因(auto-pass 時為空)。 */
  readonly reasons: readonly string[];
  readonly rows: readonly RowDiagnostic[];
  readonly medianEccScreen: number;
  readonly maxEccScreen: number;
  readonly usableRows: number;
  readonly rmsResidualDeg: number | null;
  readonly clockwiseConfidence: number | null;
  readonly headAgreement: number | null;
  readonly headVoters: number | null;
}

export interface CalibrationResult {
  readonly calibration: DirectionCalibration;
  readonly diagnostics: CalibrationDiagnostics;
}

const round3 = (x: number): number => Math.round(x * 1000) / 1000 + 0; // +0 消除 -0
const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));

function median(values: readonly number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 === 1 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

interface Outcome {
  rotationMode: RotationMode;
  dir0: number;
  clockwise: boolean;
  residualMax: number;
  eccentricity: number;
  confidence: number;
  status: CalibrationStatus;
  reasons: string[];
  rows: RowDiagnostic[];
  medianEcc: number;
  maxEcc: number;
  usableRows: number;
  rms: number | null;
  cwConf: number | null;
  headAgreement: number | null;
  headVoters: number | null;
}

function finish(meta: MissileMeta, out: Outcome): CalibrationResult {
  const notes = out.reasons.join('; ');
  const calibration: DirectionCalibration = {
    missileId: meta.missileId,
    celFile: meta.celFile,
    dirCount: meta.dirCount,
    dir0WorldAngle: normalizeDeg(round3(out.dir0)),
    clockwise: out.clockwise,
    rotationMode: out.rotationMode,
    measure: {
      method: 'auto',
      residualMaxDeg: round3(out.residualMax),
      eccentricity: round3(out.eccentricity),
      confidence: round3(clamp01(out.confidence)),
    },
    status: out.status,
    ...(notes.length > 0 ? { notes } : {}),
  };
  return {
    calibration,
    diagnostics: {
      reasons: out.reasons,
      rows: out.rows,
      medianEccScreen: round3(out.medianEcc),
      maxEccScreen: round3(out.maxEcc),
      usableRows: out.usableRows,
      rmsResidualDeg: out.rms === null ? null : round3(out.rms),
      clockwiseConfidence: out.cwConf === null ? null : round3(out.cwConf),
      headAgreement: out.headAgreement === null ? null : round3(out.headAgreement),
      headVoters: out.headVoters,
    },
  };
}

function rowDiagnostics(
  analyses: readonly FrameAnalysis[],
  fit?: DirectionFit,
): RowDiagnostic[] {
  return analyses.map((a, i) => {
    const fr = fit?.rows[i];
    return {
      index: i,
      valid: a.valid,
      pixelCount: a.pixelCount,
      axisPhiDeg: a.valid ? round3(a.axisPhiDeg) : null,
      eccScreen: round3(a.eccScreen),
      eccGround: round3(a.eccGround),
      skew: round3(a.skew),
      usable: fr?.usable ?? false,
      residualDeg: fr?.residualDeg === null || fr?.residualDeg === undefined ? null : round3(fr.residualDeg),
      headVote: fr?.headVote ?? null,
    };
  });
}

/**
 * 從已分析好的各行資料產生校準結果。與影像無關,方便單獨測試擬合與判定邏輯。
 */
export function calibrateFromAnalyses(
  meta: MissileMeta,
  analyses: readonly FrameAnalysis[],
  options: Partial<CalibrationOptions> = {},
): CalibrationResult {
  const o = resolveOptions(options);
  assertDirCountMatches(meta.dirCount, analyses.length);
  const n = meta.dirCount;
  const step = 360 / n;
  const reasons: string[] = [];

  const validIdx: number[] = [];
  const emptyIdx: number[] = [];
  analyses.forEach((a, i) => (a.valid ? validIdx : emptyIdx).push(i));
  if (emptyIdx.length > 0) {
    reasons.push(`方向行 [${emptyIdx.join(', ')}] 沒有足夠的有效像素`);
  }

  const base = {
    rows: rowDiagnostics(analyses),
    rms: null,
    cwConf: null,
    headAgreement: null,
    headVoters: null,
  } as const;

  if (validIdx.length === 0) {
    return finish(meta, {
      ...base,
      rotationMode: 'discrete',
      dir0: 0,
      clockwise: true,
      residualMax: 90,
      eccentricity: 1,
      confidence: 0,
      status: 'needs-review',
      reasons,
      medianEcc: 1,
      maxEcc: 1,
      usableRows: 0,
    });
  }

  const eccs = validIdx.map((i) => analyses[i]!.eccScreen);
  const medianEcc = median(eccs);
  const maxEcc = Math.max(...eccs);

  // ── 球形:無方向性 ──
  if (medianEcc < o.roundEccentricity) {
    if (maxEcc >= o.roundEccentricity) {
      reasons.push(
        `部分方向行偏細長(最大離心率 ${maxEcc.toFixed(2)}),但中位數 ${medianEcc.toFixed(2)} 判定為球形`,
      );
    }
    return finish(meta, {
      ...base,
      rotationMode: 'none',
      dir0: 0,
      clockwise: true,
      residualMax: 0,
      eccentricity: medianEcc,
      confidence: 1 - (maxEcc - 1) / (o.roundEccentricity - 1),
      status: reasons.length === 0 ? 'auto-pass' : 'needs-review',
      reasons,
      medianEcc,
      maxEcc,
      usableRows: validIdx.length,
    });
  }

  // ── 單方向且細長:無法擬合順逆時針 ──
  if (n === 1) {
    const a = analyses[0]!;
    const polarity = o.headPolarity === 'skew-toward-head' ? 1 : -1;
    let dir0 = a.axisPhiDeg;
    if (Math.abs(a.skew) >= o.minAbsSkew && (a.skew > 0 ? 1 : -1) * polarity < 0) dir0 += 180;
    reasons.push(
      'dirCount=1 且形狀細長,無法擬合順逆時針;已設為 none。若繪製端需要自由旋轉,請人工確認為 free(dir0 為量測得到的朝向)',
    );
    return finish(meta, {
      ...base,
      rotationMode: 'none',
      dir0,
      clockwise: true,
      residualMax: 0,
      eccentricity: medianEcc,
      confidence: 0,
      status: 'needs-review',
      reasons,
      medianEcc,
      maxEcc,
      usableRows: 1,
    });
  }

  // ── 離散方向擬合 ──
  const fit = fitDirections(analyses, meta.dirCount, o);
  const rows = rowDiagnostics(analyses, fit);

  if (!fit.ok) {
    reasons.push(`可用於擬合的方向行僅 ${fit.usableCount}/${n}(需要至少 3 行且地面離心率 ≥ ${o.minAxisEccentricity})`);
    return finish(meta, {
      ...base,
      rows,
      rotationMode: 'discrete',
      dir0: 0,
      clockwise: true,
      residualMax: 90,
      eccentricity: medianEcc,
      confidence: 0,
      status: 'needs-review',
      reasons,
      medianEcc,
      maxEcc,
      usableRows: fit.usableCount,
    });
  }

  const minUsable = Math.max(3, Math.ceil(o.minUsableFraction * n));
  if (fit.usableCount < minUsable) {
    reasons.push(`可用方向行 ${fit.usableCount}/${n},低於要求的 ${minUsable}`);
  }
  const residualLimit = o.maxResidualScale * step;
  if (fit.residualMaxDeg > residualLimit) {
    reasons.push(
      `最大軸向殘差 ${fit.residualMaxDeg.toFixed(2)}° 超過上限 ${residualLimit.toFixed(2)}°(素材可能不是均勻旋轉,或軸不可信)`,
    );
  }
  if (fit.clockwiseConfidence < o.minDirectionConfidence) {
    reasons.push(`順逆時針判定把握不足(${fit.clockwiseConfidence.toFixed(2)} < ${o.minDirectionConfidence})`);
  }
  if (fit.headVoters < Math.ceil(fit.usableCount / 2)) {
    reasons.push(`可判定頭尾的方向行過少(${fit.headVoters}/${fit.usableCount})`);
  } else if (fit.headAgreement < o.minHeadAgreement) {
    reasons.push(`頭尾投票一致率 ${fit.headAgreement.toFixed(2)} < ${o.minHeadAgreement}`);
  }

  const fitScore = clamp01(1 - fit.residualMaxDeg / (step / 2));
  const headConf =
    fit.headVoters > 0
      ? clamp01(2 * fit.headAgreement - 1) * Math.min(1, fit.headVoters / fit.usableCount)
      : 0;
  const coverage = fit.usableCount / n;

  return finish(meta, {
    rows,
    rotationMode: 'discrete',
    dir0: fit.dir0WorldAngle,
    clockwise: fit.clockwise,
    residualMax: fit.residualMaxDeg,
    eccentricity: medianEcc,
    confidence: fitScore * fit.clockwiseConfidence * headConf * coverage,
    status: reasons.length === 0 ? 'auto-pass' : 'needs-review',
    reasons,
    medianEcc,
    maxEcc,
    usableRows: fit.usableCount,
    rms: fit.rmsResidualDeg,
    cwConf: fit.clockwiseConfidence,
    headAgreement: fit.headAgreement,
    headVoters: fit.headVoters,
  });
}

/** 對單一 missile 的各方向行代表幀做完整校準。 */
export function calibrateMissile(
  input: MissileFrames,
  options: Partial<CalibrationOptions> = {},
): CalibrationResult {
  assertDirCountMatches(input.dirCount, input.frames.length);
  const o = resolveOptions({
    ...options,
    ...(input.headPolarity !== undefined ? { headPolarity: input.headPolarity } : {}),
  });
  const analyses = input.frames.map((f) => analyzeFrame(f, o));
  return calibrateFromAnalyses(input, analyses, o);
}

// ───────────────────────── 人工確認輔助 ─────────────────────────

export interface ManualPatch {
  readonly dir0WorldAngle?: number;
  readonly clockwise?: boolean;
  readonly rotationMode?: RotationMode;
  readonly notes?: string;
}

/** UI 人工確認後存檔:套用修正並標為 manual-confirmed。 */
export function confirmManually(
  cal: DirectionCalibration,
  patch: ManualPatch = {},
): DirectionCalibration {
  return {
    ...cal,
    dir0WorldAngle:
      patch.dir0WorldAngle === undefined ? cal.dir0WorldAngle : normalizeDeg(patch.dir0WorldAngle),
    clockwise: patch.clockwise ?? cal.clockwise,
    rotationMode: patch.rotationMode ?? cal.rotationMode,
    measure: { ...cal.measure, method: 'manual' },
    status: 'manual-confirmed',
    ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
  };
}

/** 一鍵翻轉頭尾(dir0 + 180°),並標為 manual-confirmed。 */
export function flipHead(cal: DirectionCalibration): DirectionCalibration {
  return confirmManually(cal, { dir0WorldAngle: cal.dir0WorldAngle + 180 });
}

// ───────────────────────── 批次報告 ─────────────────────────

export type BatchEntry =
  | { readonly ok: true; readonly result: CalibrationResult }
  | { readonly ok: false; readonly missileId: string; readonly error: string };

export interface BatchReport {
  readonly total: number;
  readonly autoPass: number;
  readonly needsReview: number;
  readonly failed: number;
  readonly entries: readonly BatchEntry[];
}

/** 批次校準。單一 missile 的輸入錯誤(如幀數不符)不會中斷整批,而是記為 failed。 */
export function calibrateBatch(
  inputs: readonly MissileFrames[],
  options: Partial<CalibrationOptions> = {},
): BatchReport {
  const entries: BatchEntry[] = inputs.map((input) => {
    try {
      return { ok: true, result: calibrateMissile(input, options) };
    } catch (e) {
      return {
        ok: false,
        missileId: input.missileId,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  });
  let autoPass = 0;
  let needsReview = 0;
  let failed = 0;
  for (const e of entries) {
    if (!e.ok) failed++;
    else if (e.result.calibration.status === 'auto-pass') autoPass++;
    else needsReview++;
  }
  return { total: entries.length, autoPass, needsReview, failed, entries };
}

export function reportToJson(report: BatchReport): string {
  return JSON.stringify(report, null, 2);
}

function mdCell(s: string): string {
  return s.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

/** Markdown 報告:失敗與 needs-review 排在最前面。 */
export function reportToMarkdown(report: BatchReport): string {
  const severity = (e: BatchEntry): number =>
    !e.ok ? 0 : e.result.calibration.status === 'auto-pass' ? 2 : 1;
  const idOf = (e: BatchEntry): string => (e.ok ? e.result.calibration.missileId : e.missileId);
  const sorted = [...report.entries].sort(
    (a, b) => severity(a) - severity(b) || idOf(a).localeCompare(idOf(b)),
  );

  const lines: string[] = [
    '# 方向校準報告',
    '',
    `共 ${report.total} 筆:auto-pass ${report.autoPass}、needs-review ${report.needsReview}、失敗 ${report.failed}`,
    '',
    '| missile | cel | dirs | mode | dir0(°) | cw | 最大殘差(°) | 信心 | 狀態 | 備註 |',
    '|---|---|---|---|---|---|---|---|---|---|',
  ];
  for (const e of sorted) {
    if (!e.ok) {
      lines.push(`| ${mdCell(e.missileId)} | - | - | - | - | - | - | - | **failed** | ${mdCell(e.error)} |`);
      continue;
    }
    const c = e.result.calibration;
    lines.push(
      `| ${mdCell(c.missileId)} | ${mdCell(c.celFile)} | ${c.dirCount} | ${c.rotationMode} | ` +
        `${c.dir0WorldAngle.toFixed(2)} | ${c.clockwise ? 'cw' : 'ccw'} | ` +
        `${c.measure.residualMaxDeg.toFixed(2)} | ${c.measure.confidence.toFixed(2)} | ` +
        `${c.status} | ${mdCell(c.notes ?? '')} |`,
    );
  }
  return lines.join('\n') + '\n';
}
