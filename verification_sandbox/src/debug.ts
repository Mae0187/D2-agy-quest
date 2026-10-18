// debug.ts — 除錯視覺覆蓋層
import type { MissileManager } from './manager.js';
import { MissileState, type MissileRuntime } from './missile-types.js';

export interface DebugOptions {
  /** 碰撞半徑（地面像素）。預設讀取對應 spec 的 collision.radiusPx */
  getRadius?: (m: MissileRuntime) => number;
  /** 由 m（通常讀 m.targetId）解析目標螢幕座標；回傳 null 表示無目標。預設不畫線 */
  resolveTarget?: (m: MissileRuntime) => { x: number; y: number } | null;
  getHighWater?: () => number;
  getHits?: () => number;
  /** 邏輯 Tick 數；預設使用內建計數器（需在 loop.onTick 呼叫 noteTick()） */
  getTick?: () => number;
  /** 2:1 等距投影的 Y 壓縮比，預設 0.5 */
  ySquash?: number;
  /** 速度箭頭放大倍數（單位：Tick），預設 6 */
  velocityScale?: number;
  /** 朝向箭頭長度（螢幕像素），預設 24 */
  headingLength?: number;
  hudCorner?: 'tl' | 'tr' | 'bl' | 'br';
}

export class MissileDebugOverlay {
  public enabled = true;
  private ticks = 0;
  private readonly o: Required<Pick<DebugOptions,
    'ySquash' | 'velocityScale' | 'headingLength' | 'hudCorner'>> & DebugOptions;

  constructor(
    private readonly ctx: CanvasRenderingContext2D,
    private readonly manager: MissileManager,
    opt: DebugOptions = {},
  ) {
    this.o = {
      ySquash: 0.5,
      velocityScale: 6,
      headingLength: 24,
      hudCorner: 'tl',
      ...opt,
    };
  }

  toggle(): void { this.enabled = !this.enabled; }

  /** 掛在 MissileLoop.onTick */
  noteTick(): void { this.ticks++; }

  get tick(): number { return this.o.getTick ? this.o.getTick() : this.ticks; }

  /** 世界層 + HUD。若世界座標有相機變換，請分別呼叫 drawWorld / drawHud */
  draw(alpha: number): void {
    this.drawWorld(alpha);
    this.drawHud(alpha);
  }

  /** 碰撞圈、朝向、速度、目標連線（使用目前 ctx 變換，與 renderer 同座標系） */
  drawWorld(alpha: number): void {
    if (!this.enabled || this.manager.liveCount === 0) return;

    const { ctx } = this;
    const a = alpha < 0 ? 0 : alpha > 1 ? 1 : alpha;
    const inv = 1 - a;
    const { ySquash, velocityScale, headingLength } = this.o;
    const pool = this.manager.pool;

    ctx.save();
    try {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.lineWidth = 1;
      ctx.setLineDash([]);

      for (let i = 0; i < pool.highWater; i++) {
        const m = pool.at(i);
        if (m.state === MissileState.DEAD || m.state === MissileState.INIT) continue;

        // 與 renderer 相同的插值規則；+0.5 讓 1px 線條落在像素中心
        const px = m.teleported ? Math.round(m.x) : Math.round(m.prevX * inv + m.x * a);
        const py = m.teleported ? Math.round(m.y) : Math.round(m.prevY * inv + m.y * a);
        const cx = px + 0.5;
        const cy = py + 0.5;

        // 1) 碰撞圈：地面圓在 2:1 投影下為橢圓
        const spec = this.manager.specs[m.specIndex];
        const r = this.o.getRadius
          ? this.o.getRadius(m)
          : (spec ? spec.collision.radiusPx : 0);
        if (r > 0) {
          ctx.strokeStyle = 'rgba(0,255,255,0.9)';
          ctx.beginPath();
          ctx.ellipse(cx, cy, r, r * ySquash, 0, 0, Math.PI * 2);
          ctx.stroke();
        }

        // 中心十字
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath();
        ctx.moveTo(cx - 3, cy); ctx.lineTo(cx + 3, cy);
        ctx.moveTo(cx, cy - 3); ctx.lineTo(cx, cy + 3);
        ctx.stroke();

        // 2) 朝向箭頭（phi：地面角 → 螢幕）
        const rad = m.phi * (Math.PI / 180);
        ctx.strokeStyle = 'rgba(255,220,0,0.95)';
        ctx.fillStyle = 'rgba(255,220,0,0.95)';
        arrow(
          ctx, cx, cy,
          cx + Math.cos(rad) * headingLength,
          cy + Math.sin(rad) * headingLength * ySquash,
        );

        // 3) 速度向量（每 Tick 螢幕位移 × scale）；瞬移幀位移無意義，略過
        if (!m.teleported) {
          const vx = (m.x - m.prevX) * velocityScale;
          const vy = (m.y - m.prevY) * velocityScale;
          if (vx !== 0 || vy !== 0) {
            ctx.strokeStyle = 'rgba(255,0,255,0.95)';
            ctx.fillStyle = 'rgba(255,0,255,0.95)';
            arrow(ctx, cx, cy, cx + vx, cy + vy);
          }
        }

        // 4) 目標鎖定連線
        const t = this.o.resolveTarget ? this.o.resolveTarget(m) : null;
        if (t) {
          ctx.strokeStyle = 'rgba(255,60,60,0.9)';
          ctx.setLineDash([4, 3]);
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(Math.round(t.x) + 0.5, Math.round(t.y) + 0.5);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    } finally {
      ctx.restore(); // 還原 lineDash / 樣式，不污染後續繪製
    }
  }

  /** 角落 HUD。請在「螢幕空間」（無相機變換）呼叫 */
  drawHud(alpha: number): void {
    if (!this.enabled) return;

    const m = this.manager;
    const highWater = this.o.getHighWater
      ? this.o.getHighWater()
      : m.pool.highWater;
    const hits = this.o.getHits
      ? this.o.getHits()
      : m.stats.hits;

    const lines = [
      `live   ${m.liveCount}`,
      `pool^  ${highWater}`,
      `hits   ${hits}`,
      `tick   ${this.tick}`,
      `alpha  ${alpha.toFixed(2)}`,
    ];

    const { ctx } = this;
    const lh = 14, pad = 6;
    ctx.save();
    try {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.font = '12px monospace';
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';

      let w = 0;
      for (const l of lines) w = Math.max(w, ctx.measureText(l).width);
      const boxW = Math.ceil(w) + pad * 2;
      const boxH = lines.length * lh + pad * 2;

      const margin = 8;
      const cw = ctx.canvas?.width ?? 800;
      const ch = ctx.canvas?.height ?? 600;
      const c = this.o.hudCorner;
      const bx = c === 'tl' || c === 'bl' ? margin : cw - boxW - margin;
      const by = c === 'tl' || c === 'tr' ? margin : ch - boxH - margin;

      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(bx, by, boxW, boxH);
      ctx.fillStyle = '#7CFC00';
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i]!, bx + pad, by + pad + i * lh);
      }
    } finally {
      ctx.restore();
    }
  }
}

function arrow(
  ctx: CanvasRenderingContext2D,
  x0: number, y0: number, x1: number, y1: number,
  head = 5,
): void {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  const ang = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - head * Math.cos(ang - 0.45), y1 - head * Math.sin(ang - 0.45));
  ctx.lineTo(x1 - head * Math.cos(ang + 0.45), y1 - head * Math.sin(ang + 0.45));
  ctx.closePath();
  ctx.fill();
}
