import { describe, expect, it } from 'vitest';
import {
  BLEND_MODES,
  BLEND_TABLE,
  applyBlend,
  applyDrawStyle,
  assertBlendMode,
  compositeOpFor,
  effectiveAlpha,
  isAdditive,
  isBlendMode,
  resolveBlend,
  type BlendContext,
  type BlendMode,
  type CompositeOp,
} from './blend.js';

function fakeCtx(): BlendContext {
  return { globalCompositeOperation: 'source-over', globalAlpha: 1 };
}

describe('blend table', () => {
  const expected: Array<[BlendMode, CompositeOp, number]> = [
    ['normal', 'source-over', 1],
    ['alpha25', 'source-over', 0.25],
    ['alpha50', 'source-over', 0.5],
    ['alpha75', 'source-over', 0.75],
    ['additive', 'lighter', 1],
    ['screen', 'screen', 1],
    ['luminance', 'source-over', 1],
    ['multiply', 'multiply', 1],
    ['shadow', 'source-over', 0.5],
  ];

  it.each(expected)('%s → %s, alpha %f', (mode, op, alpha) => {
    expect(compositeOpFor(mode)).toBe(op);
    expect(resolveBlend(mode).alpha).toBe(alpha);
  });

  it('expected table covers every BlendMode exactly once', () => {
    expect(expected.map((e) => e[0]).sort()).toEqual([...BLEND_MODES].sort());
  });

  it('table entries are frozen and alphas are within [0, 1]', () => {
    expect(Object.isFrozen(BLEND_TABLE)).toBe(true);
    for (const m of BLEND_MODES) {
      expect(Object.isFrozen(BLEND_TABLE[m])).toBe(true);
      expect(BLEND_TABLE[m].alpha).toBeGreaterThanOrEqual(0);
      expect(BLEND_TABLE[m].alpha).toBeLessThanOrEqual(1);
    }
  });

  it("only 'additive' uses 'lighter'", () => {
    for (const m of BLEND_MODES) expect(isAdditive(m)).toBe(m === 'additive');
  });

  it('resolveBlend returns the shared object (zero allocation)', () => {
    expect(resolveBlend('additive')).toBe(resolveBlend('additive'));
  });
});

describe('effectiveAlpha', () => {
  it('multiplies base alpha by the override', () => {
    expect(effectiveAlpha('alpha50', 0.5)).toBeCloseTo(0.25, 12);
    expect(effectiveAlpha('normal')).toBe(1);
    expect(effectiveAlpha('additive', 0.3)).toBeCloseTo(0.3, 12);
  });

  it('clamps to [0, 1]', () => {
    expect(effectiveAlpha('normal', 7)).toBe(1);
    expect(effectiveAlpha('normal', -2)).toBe(0);
  });

  it('rejects non-finite alpha', () => {
    expect(() => effectiveAlpha('normal', NaN)).toThrow(RangeError);
    expect(() => effectiveAlpha('normal', Infinity)).toThrow(RangeError);
  });
});

describe('applyBlend / applyDrawStyle', () => {
  it('sets composite operation and globalAlpha', () => {
    const ctx = fakeCtx();
    applyBlend(ctx, 'additive');
    expect(ctx.globalCompositeOperation).toBe('lighter');
    expect(ctx.globalAlpha).toBe(1);

    applyBlend(ctx, 'alpha75', 0.5);
    expect(ctx.globalCompositeOperation).toBe('source-over');
    expect(ctx.globalAlpha).toBeCloseTo(0.375, 12);
  });

  it('switching back to normal fully resets the state (no leakage from additive)', () => {
    const ctx = fakeCtx();
    applyBlend(ctx, 'additive', 0.2);
    applyBlend(ctx, 'normal');
    expect(ctx.globalCompositeOperation).toBe('source-over');
    expect(ctx.globalAlpha).toBe(1);
  });

  it('applyDrawStyle uses style.alpha (default 1) and ignores palette fields', () => {
    const ctx = fakeCtx();
    applyDrawStyle(ctx, { blend: 'screen', alpha: 0.4, paletteShift: 'freeze', tint: [1, 2, 3] });
    expect(ctx.globalCompositeOperation).toBe('screen');
    expect(ctx.globalAlpha).toBeCloseTo(0.4, 12);
    applyDrawStyle(ctx, { blend: 'multiply' });
    expect(ctx.globalCompositeOperation).toBe('multiply');
    expect(ctx.globalAlpha).toBe(1);
  });
});

describe('guards', () => {
  it('isBlendMode accepts only known strings', () => {
    for (const m of BLEND_MODES) expect(isBlendMode(m)).toBe(true);
    for (const bad of ['Additive', 'lighter', '', 1, null, undefined, {}]) {
      expect(isBlendMode(bad)).toBe(false);
    }
  });

  it('assertBlendMode throws on unknown values', () => {
    expect(() => assertBlendMode('additive')).not.toThrow();
    expect(() => assertBlendMode('glow')).toThrow(RangeError);
  });
});
