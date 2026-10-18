/**
 * blend.ts — 混色模式列舉與 Canvas 2D 合成運算映射
 *
 * 混色(blend)與調色盤偏移(paletteShift)是兩個獨立維度。
 *
 * 重要:
 *  - 本表是「執行期 Canvas 2D 的近似」。與原廠 Overlay.txt 的 Trans 欄、pal.pl2 混色表的
 *    對照,請以你本機的表驗證後再綁定,不要憑記憶硬綁數字。
 *  - alpha25/50/75 在此被當作「不透明度」。若原廠語意相反,只需改 BLEND_TABLE。
 *  - Canvas 2D 沒有「亮度當 alpha」與「單位陰影」的等價物:
 *      luminance → 離線烘焙 alpha 後以 source-over 繪製
 *      shadow    → 壓扁變換屬於渲染端;此處只提供預設不透明度(待校準)
 *  - 黑框排查:先確認是否把該用 additive 的特效用了 normal,再確認是否重複處理 premultiplied alpha。
 */

export const BLEND_MODES = [
  'normal',
  'alpha25',
  'alpha50',
  'alpha75',
  'additive',
  'screen',
  'luminance',
  'multiply',
  'shadow',
] as const;
export type BlendMode = (typeof BLEND_MODES)[number];

/** 本模組用到的 Canvas globalCompositeOperation 子集。 */
export type CompositeOp = 'source-over' | 'lighter' | 'screen' | 'multiply';

export interface BlendSpec {
  readonly composite: CompositeOp;
  /** 此模式的基礎不透明度,[0, 1]。 */
  readonly alpha: number;
}

function spec(composite: CompositeOp, alpha: number): BlendSpec {
  return Object.freeze({ composite, alpha });
}

export const BLEND_TABLE: Readonly<Record<BlendMode, BlendSpec>> = Object.freeze({
  normal: spec('source-over', 1),
  alpha25: spec('source-over', 0.25),
  alpha50: spec('source-over', 0.5),
  alpha75: spec('source-over', 0.75),
  additive: spec('lighter', 1),
  screen: spec('screen', 1),
  luminance: spec('source-over', 1),
  multiply: spec('multiply', 1),
  shadow: spec('source-over', 0.5), // 待校準
});

/** 最小的 2D context 介面,讓本模組不依賴 DOM 型別。CanvasRenderingContext2D 可直接傳入。 */
export interface BlendContext {
  globalCompositeOperation: string;
  globalAlpha: number;
}

/** 繪製樣式:混色與調色盤偏移彼此獨立。 */
export interface DrawStyle {
  readonly blend: BlendMode;
  /** 乘在模式基礎 alpha 之上,用於淡入淡出。預設 1。 */
  readonly alpha?: number;
  readonly paletteShift?: string;
  readonly tint?: readonly [number, number, number];
}

export function isBlendMode(value: unknown): value is BlendMode {
  return typeof value === 'string' && (BLEND_MODES as readonly string[]).includes(value);
}

export function assertBlendMode(value: unknown): asserts value is BlendMode {
  if (!isBlendMode(value)) {
    throw new RangeError(`unknown blend mode: ${String(value)} (expected one of ${BLEND_MODES.join(', ')})`);
  }
}

/** 回傳共用的凍結物件,零配置。 */
export function resolveBlend(mode: BlendMode): BlendSpec {
  return BLEND_TABLE[mode];
}

export function compositeOpFor(mode: BlendMode): CompositeOp {
  return BLEND_TABLE[mode].composite;
}

/** 加法類混色(Canvas 'lighter'),用於排序批次與除錯標籤。 */
export function isAdditive(mode: BlendMode): boolean {
  return BLEND_TABLE[mode].composite === 'lighter';
}

/** 實際 globalAlpha = clamp01(模式基礎 alpha × alpha)。alpha 必須是有限數。 */
export function effectiveAlpha(mode: BlendMode, alpha = 1): number {
  if (!Number.isFinite(alpha)) throw new RangeError(`alpha must be finite, got ${alpha}`);
  const v = BLEND_TABLE[mode].alpha * alpha;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** 設定 context 的合成運算與 globalAlpha。零配置。呼叫端自行 save/restore 或下次覆寫。 */
export function applyBlend(ctx: BlendContext, mode: BlendMode, alpha = 1): void {
  ctx.globalCompositeOperation = BLEND_TABLE[mode].composite;
  ctx.globalAlpha = effectiveAlpha(mode, alpha);
}

export function applyDrawStyle(ctx: BlendContext, style: DrawStyle): void {
  applyBlend(ctx, style.blend, style.alpha ?? 1);
}
