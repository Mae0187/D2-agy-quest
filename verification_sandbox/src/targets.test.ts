import { describe, expect, it } from 'vitest';
import { screenToPhi } from './geometry.js';
import {
  NO_TARGET,
  PointTarget,
  TargetRegistry,
  UnitTarget,
  groundToPhi,
  groundToScreenInto,
  screenToGroundInto,
  type GroundPoint,
} from './targets.js';

interface MutableUnit {
  x: number;
  y: number;
  alive: boolean;
  team: number;
}
const unit = (x: number, y: number, team = 1, alive = true): MutableUnit => ({ x, y, alive, team });
const pt = (): GroundPoint => ({ x: -999, y: -999 });

describe('coordinate helpers', () => {
  it('Ground ↔ screen round trip is exact', () => {
    const g = { x: 0, y: 0 };
    const s = { x: 0, y: 0 };
    for (const [x, y] of [[0, 0], [10, 20], [-33.5, 71.25], [1e4, -1e4]] as const) {
      groundToScreenInto(x, y, s);
      expect(s.x).toBe(x);
      expect(s.y).toBe(y * 0.5);
      screenToGroundInto(s.x, s.y, g);
      expect(g.x).toBe(x);
      expect(g.y).toBe(y);
    }
  });

  it('groundToPhi agrees with screenToPhi(dx, dy × 0.5) for 360 directions', () => {
    for (let deg = 0; deg < 360; deg++) {
      const dx = Math.cos((deg * Math.PI) / 180) * 50;
      const dy = Math.sin((deg * Math.PI) / 180) * 50;
      expect(groundToPhi(dx, dy)).toBeCloseTo(screenToPhi(dx, dy * 0.5), 9);
    }
  });

  it('axis directions (Y down ⇒ clockwise)', () => {
    expect(groundToPhi(1, 0)).toBeCloseTo(0, 12);
    expect(groundToPhi(0, 1)).toBeCloseTo(90, 12);
    expect(groundToPhi(-1, 0)).toBeCloseTo(180, 12);
    expect(groundToPhi(0, -1)).toBeCloseTo(270, 12);
  });

  it('rejects non-finite input', () => {
    expect(() => groundToPhi(NaN, 0)).toThrow(RangeError);
    expect(() => groundToPhi(0, Infinity)).toThrow(RangeError);
  });
});

describe('PointTarget', () => {
  it('always resolves and can be moved', () => {
    const t = new PointTarget(1, 10, 20);
    const out = pt();
    expect(t.resolve(out)).toBe(true);
    expect(out).toEqual({ x: 10, y: 20 });
    t.set(-5, 6);
    expect(t.resolve(out)).toBe(true);
    expect(out).toEqual({ x: -5, y: 6 });
    expect(t.kind).toBe('point');
  });

  it('rejects non-finite coordinates', () => {
    expect(() => new PointTarget(1, NaN, 0)).toThrow(RangeError);
    expect(() => new PointTarget(1, 0, 0).set(0, Infinity)).toThrow(RangeError);
  });
});

describe('UnitTarget (dynamic tracking)', () => {
  it('follows the unit as it moves', () => {
    const u = unit(0, 0);
    const t = new UnitTarget(1, u);
    const out = pt();
    expect(t.resolve(out)).toBe(true);
    expect(out).toEqual({ x: 0, y: 0 });
    u.x = 100;
    u.y = -40;
    expect(t.resolve(out)).toBe(true);
    expect(out).toEqual({ x: 100, y: -40 });
    expect(t.kind).toBe('unit');
  });

  it('applies the aim offset', () => {
    const u = unit(10, 10);
    const t = new UnitTarget(1, u, 0, -24);
    const out = pt();
    t.resolve(out);
    expect(out).toEqual({ x: 10, y: -14 });
  });

  it('returns false and leaves out untouched once the unit is dead', () => {
    const u = unit(5, 5);
    const t = new UnitTarget(1, u);
    u.alive = false;
    const out = pt();
    expect(t.resolve(out)).toBe(false);
    expect(out).toEqual({ x: -999, y: -999 });
  });

  it('rejects a non-finite aim offset', () => {
    expect(() => new UnitTarget(1, unit(0, 0), NaN, 0)).toThrow(RangeError);
  });
});

describe('TargetRegistry', () => {
  it('assigns increasing ids and never reuses them', () => {
    const r = new TargetRegistry();
    const a = r.createPoint(0, 0);
    const b = r.createPoint(1, 1);
    expect(b.id).toBeGreaterThan(a.id);
    r.remove(a.id);
    const c = r.createPoint(2, 2);
    expect(c.id).toBeGreaterThan(b.id);
    expect(r.has(a.id)).toBe(false);
  });

  it('resolve: NO_TARGET, unknown, removed and dead targets all fail without touching out', () => {
    const r = new TargetRegistry();
    const u = unit(1, 2);
    const t = r.createUnit(u);
    const out = pt();
    expect(r.resolve(NO_TARGET, out)).toBe(false);
    expect(r.resolve(12345, out)).toBe(false);
    expect(out).toEqual({ x: -999, y: -999 });
    expect(r.resolve(t.id, out)).toBe(true);
    expect(out).toEqual({ x: 1, y: 2 });
    u.alive = false;
    expect(r.resolve(t.id, out)).toBe(false);
    u.alive = true;
    r.remove(t.id);
    expect(r.resolve(t.id, out)).toBe(false);
  });

  it('swap-remove keeps every other target resolvable', () => {
    const r = new TargetRegistry();
    const targets = [0, 1, 2, 3, 4].map((i) => r.createPoint(i * 10, i));
    expect(r.remove(targets[1]!.id)).toBe(true);
    expect(r.remove(targets[1]!.id)).toBe(false);
    expect(r.size).toBe(4);
    const out = pt();
    for (const i of [0, 2, 3, 4]) {
      expect(r.resolve(targets[i]!.id, out)).toBe(true);
      expect(out).toEqual({ x: i * 10, y: i });
    }
    r.remove(targets[4]!.id); // 移除最後一個
    expect(r.size).toBe(3);
    expect(r.resolve(targets[3]!.id, out)).toBe(true);
  });

  it('clear() invalidates old ids even after new targets are created', () => {
    const r = new TargetRegistry();
    const a = r.createPoint(0, 0);
    r.clear();
    expect(r.size).toBe(0);
    const b = r.createPoint(9, 9);
    expect(b.id).not.toBe(a.id);
    expect(r.resolve(a.id, pt())).toBe(false);
  });

  describe('findNearestUnit', () => {
    it('picks the nearest living unit of the requested team within the radius', () => {
      const r = new TargetRegistry();
      const near = r.createUnit(unit(30, 0, 1));
      r.createUnit(unit(60, 0, 1));
      const enemyTeam = r.createUnit(unit(10, 0, 2));
      const dead = r.createUnit(unit(5, 0, 1, false));
      r.createPoint(1, 0); // 定點目標不是單位,不應被選中

      expect(r.findNearestUnit(0, 0, 100, 1)).toBe(near.id);
      expect(r.findNearestUnit(0, 0, 100, 2)).toBe(enemyTeam.id);
      expect(r.findNearestUnit(0, 0, 100, 3)).toBe(NO_TARGET);
      expect(r.findNearestUnit(0, 0, 20, 1)).toBe(NO_TARGET);
      expect(r.has(dead.id)).toBe(true);
    });

    it('radius is inclusive and excludeId is honoured', () => {
      const r = new TargetRegistry();
      const a = r.createUnit(unit(50, 0));
      const b = r.createUnit(unit(80, 0));
      expect(r.findNearestUnit(0, 0, 50, 1)).toBe(a.id);
      expect(r.findNearestUnit(0, 0, 100, 1, a.id)).toBe(b.id);
    });

    it('follows moving units', () => {
      const r = new TargetRegistry();
      const u1 = unit(30, 0);
      const u2 = unit(60, 0);
      const t1 = r.createUnit(u1);
      const t2 = r.createUnit(u2);
      expect(r.findNearestUnit(0, 0, 100, 1)).toBe(t1.id);
      u1.x = 90;
      u2.x = 20;
      expect(r.findNearestUnit(0, 0, 100, 1)).toBe(t2.id);
    });

    it('ties are broken by the smaller id, independent of internal list order', () => {
      const r = new TargetRegistry();
      const a = r.createUnit(unit(500, 500));
      const b = r.createUnit(unit(40, 0));
      const c = r.createUnit(unit(0, 40));
      r.remove(a.id); // 交換移除後,內部順序變成 [c, b]
      expect(r.findNearestUnit(0, 0, 100, 1)).toBe(b.id);
      expect(b.id).toBeLessThan(c.id);
    });

    it('rejects invalid arguments', () => {
      const r = new TargetRegistry();
      expect(() => r.findNearestUnit(0, 0, -1, 1)).toThrow(RangeError);
      expect(() => r.findNearestUnit(NaN, 0, 10, 1)).toThrow(RangeError);
      expect(() => r.findNearestUnit(0, 0, Infinity, 1)).toThrow(RangeError);
    });
  });

  describe('phiToTarget', () => {
    it('returns the Ground bearing to the target', () => {
      const r = new TargetRegistry();
      const right = r.createPoint(100, 0);
      const down = r.createPoint(0, 100);
      expect(r.phiToTarget(right.id, 0, 0, 77)).toBeCloseTo(0, 12);
      expect(r.phiToTarget(down.id, 0, 0, 77)).toBeCloseTo(90, 12);
      expect(r.phiToTarget(down.id, 0, 200, 77)).toBeCloseTo(270, 12);
    });

    it('falls back when the target is gone, absent, or coincident with the origin', () => {
      const r = new TargetRegistry();
      const u = unit(10, 10);
      const t = r.createUnit(u);
      expect(r.phiToTarget(NO_TARGET, 0, 0, 33)).toBe(33);
      expect(r.phiToTarget(t.id, 10, 10, 33)).toBe(33);
      u.alive = false;
      expect(r.phiToTarget(t.id, 0, 0, 33)).toBe(33);
    });
  });
});
