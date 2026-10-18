/**
 * geometry.ts — 2:1 等距投影的座標核心(純數學,無 DOM 依賴)
 *
 * 約定:
 *  - 螢幕座標:X 向右,Y 向下,單位為像素。
 *  - φ(phi):地面平面角,單位為「度」。φ = atan2(dy * 2, dx)。
 *      φ = 0   → 螢幕正右方
 *      φ = 90  → 螢幕正下方(因 Y 向下,φ 遞增 = 視覺順時針)
 *  - 行為層速度一律是「地面未壓縮」像素/tick;只有在轉成螢幕速度時 Y 才乘 0.5。
 *  - 這裡的 φ 不是 D2 世界座標軸角(世界軸相對螢幕旋轉 45°),請勿混用。
 */

export const DEG2RAD = Math.PI / 180;
export const RAD2DEG = 180 / Math.PI;

/** 2:1 等距:地面 Y 投影到螢幕後的壓縮比。 */
export const ISO_Y_SCALE = 0.5;
/** 螢幕 Y 還原為地面 Y 的倍率。 */
export const ISO_Y_UNSQUASH = 1 / ISO_Y_SCALE;

export interface ScreenVelocity {
  vx: number;
  vy: number;
}

function assertFinite(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name} must be a finite number, got ${value}`);
  }
}

/** 將任意有限角度(度)正規化到 [0, 360)。保證不回傳 -0 或 360。 */
export function normalizeDeg(deg: number): number {
  assertFinite(deg, 'deg');
  return ((deg % 360) + 360) % 360;
}

/** 兩個角度之間的最短夾角(度),範圍 [0, 180]。 */
export function angularDistance(a: number, b: number): number {
  const d = normalizeDeg(a - b);
  return d > 180 ? 360 - d : d;
}

/**
 * 螢幕位移 → φ(度,[0, 360))。
 * @param dx 螢幕 X 位移(像素)
 * @param dy 螢幕 Y 位移(像素,向下為正)
 * 零向量(0, 0)沒有方向,回傳 0。
 */
export function screenToPhi(dx: number, dy: number): number {
  assertFinite(dx, 'dx');
  assertFinite(dy, 'dy');
  return normalizeDeg(Math.atan2(dy * ISO_Y_UNSQUASH, dx) * RAD2DEG);
}

/**
 * φ(度)與地面速度 → 螢幕速度。
 * vx = speed·cosφ,  vy = speed·sinφ·0.5
 * @param speed 地面未壓縮像素/tick。負值代表反向。
 */
export function phiToScreenVelocity(phi: number, speed: number): ScreenVelocity {
  return phiToScreenVelocityInto(phi, speed, { vx: 0, vy: 0 });
}

/**
 * 零配置版本:把結果寫入呼叫端提供的 out 物件(給物件池與每 tick 熱路徑使用)。
 */
export function phiToScreenVelocityInto(
  phi: number,
  speed: number,
  out: ScreenVelocity,
): ScreenVelocity {
  assertFinite(phi, 'phi');
  assertFinite(speed, 'speed');
  const rad = phi * DEG2RAD;
  out.vx = speed * Math.cos(rad);
  out.vy = speed * Math.sin(rad) * ISO_Y_SCALE;
  return out;
}
