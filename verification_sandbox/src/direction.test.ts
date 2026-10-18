import { describe, expect, it } from 'vitest';
import {
  DIRECTION_CALIBRATION_SCHEMA,
  DIR_COUNTS,
  dirIndex,
  indexToPhi,
  resolveDirection,
  snapErrorDeg,
  validateCalibration,
  type DirCount,
  type DirectionCalibration,
} from './direction.js';
import { RAD2DEG, angularDistance, normalizeDeg, phiToScreenVelocity } from './geometry.js';

function makeCal(overrides: Partial<DirectionCalibration> = {}): DirectionCalibration {
  return {
    missileId: 'test_missile',
    celFile: 'test.dcc',
    dirCount: 16,
    dir0WorldAngle: 0,
    clockwise: true,
    rotationMode: 'discrete',
    measure: { method: 'manual', residualMaxDeg: 0, eccentricity: 2, confidence: 1 },
    status: 'manual-confirmed',
    ...overrides,
  };
}

// 可重現的偽隨機(mulberry32)
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

const DISCRETE_COUNTS = [8, 16, 32] as const;
const DIR0S = [0, 45, 135, 160, 270] as const;
const CLOCKWISES = [true, false] as const;

const COMBOS = DISCRETE_COUNTS.flatMap((n) =>
  CLOCKWISES.flatMap((cw) => DIR0S.map((d0) => ({ n, cw, d0 }))),
);

// ───────────────────────── 手算表格(10+ 組) ─────────────────────────

describe('explicit vector table', () => {
  const rows: Array<[n: DirCount, cw: boolean, d0: number, phi: number, expected: number]> = [
    [8, true, 0, 0, 0],
    [8, true, 0, 22.49, 0],
    [8, true, 0, 22.5, 1], // 平手 → 較大索引
    [8, true, 0, 337.49, 7],
    [8, true, 0, 337.5, 0], // 回繞
    [8, false, 0, 90, 6], // 逆時針:rel = 270°
    [8, false, 0, 350, 0],
    [16, true, 160, 160, 0],
    [16, true, 160, 171.25, 1],
    [16, true, 160, 148.75, 0], // 平手落在回繞邊界
    [16, true, 160, 148.74, 15],
    [16, false, 270, 0, 12],
    [16, true, 0, -22.5, 15], // 負角度
    [1, true, 77, 123.4, 0], // 單方向
  ];
  it.each(rows)('dirCount=%i cw=%s dir0=%f φ=%f → %i', (n, cw, d0, phi, expected) => {
    const c = makeCal({ dirCount: n, clockwise: cw, dir0WorldAngle: d0 });
    expect(dirIndex(phi, c)).toBe(expected);
  });
});

// ───────────────────────── 半步角邊界(程式生成) ─────────────────────────

describe.each(COMBOS)('half-step boundaries: dirCount=$n clockwise=$cw dir0=$d0', ({ n, cw, d0 }) => {
  const c = makeCal({ dirCount: n, clockwise: cw, dir0WorldAngle: d0 });
  const step = 360 / n;
  const s = cw ? 1 : -1; // 索引遞增時 φ 的移動方向

  it('index flips exactly at every half-step (±0.5°), ties go to the next index', () => {
    for (let k = 0; k < n; k++) {
      const boundary = d0 + s * (k + 0.5) * step; // 索引 k 與 k+1 的分界
      expect(dirIndex(boundary - s * 0.5, c)).toBe(k);
      expect(dirIndex(boundary + s * 0.5, c)).toBe((k + 1) % n);
      expect(dirIndex(boundary, c)).toBe((k + 1) % n);
    }
  });

  it('every cell centre and ±0.49·step around it map to the same index', () => {
    for (let i = 0; i < n; i++) {
      const centre = indexToPhi(i, c);
      expect(dirIndex(centre, c)).toBe(i);
      expect(dirIndex(centre + 0.49 * step, c)).toBe(i);
      expect(dirIndex(centre - 0.49 * step, c)).toBe(i);
    }
  });

  it('indexToPhi(dirIndex(φ)) is within half a step of φ (every 5° and off-grid 0.37° offsets)', () => {
    for (let phi = 0; phi < 360; phi += 5) {
      for (const p of [phi, phi + 0.37]) {
        expect(snapErrorDeg(p, c)).toBeLessThanOrEqual(step / 2 + 1e-9);
      }
    }
  });

  it('index 0 sits at dir0WorldAngle and increments in the declared direction', () => {
    expect(angularDistance(indexToPhi(0, c), d0)).toBeLessThan(1e-9);
    expect(angularDistance(indexToPhi(1, c), d0 + s * step)).toBeLessThan(1e-9);
  });
});

// ───────────────────────── wrap-around 整數安全 ─────────────────────────

describe('wrap-around & integer safety', () => {
  const SPECIAL = [
    -0, 0, 360, -360, 720.5, -720.5, 1e-300, -1e-300, -1e-14, 359.99999999999994,
    Number.MAX_SAFE_INTEGER, -Number.MAX_SAFE_INTEGER, 1e6, -1e6,
  ];

  it.each(COMBOS)('special values: n=$n cw=$cw dir0=$d0', ({ n, cw, d0 }) => {
    const c = makeCal({ dirCount: n, clockwise: cw, dir0WorldAngle: d0 });
    for (const phi of SPECIAL) {
      const idx = dirIndex(phi, c);
      expect(Number.isInteger(idx)).toBe(true);
      expect(Object.is(idx, -0)).toBe(false);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(n);
    }
  });

  it('fuzz: 20,000 random φ ∈ [-1e6, 1e6] across all combos stay in [0, n)', () => {
    const rnd = mulberry32(0xd2d2d2);
    for (let i = 0; i < 20_000; i++) {
      const combo = COMBOS[Math.floor(rnd() * COMBOS.length)]!;
      const c = makeCal({ dirCount: combo.n, clockwise: combo.cw, dir0WorldAngle: combo.d0 });
      const phi = (rnd() * 2 - 1) * 1e6;
      const idx = dirIndex(phi, c);
      expect(Number.isInteger(idx)).toBe(true);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(combo.n);
    }
  });

  it('φ and φ ± 360k give the same index', () => {
    const c = makeCal({ dirCount: 16, clockwise: false, dir0WorldAngle: 160 });
    for (const phi of [0, 13.7, 99, 200.2, 359]) {
      const base = dirIndex(phi, c);
      expect(dirIndex(phi + 360, c)).toBe(base);
      expect(dirIndex(phi - 720, c)).toBe(base);
    }
  });

  it('indexToPhi wraps out-of-range integer indices and always returns [0, 360)', () => {
    const c = makeCal({ dirCount: 8, clockwise: true, dir0WorldAngle: 45 });
    expect(angularDistance(indexToPhi(-1, c), indexToPhi(7, c))).toBeLessThan(1e-9);
    expect(angularDistance(indexToPhi(8, c), indexToPhi(0, c))).toBeLessThan(1e-9);
    expect(angularDistance(indexToPhi(-17, c), indexToPhi(7, c))).toBeLessThan(1e-9);
    for (let i = -40; i <= 40; i++) {
      const p = indexToPhi(i, c);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThan(360);
    }
  });
});

// ───────────────────────── 特殊模式與錯誤處理 ─────────────────────────

describe('rotationMode & error handling', () => {
  it('dirCount = 1 always returns 0 for any φ and both clockwise values', () => {
    for (const cw of CLOCKWISES) {
      const c = makeCal({ dirCount: 1, clockwise: cw, dir0WorldAngle: 123 });
      for (const phi of [0, 90, 180, 270, -33, 1e5]) expect(dirIndex(phi, c)).toBe(0);
    }
  });

  it("'none' returns index 0 and dir0 as φ", () => {
    const c = makeCal({ rotationMode: 'none', dirCount: 16, dir0WorldAngle: 40 });
    expect(dirIndex(200, c)).toBe(0);
    expect(indexToPhi(5, c)).toBeCloseTo(40, 12);
  });

  it("'free' throws on dirIndex / indexToPhi", () => {
    const c = makeCal({ rotationMode: 'free' });
    expect(() => dirIndex(10, c)).toThrow(/free/);
    expect(() => indexToPhi(0, c)).toThrow(/free/);
  });

  it('resolveDirection dispatches by rotationMode', () => {
    const d = resolveDirection(100, makeCal({ dirCount: 8, dir0WorldAngle: 0 }));
    expect(d).toEqual({ kind: 'discrete', index: 2, snappedPhi: 90 });
    expect(resolveDirection(100, makeCal({ rotationMode: 'none' }))).toEqual({ kind: 'none' });
    const f = resolveDirection(-10, makeCal({ rotationMode: 'free' }));
    expect(f.kind).toBe('free');
    if (f.kind === 'free') expect(f.phi).toBeCloseTo(350, 12);
  });

  it('rejects invalid dirCount, non-finite φ and non-integer index', () => {
    expect(() => dirIndex(0, makeCal({ dirCount: 12 as never }))).toThrow(RangeError);
    expect(() => indexToPhi(0, makeCal({ dirCount: 4 as never }))).toThrow(RangeError);
    expect(() => dirIndex(NaN, makeCal())).toThrow(RangeError);
    expect(() => dirIndex(Infinity, makeCal())).toThrow(RangeError);
    expect(() => indexToPhi(1.5, makeCal())).toThrow(RangeError);
    expect(() => indexToPhi(NaN, makeCal())).toThrow(RangeError);
  });
});

// ───────────────────────── 端到端:螢幕向量 → 方向索引 ─────────────────────────

describe('end-to-end with screen vectors', () => {
  it('dirIndex(screenToPhi(velocity)) recovers the cell for every combo and every 5°', () => {
    for (const { n, cw, d0 } of COMBOS) {
      const c = makeCal({ dirCount: n, clockwise: cw, dir0WorldAngle: d0 });
      for (let phi = 0; phi < 360; phi += 5) {
        const { vx, vy } = phiToScreenVelocity(phi, 3);
        const phiBack = normalizeDeg(Math.atan2(vy * 2, vx) * RAD2DEG);
        expect(dirIndex(phiBack, c)).toBe(dirIndex(phi, c));
      }
    }
  });

  it('using the wrong formula atan2(dy, dx) picks a wrong cell for some angles (16 dirs)', () => {
    const c = makeCal({ dirCount: 16 });
    let mismatches = 0;
    for (let phi = 0; phi < 360; phi += 1) {
      const { vx, vy } = phiToScreenVelocity(phi, 1);
      const wrong = normalizeDeg(Math.atan2(vy, vx) * RAD2DEG);
      if (dirIndex(wrong, c) !== dirIndex(phi, c)) mismatches++;
    }
    expect(mismatches).toBeGreaterThan(0);
  });
});

// ───────────────────────── JSON Schema 與驗證器 ─────────────────────────

describe('schema & validator', () => {
  it('schema enums stay in sync with exported constants', () => {
    expect([...DIRECTION_CALIBRATION_SCHEMA.properties.dirCount.enum]).toEqual([...DIR_COUNTS]);
    expect(DIRECTION_CALIBRATION_SCHEMA.properties.dir0WorldAngle.exclusiveMaximum).toBe(360);
  });

  it('accepts a valid calibration', () => {
    const r = validateCalibration(makeCal());
    expect(r.ok).toBe(true);
  });

  it('accepts optional notes', () => {
    expect(validateCalibration(makeCal({ notes: 'hand verified' })).ok).toBe(true);
  });

  const bad: Array<[string, unknown]> = [
    ['non-object root', 42],
    ['dirCount 12', { ...makeCal(), dirCount: 12 }],
    ['dirCount as string', { ...makeCal(), dirCount: '16' }],
    ['dir0 = 360', { ...makeCal(), dir0WorldAngle: 360 }],
    ['dir0 = -1', { ...makeCal(), dir0WorldAngle: -1 }],
    ['dir0 NaN', { ...makeCal(), dir0WorldAngle: NaN }],
    ['clockwise as string', { ...makeCal(), clockwise: 'true' }],
    ['bad rotationMode', { ...makeCal(), rotationMode: 'spin' }],
    ['bad status', { ...makeCal(), status: 'ok' }],
    ['confidence 1.5', { ...makeCal(), measure: { ...makeCal().measure, confidence: 1.5 } }],
    ['negative residual', { ...makeCal(), measure: { ...makeCal().measure, residualMaxDeg: -1 } }],
    ['bad measure.method', { ...makeCal(), measure: { ...makeCal().measure, method: 'guess' } }],
    ['unknown property', { ...makeCal(), extra: 1 }],
    ['unknown measure property', { ...makeCal(), measure: { ...makeCal().measure, foo: 1 } }],
    ['empty missileId', { ...makeCal(), missileId: '' }],
  ];
  it.each(bad)('rejects: %s', (_label, value) => {
    const r = validateCalibration(value);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.length).toBeGreaterThan(0);
  });

  it('reports every missing required property', () => {
    const r = validateCalibration({});
    expect(r.ok).toBe(false);
    if (!r.ok) {
      for (const k of DIRECTION_CALIBRATION_SCHEMA.required) {
        expect(r.errors.some((e) => e.includes(k))).toBe(true);
      }
    }
  });
});
