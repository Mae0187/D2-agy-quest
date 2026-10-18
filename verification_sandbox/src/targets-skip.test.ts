import { describe, expect, it } from 'vitest';
import { NO_TARGET, TargetRegistry } from './targets.js';
import { makeUnit } from './testkit.js';

describe('TargetRegistry.findNearestUnitSkipping', () => {
  function setup() {
    const reg = new TargetRegistry();
    const a = reg.createUnit(makeUnit(10, 0));
    const b = reg.createUnit(makeUnit(20, 0));
    const c = reg.createUnit(makeUnit(30, 0));
    return { reg, a, b, c };
  }

  it('with an empty skip list it equals findNearestUnit', () => {
    const { reg, a } = setup();
    const skip = new Int32Array(4).fill(NO_TARGET);
    expect(reg.findNearestUnitSkipping(0, 0, 100, 1, skip, 0, 0)).toBe(a.id);
    expect(reg.findNearestUnitSkipping(0, 0, 100, 1, skip, 0, 0)).toBe(reg.findNearestUnit(0, 0, 100, 1));
  });

  it('skips listed ids and falls through to the next nearest', () => {
    const { reg, a, b, c } = setup();
    const skip = new Int32Array([a.id, b.id, NO_TARGET]);
    expect(reg.findNearestUnitSkipping(0, 0, 100, 1, skip, 0, 1)).toBe(b.id);
    expect(reg.findNearestUnitSkipping(0, 0, 100, 1, skip, 0, 2)).toBe(c.id);
    skip[2] = c.id;
    expect(reg.findNearestUnitSkipping(0, 0, 100, 1, skip, 0, 3)).toBe(NO_TARGET);
  });

  it('honours the offset window (entries outside the window are ignored)', () => {
    const { reg, a, b } = setup();
    const skip = new Int32Array([a.id, NO_TARGET, NO_TARGET, b.id]);
    expect(reg.findNearestUnitSkipping(0, 0, 100, 1, skip, 1, 2)).toBe(a.id);
    expect(reg.findNearestUnitSkipping(0, 0, 100, 1, skip, 3, 1)).toBe(a.id);
    expect(reg.findNearestUnitSkipping(0, 0, 100, 1, skip, 0, 1)).toBe(b.id);
  });

  it('still respects team, radius and liveness', () => {
    const reg = new TargetRegistry();
    const dead = makeUnit(5, 0, 1, false);
    reg.createUnit(dead);
    reg.createUnit(makeUnit(8, 0, 2));
    const far = reg.createUnit(makeUnit(90, 0, 1));
    const skip = new Int32Array(1);
    expect(reg.findNearestUnitSkipping(0, 0, 50, 1, skip, 0, 0)).toBe(NO_TARGET);
    expect(reg.findNearestUnitSkipping(0, 0, 100, 1, skip, 0, 0)).toBe(far.id);
  });

  it('rejects invalid arguments', () => {
    const { reg } = setup();
    const skip = new Int32Array(2);
    expect(() => reg.findNearestUnitSkipping(NaN, 0, 1, 1, skip, 0, 0)).toThrow(RangeError);
    expect(() => reg.findNearestUnitSkipping(0, 0, -1, 1, skip, 0, 0)).toThrow(RangeError);
    expect(() => reg.findNearestUnitSkipping(0, 0, 1, 1, skip, 1, 2)).toThrow(RangeError);
    expect(() => reg.findNearestUnitSkipping(0, 0, 1, 1, skip, -1, 1)).toThrow(RangeError);
    expect(() => reg.findNearestUnitSkipping(0, 0, 1, 1, skip, 0, 1.5)).toThrow(RangeError);
  });
});
