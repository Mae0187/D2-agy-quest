/**
 * targets.ts — 目標抽象(定點目標與可移動單位目標)
 *
 * 座標空間:全部是 Ground(地面未壓縮平面)。
 *   螢幕 → Ground:gx = sx,gy = sy × 2
 *   Ground → 螢幕:sx = gx,sy = gy × 0.5   (只在繪製前最後一步做)
 *
 * 設計重點:
 *  - 投射物只儲存數字 targetId,不持有目標物件引用,避免懸空引用,也方便物件池重用。
 *  - id 單調遞增、永不重用,過期的 id 一律解析失敗,不會誤指到新目標。
 *  - resolve() 把座標寫入呼叫端提供的 out,熱路徑零配置。
 *  - 目標已失效時 resolve() 回傳 false,且不修改 out。
 */

import { ISO_Y_SCALE, ISO_Y_UNSQUASH, RAD2DEG, normalizeDeg } from './geometry.js';

export const NO_TARGET = -1;

export interface GroundPoint {
  x: number;
  y: number;
}

export interface ScreenPoint {
  x: number;
  y: number;
}

// ───────────────────────── 座標空間輔助 ─────────────────────────

export function groundToScreenInto(gx: number, gy: number, out: ScreenPoint): ScreenPoint {
  out.x = gx;
  out.y = gy * ISO_Y_SCALE;
  return out;
}

export function screenToGroundInto(sx: number, sy: number, out: GroundPoint): GroundPoint {
  out.x = sx;
  out.y = sy * ISO_Y_UNSQUASH;
  return out;
}

/**
 * Ground 平面位移 → φ(度,[0, 360))。與 screenToPhi(dx, dy × 0.5) 等價。
 * (0, 0) 沒有方向,回傳 0;呼叫端若需要區分請自行檢查。
 */
export function groundToPhi(dx: number, dy: number): number {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) {
    throw new RangeError(`dx, dy must be finite, got (${dx}, ${dy})`);
  }
  return normalizeDeg(Math.atan2(dy, dx) * RAD2DEG);
}

// ───────────────────────── 目標介面 ─────────────────────────

export type TargetKind = 'point' | 'unit';

export interface Target {
  readonly id: number;
  readonly kind: TargetKind;
  /** 把目標目前的 Ground 座標寫入 out。目標失效時回傳 false 且不修改 out。 */
  resolve(out: GroundPoint): boolean;
}

/** 單位目標需要的最小資料。實際的怪物/英雄物件只要有這些欄位即可。 */
export interface TrackableUnit {
  readonly x: number;
  readonly y: number;
  readonly alive: boolean;
  /** 陣營編號(小整數)。索敵時只挑符合的陣營。 */
  readonly team: number;
}

function assertFinitePair(x: number, y: number, what: string): void {
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new RangeError(`${what} must be finite, got (${x}, ${y})`);
  }
}

/** 定點目標(如地面落點、玩家點擊位置)。永遠有效。 */
export class PointTarget implements Target {
  readonly kind = 'point' as const;
  private px: number;
  private py: number;

  constructor(
    readonly id: number,
    x: number,
    y: number,
  ) {
    assertFinitePair(x, y, 'point');
    this.px = x;
    this.py = y;
  }

  set(x: number, y: number): void {
    assertFinitePair(x, y, 'point');
    this.px = x;
    this.py = y;
  }

  resolve(out: GroundPoint): boolean {
    out.x = this.px;
    out.y = this.py;
    return true;
  }
}

/** 可移動單位目標:每次 resolve() 都讀取單位當下的座標,加上瞄準偏移(例如瞄軀幹而非腳底)。 */
export class UnitTarget implements Target {
  readonly kind = 'unit' as const;
  readonly offsetX: number;
  readonly offsetY: number;

  constructor(
    readonly id: number,
    readonly unit: TrackableUnit,
    offsetX = 0,
    offsetY = 0,
  ) {
    assertFinitePair(offsetX, offsetY, 'aim offset');
    this.offsetX = offsetX;
    this.offsetY = offsetY;
  }

  get team(): number {
    return this.unit.team;
  }

  resolve(out: GroundPoint): boolean {
    if (!this.unit.alive) return false;
    out.x = this.unit.x + this.offsetX;
    out.y = this.unit.y + this.offsetY;
    return true;
  }
}

// ───────────────────────── 註冊表 ─────────────────────────

/**
 * 目標註冊表:以數字 id 查詢目標。
 * 內部用「密集陣列 + 交換移除」,所以索敵迴圈不產生迭代器配置;
 * 且索敵的平手規則以 id 決定,與註冊或移除順序無關,保證確定性。
 */
export class TargetRegistry {
  private readonly list: Target[] = [];
  private readonly slot = new Map<number, number>();
  private readonly scratch: GroundPoint = { x: 0, y: 0 };
  private nextId = 1;

  get size(): number {
    return this.list.length;
  }

  createPoint(x: number, y: number): PointTarget {
    const t = new PointTarget(this.nextId, x, y);
    this.register(t);
    return t;
  }

  createUnit(unit: TrackableUnit, offsetX = 0, offsetY = 0): UnitTarget {
    const t = new UnitTarget(this.nextId, unit, offsetX, offsetY);
    this.register(t);
    return t;
  }

  private register(t: Target): void {
    this.nextId++;
    this.slot.set(t.id, this.list.length);
    this.list.push(t);
  }

  get(id: number): Target | undefined {
    const idx = this.slot.get(id);
    return idx === undefined ? undefined : this.list[idx];
  }

  has(id: number): boolean {
    return this.slot.has(id);
  }

  /** 移除目標。回傳是否真的移除。id 不會被重用。 */
  remove(id: number): boolean {
    const idx = this.slot.get(id);
    if (idx === undefined) return false;
    const lastIdx = this.list.length - 1;
    const last = this.list[lastIdx]!;
    this.list[idx] = last;
    this.slot.set(last.id, idx);
    this.list.pop();
    this.slot.delete(id);
    return true;
  }

  /** 清空全部目標;id 計數器不重置,舊 id 永遠失效。 */
  clear(): void {
    this.list.length = 0;
    this.slot.clear();
  }

  /** NO_TARGET、未註冊、已移除或單位已死亡,一律回傳 false 且不修改 out。 */
  resolve(id: number, out: GroundPoint): boolean {
    if (id === NO_TARGET) return false;
    const t = this.get(id);
    return t !== undefined && t.resolve(out);
  }

  /**
   * 從 (x, y) 看向目標的 φ(度)。目標失效或與出發點重合(沒有方向)時回傳 fallbackPhi。
   * 零配置。
   */
  phiToTarget(id: number, fromX: number, fromY: number, fallbackPhi: number): number {
    if (!this.resolve(id, this.scratch)) return fallbackPhi;
    const dx = this.scratch.x - fromX;
    const dy = this.scratch.y - fromY;
    if (dx === 0 && dy === 0) return fallbackPhi;
    return groundToPhi(dx, dy);
  }

  /**
   * 在半徑內找最近的存活單位(只看指定陣營)。找不到回傳 NO_TARGET。
   * 距離相同時 id 較小者優先。零配置。
   */
  findNearestUnit(
    x: number,
    y: number,
    radius: number,
    team: number,
    excludeId: number = NO_TARGET,
  ): number {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(radius) || radius < 0) {
      throw new RangeError(`invalid search (x=${x}, y=${y}, radius=${radius})`);
    }
    const r2 = radius * radius;
    let bestId = NO_TARGET;
    let bestD2 = Infinity;
    const p = this.scratch;
    for (let i = 0; i < this.list.length; i++) {
      const t = this.list[i]!;
      if (!(t instanceof UnitTarget) || t.team !== team || t.id === excludeId) continue;
      if (!t.resolve(p)) continue;
      const dx = p.x - x;
      const dy = p.y - y;
      const d2 = dx * dx + dy * dy;
      if (d2 > r2) continue;
      if (d2 < bestD2 || (d2 === bestD2 && t.id < bestId)) {
        bestD2 = d2;
        bestId = t.id;
      }
    }
    return bestId;
  }

  /**
   * 同 findNearestUnit,但略過 skip[skipOffset .. skipOffset+skipCount) 內列出的 id。
   * 供穿透投射物「每個目標只命中一次」使用。零配置。
   */
  findNearestUnitSkipping(
    x: number,
    y: number,
    radius: number,
    team: number,
    skip: Int32Array,
    skipOffset: number,
    skipCount: number,
  ): number {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(radius) || radius < 0) {
      throw new RangeError(`invalid search (x=${x}, y=${y}, radius=${radius})`);
    }
    if (
      !Number.isInteger(skipOffset) ||
      !Number.isInteger(skipCount) ||
      skipOffset < 0 ||
      skipCount < 0 ||
      skipOffset + skipCount > skip.length
    ) {
      throw new RangeError(`invalid skip range (${skipOffset}, ${skipCount}) for length ${skip.length}`);
    }
    const r2 = radius * radius;
    let bestId = NO_TARGET;
    let bestD2 = Infinity;
    const p = this.scratch;
    for (let i = 0; i < this.list.length; i++) {
      const t = this.list[i]!;
      if (!(t instanceof UnitTarget) || t.team !== team) continue;
      let skipped = false;
      for (let k = 0; k < skipCount; k++) {
        if (skip[skipOffset + k] === t.id) {
          skipped = true;
          break;
        }
      }
      if (skipped) continue;
      if (!t.resolve(p)) continue;
      const dx = p.x - x;
      const dy = p.y - y;
      const d2 = dx * dx + dy * dy;
      if (d2 > r2) continue;
      if (d2 < bestD2 || (d2 === bestD2 && t.id < bestId)) {
        bestD2 = d2;
        bestId = t.id;
      }
    }
    return bestId;
  }
}
