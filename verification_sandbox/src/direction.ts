/**
 * direction.ts — 離散方向校準型別、JSON Schema、索引 ↔ φ 轉換
 *
 * 嚴禁在此或呼叫端硬編碼偏角。所有「索引 ↔ φ」的對應只由 DirectionCalibration 決定:
 *   clockwise = true  : φ(i) = dir0WorldAngle + i · step
 *   clockwise = false : φ(i) = dir0WorldAngle − i · step
 *   step = 360 / dirCount
 */

import { angularDistance, normalizeDeg } from './geometry.js';

// ───────────────────────── 型別 ─────────────────────────

export const DIR_COUNTS = [1, 8, 16, 32] as const;
export type DirCount = (typeof DIR_COUNTS)[number];

export const ROTATION_MODES = ['discrete', 'none', 'free'] as const;
export type RotationMode = (typeof ROTATION_MODES)[number];

export const CALIBRATION_STATUSES = ['auto-pass', 'needs-review', 'manual-confirmed'] as const;
export type CalibrationStatus = (typeof CALIBRATION_STATUSES)[number];

export const MEASURE_METHODS = ['auto', 'manual'] as const;
export type MeasureMethod = (typeof MEASURE_METHODS)[number];

export interface CalibrationMeasure {
  readonly method: MeasureMethod;
  /** 擬合最大殘差(度)。 */
  readonly residualMaxDeg: number;
  readonly eccentricity: number;
  /** 0 到 1。 */
  readonly confidence: number;
}

export interface DirectionCalibration {
  /** Missiles.txt 的名稱。 */
  readonly missileId: string;
  readonly celFile: string;
  /** 以 DCC 實際方向數為準。 */
  readonly dirCount: DirCount;
  /** 索引 0 對應的 φ(度),範圍 [0, 360)。 */
  readonly dir0WorldAngle: number;
  /** 索引遞增時 φ 是否遞增(視覺順時針)。 */
  readonly clockwise: boolean;
  readonly rotationMode: RotationMode;
  readonly measure: CalibrationMeasure;
  readonly status: CalibrationStatus;
  readonly notes?: string;
}

// ───────────────────────── 核心轉換 ─────────────────────────

function assertDirCount(n: number): asserts n is DirCount {
  if (!(DIR_COUNTS as readonly number[]).includes(n)) {
    throw new RangeError(`dirCount must be one of ${DIR_COUNTS.join(', ')}, got ${n}`);
  }
}

function assertNotFree(c: DirectionCalibration, fn: string): void {
  if (c.rotationMode === 'free') {
    throw new Error(
      `${fn}: rotationMode 'free' has no discrete index; use resolveDirection() instead ` +
        `(missile: ${c.missileId})`,
    );
  }
}

/**
 * φ(度)→ 方向索引 ∈ [0, dirCount)。
 *  - 'none'    → 恆為 0
 *  - 'discrete'→ 以最近格四捨五入;剛好在半步角平手時取較大索引(模 N)
 *  - 'free'    → 丟錯
 * 支援任意實數 φ(含負數與大於 360),輸出必為整數。
 */
export function dirIndex(phi: number, calibration: DirectionCalibration): number {
  assertNotFree(calibration, 'dirIndex');
  if (!Number.isFinite(phi)) {
    throw new RangeError(`phi must be a finite number, got ${phi}`);
  }
  if (calibration.rotationMode === 'none') return 0;

  const n = calibration.dirCount;
  assertDirCount(n);
  if (n === 1) return 0;

  const step = 360 / n;
  // 先轉成「沿索引遞增方向」的相對角,正規化到 [0, 360) 再 floor,
  // 這樣負數與正數的平手規則一致(Math.round 對負數的平手行為不同,故不用)。
  const rel = normalizeDeg(
    calibration.clockwise ? phi - calibration.dir0WorldAngle : calibration.dir0WorldAngle - phi,
  );
  // rel ∈ [0, 360) → floor 結果 ∈ [0, n];n 對應「回繞到 0」
  return Math.floor(rel / step + 0.5) % n;
}

/**
 * 方向索引 → 該格中心的 φ(度,[0, 360))。
 * index 必須是整數;超出範圍會依 dirCount 回繞(-1 等同 dirCount-1)。
 * 'none' 回傳 dir0WorldAngle;'free' 丟錯。
 */
export function indexToPhi(index: number, calibration: DirectionCalibration): number {
  assertNotFree(calibration, 'indexToPhi');
  if (!Number.isInteger(index)) {
    throw new RangeError(`index must be an integer, got ${index}`);
  }
  if (calibration.rotationMode === 'none') return normalizeDeg(calibration.dir0WorldAngle);

  const n = calibration.dirCount;
  assertDirCount(n);

  const i = ((index % n) + n) % n;
  const step = 360 / n;
  const offset = i * step;
  return normalizeDeg(
    calibration.clockwise ? calibration.dir0WorldAngle + offset : calibration.dir0WorldAngle - offset,
  );
}

export type ResolvedDirection =
  | { readonly kind: 'none' }
  | { readonly kind: 'discrete'; readonly index: number; readonly snappedPhi: number }
  | { readonly kind: 'free'; readonly phi: number };

/**
 * 統一入口:依 rotationMode 回傳繪製端該怎麼做。
 * 會配置新物件,適合非熱路徑(載入、除錯疊加層);熱路徑請直接呼叫 dirIndex。
 */
export function resolveDirection(phi: number, c: DirectionCalibration): ResolvedDirection {
  if (!Number.isFinite(phi)) {
    throw new RangeError(`phi must be a finite number, got ${phi}`);
  }
  switch (c.rotationMode) {
    case 'none':
      return { kind: 'none' };
    case 'free':
      return { kind: 'free', phi: normalizeDeg(phi) };
    case 'discrete': {
      const index = dirIndex(phi, c);
      return { kind: 'discrete', index, snappedPhi: indexToPhi(index, c) };
    }
  }
}

/** 理論 φ 與實際貼圖方向之間的量化誤差上限(度)= 半個離散格。 */
export function maxQuantizationErrorDeg(dirCount: DirCount): number {
  return dirCount === 1 ? 180 : 180 / dirCount;
}

/** 便利函式:φ 被吸附到最近離散格後,與原 φ 的誤差(度)。 */
export function snapErrorDeg(phi: number, c: DirectionCalibration): number {
  return angularDistance(phi, indexToPhi(dirIndex(phi, c), c));
}

// ───────────────────────── JSON Schema ─────────────────────────

export const DIRECTION_CALIBRATION_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'DirectionCalibration',
  type: 'object',
  additionalProperties: false,
  required: [
    'missileId',
    'celFile',
    'dirCount',
    'dir0WorldAngle',
    'clockwise',
    'rotationMode',
    'measure',
    'status',
  ],
  properties: {
    missileId: { type: 'string', minLength: 1 },
    celFile: { type: 'string', minLength: 1 },
    dirCount: { type: 'integer', enum: [...DIR_COUNTS] },
    dir0WorldAngle: { type: 'number', minimum: 0, exclusiveMaximum: 360 },
    clockwise: { type: 'boolean' },
    rotationMode: { type: 'string', enum: [...ROTATION_MODES] },
    measure: {
      type: 'object',
      additionalProperties: false,
      required: ['method', 'residualMaxDeg', 'eccentricity', 'confidence'],
      properties: {
        method: { type: 'string', enum: [...MEASURE_METHODS] },
        residualMaxDeg: { type: 'number', minimum: 0 },
        eccentricity: { type: 'number', minimum: 0 },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
      },
    },
    status: { type: 'string', enum: [...CALIBRATION_STATUSES] },
    notes: { type: 'string' },
  },
} as const;

// ───────────────────────── 無依賴驗證器(與 Schema 對應) ─────────────────────────

export type ValidationResult =
  | { readonly ok: true; readonly value: DirectionCalibration }
  | { readonly ok: false; readonly errors: readonly string[] };

const TOP_KEYS = new Set(Object.keys(DIRECTION_CALIBRATION_SCHEMA.properties));
const MEASURE_KEYS = new Set(Object.keys(DIRECTION_CALIBRATION_SCHEMA.properties.measure.properties));

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function isFiniteNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}
function isOneOf<T extends string | number>(list: readonly T[], v: unknown): v is T {
  return (list as readonly unknown[]).includes(v);
}

/** 載入校準 JSON 時使用。不依賴 ajv;規則與 DIRECTION_CALIBRATION_SCHEMA 一致。 */
export function validateCalibration(value: unknown): ValidationResult {
  const errors: string[] = [];
  if (!isRecord(value)) return { ok: false, errors: ['root must be an object'] };

  for (const k of Object.keys(value)) {
    if (!TOP_KEYS.has(k)) errors.push(`unknown property: ${k}`);
  }
  for (const k of DIRECTION_CALIBRATION_SCHEMA.required) {
    if (!(k in value)) errors.push(`missing required property: ${k}`);
  }

  if ('missileId' in value && !(typeof value.missileId === 'string' && value.missileId.length > 0))
    errors.push('missileId must be a non-empty string');
  if ('celFile' in value && !(typeof value.celFile === 'string' && value.celFile.length > 0))
    errors.push('celFile must be a non-empty string');
  if ('dirCount' in value && !isOneOf(DIR_COUNTS, value.dirCount))
    errors.push(`dirCount must be one of ${DIR_COUNTS.join(', ')}`);
  if ('dir0WorldAngle' in value) {
    const a = value.dir0WorldAngle;
    if (!isFiniteNum(a) || a < 0 || a >= 360) errors.push('dir0WorldAngle must be a number in [0, 360)');
  }
  if ('clockwise' in value && typeof value.clockwise !== 'boolean')
    errors.push('clockwise must be a boolean');
  if ('rotationMode' in value && !isOneOf(ROTATION_MODES, value.rotationMode))
    errors.push(`rotationMode must be one of ${ROTATION_MODES.join(', ')}`);
  if ('status' in value && !isOneOf(CALIBRATION_STATUSES, value.status))
    errors.push(`status must be one of ${CALIBRATION_STATUSES.join(', ')}`);
  if ('notes' in value && typeof value.notes !== 'string') errors.push('notes must be a string');

  if ('measure' in value) {
    const m = value.measure;
    if (!isRecord(m)) {
      errors.push('measure must be an object');
    } else {
      for (const k of Object.keys(m)) {
        if (!MEASURE_KEYS.has(k)) errors.push(`unknown property: measure.${k}`);
      }
      for (const k of DIRECTION_CALIBRATION_SCHEMA.properties.measure.required) {
        if (!(k in m)) errors.push(`missing required property: measure.${k}`);
      }
      if ('method' in m && !isOneOf(MEASURE_METHODS, m.method))
        errors.push(`measure.method must be one of ${MEASURE_METHODS.join(', ')}`);
      if ('residualMaxDeg' in m && !(isFiniteNum(m.residualMaxDeg) && m.residualMaxDeg >= 0))
        errors.push('measure.residualMaxDeg must be a number >= 0');
      if ('eccentricity' in m && !(isFiniteNum(m.eccentricity) && m.eccentricity >= 0))
        errors.push('measure.eccentricity must be a number >= 0');
      if ('confidence' in m && !(isFiniteNum(m.confidence) && m.confidence >= 0 && m.confidence <= 1))
        errors.push('measure.confidence must be a number in [0, 1]');
    }
  }

  return errors.length === 0
    ? { ok: true, value: value as unknown as DirectionCalibration }
    : { ok: false, errors };
}
