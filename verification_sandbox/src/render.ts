// render.ts — Canvas 投射物渲染器
import type { MissileManager } from './manager.js';
import { MissileState, type MissileRuntime } from './missile-types.js';
import { applyBlend, type BlendContext, type BlendMode } from './blend.js';

export interface RenderContext extends BlendContext {
  imageSmoothingEnabled?: boolean;
  drawImage(image: unknown, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number): void;
}

/** 由外部提供每個投射物對應的貼圖資訊，渲染器不依賴 spec 內部結構 */
export interface SpriteInfo {
  image: unknown;
  frameW: number;
  frameH: number;
  frameCount: number;
  /** 256 進位動畫速度：每 Tick 累加，滿 256 進 1 幀 */
  speed: number;
  /** 繪製錨點（圖內像素，通常為腳底中心） */
  anchorX: number;
  anchorY: number;
  /** 方向列（圖集第幾列），預設 0 */
  row?: number;
  /** 是否循環，預設 true；false 則停在最後一幀 */
  loop?: boolean;
  /** 混色模式（可覆蓋 spec 中的設定） */
  blendMode?: BlendMode;
  /** 混色強度 0~1，預設 1（注意：這不是位置插值的 alpha） */
  opacity?: number;
}

export type SpriteResolver = (m: MissileRuntime) => SpriteInfo | null;

/** 256 進位整數動畫推進（純函式，便於單元測試） */
export function advanceAnim(
  m: { animAcc: number; animFrame: number },
  speed: number,
  frameCount: number,
  loop = true,
): void {
  if (frameCount <= 0) return;
  const acc = (m.animAcc | 0) + (speed | 0);
  const carry = acc >> 8;   // 進位幀數（speed ≥ 256 時可能 > 1）
  m.animAcc = acc & 255;    // 保留餘數
  if (carry === 0) return;
  const next = m.animFrame + carry;
  m.animFrame = loop ? next % frameCount : Math.min(next, frameCount - 1);
}

export class MissileRenderer {
  constructor(
    private readonly ctx: RenderContext,
    private readonly manager: MissileManager,
    private readonly resolve: SpriteResolver,
  ) {}

  /** 每個邏輯 Tick 呼叫一次（掛在 MissileLoop.onTick），動畫不可跟著畫面幀跑 */
  tickAnimations(): void {
    const pool = this.manager.pool;
    for (let i = 0; i < pool.highWater; i++) {
      const m = pool.at(i);
      if (m.state === MissileState.DEAD || m.state === MissileState.INIT) continue;
      const s = this.resolve(m);
      if (s) advanceAnim(m, s.speed, s.frameCount, s.loop ?? true);
    }
  }

  /** 每個畫面幀呼叫一次；alpha 為 MissileLoop 提供的插值比例 */
  render(alpha: number): void {
    if (this.manager.liveCount === 0) return;

    const ctx = this.ctx;
    const a = alpha < 0 ? 0 : alpha > 1 ? 1 : alpha;
    const inv = 1 - a;

    // 每幀設定：canvas 被 resize 時此屬性會被重設
    if (ctx.imageSmoothingEnabled !== undefined) {
      ctx.imageSmoothingEnabled = false;
    }

    const pool = this.manager.pool;
    for (let i = 0; i < pool.highWater; i++) {
      const m = pool.at(i);
      if (m.state === MissileState.DEAD || m.state === MissileState.INIT) continue;

      // 位置插值；瞬移幀不插值
      let rx: number, ry: number;
      if (m.teleported) {
        rx = Math.round(m.x);
        ry = Math.round(m.y);
      } else {
        rx = Math.round(m.prevX * inv + m.x * a);
        ry = Math.round(m.prevY * inv + m.y * a);
      }

      const s = this.resolve(m);
      if (s) {
        const frame = m.animFrame % (s.frameCount > 0 ? s.frameCount : 1);
        const sx = frame * s.frameW;
        const sy = (s.row ?? 0) * s.frameH;
        const dx = rx - Math.round(s.anchorX);
        const dy = ry - Math.round(s.anchorY);

        const blend = s.blendMode ?? (this.manager.specs[m.specIndex]?.blend ?? 'normal');
        try {
          applyBlend(ctx, blend, s.opacity ?? 1);
          ctx.drawImage(s.image, sx, sy, s.frameW, s.frameH, dx, dy, s.frameW, s.frameH);
        } finally {
          // 無條件重設，杜絕狀態污染（即使 drawImage 拋例外）
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = 1.0;
        }
      }

      // 瞬移旗標只管「當幀」。同時把 prev 對齊 current：
      // 否則同一 Tick 內後續的畫面幀會從舊位置滑向新位置，等於沒有瞬移。
      if (m.teleported) {
        m.teleported = false;
        m.prevX = m.x;
        m.prevY = m.y;
      }
    }
  }
}
