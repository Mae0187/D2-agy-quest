// render.test.ts — 輕量 Mock Context，不需 canvas / jsdom
import { describe, it, expect, vi } from 'vitest';
import type { MissileManager } from './manager.js';
import { MissileRenderer, advanceAnim, type SpriteInfo } from './render.js';
import { MissileState, type MissileRuntime } from './missile-types.js';

// ───────── 測試工具 ─────────

interface DrawCall { args: unknown[]; op: string; alpha: number }

class MockCtx {
  imageSmoothingEnabled = true;
  globalCompositeOperation = 'source-over';
  globalAlpha = 1;
  draws: DrawCall[] = [];
  throwOnDraw = false;
  drawImage(...args: unknown[]): void {
    if (this.throwOnDraw) throw new Error('boom');
    this.draws.push({ args, op: this.globalCompositeOperation, alpha: this.globalAlpha });
  }
}

const IMG = {} as any;

function sprite(over: Partial<SpriteInfo> = {}): SpriteInfo {
  return {
    image: IMG, frameW: 32, frameH: 32, frameCount: 4, speed: 64,
    anchorX: 0, anchorY: 0, ...over,
  };
}

function mk(over: Partial<Record<string, unknown>> = {}): MissileRuntime {
  return {
    state: MissileState.ACTIVE,
    specIndex: 0,
    x: 0, y: 0, prevX: 0, prevY: 0, phi: 0,
    teleported: false, animAcc: 0, animFrame: 0,
    ...over,
  } as unknown as MissileRuntime;
}

function setup(missiles: MissileRuntime[], s: SpriteInfo | null = sprite()) {
  const ctx = new MockCtx();
  const live = missiles.filter((m) => m.state !== MissileState.DEAD).length;
  const poolMock = {
    highWater: missiles.length,
    at: (i: number) => missiles[i]!,
  };
  const manager = {
    pool: poolMock,
    liveCount: live,
    specs: [{ blend: 'normal' }, { blend: 'additive' }],
  } as unknown as MissileManager;
  const renderer = new MissileRenderer(
    ctx as unknown as any,
    manager,
    () => s,
  );
  return { ctx, renderer, manager };
}

/** drawImage 參數：[img, sx, sy, sw, sh, dx, dy, dw, dh] */
const dest = (c: DrawCall) => [c.args[5], c.args[6]];

// ───────── 位置插值 ─────────

describe('位置插值與取整', () => {
  it('alpha=0.5：(0,0)→(10,5) 得 (5, round(2.5)=3)', () => {
    const { ctx, renderer } = setup([mk({ x: 10, y: 5 })]);
    renderer.render(0.5);
    expect(dest(ctx.draws[0]!)).toEqual([5, 3]);
  });

  it('alpha=0.26：以 Math.round 取整，不產生小數座標', () => {
    const { ctx, renderer } = setup([mk({ x: 10, y: 5 })]);
    renderer.render(0.26);
    expect(dest(ctx.draws[0]!)).toEqual([3, 1]); // 2.6→3, 1.3→1
    for (const v of dest(ctx.draws[0]!)) expect(Number.isInteger(v)).toBe(true);
  });

  it('alpha=0 取上幀位置，alpha=1 取當前位置', () => {
    const m = mk({ prevX: 20, prevY: 10, x: 30, y: 16 });
    const { ctx, renderer } = setup([m]);
    renderer.render(0);
    renderer.render(1);
    expect(dest(ctx.draws[0]!)).toEqual([20, 10]);
    expect(dest(ctx.draws[1]!)).toEqual([30, 16]);
  });

  it('alpha 超出範圍會被夾住', () => {
    const { ctx, renderer } = setup([mk({ x: 10, y: 10 })]);
    renderer.render(-3);
    renderer.render(7);
    expect(dest(ctx.draws[0]!)).toEqual([0, 0]);
    expect(dest(ctx.draws[1]!)).toEqual([10, 10]);
  });

  it('負座標：Math.round(-2.5) === -2（記錄既有行為）', () => {
    const { ctx, renderer } = setup([mk({ x: -5, y: 0 })]);
    renderer.render(0.5);
    expect(dest(ctx.draws[0]!)).toEqual([-2, 0]);
  });

  it('錨點偏移與圖集來源矩形', () => {
    const m = mk({ x: 10, y: 5, animFrame: 2 });
    const { ctx, renderer } = setup([m], sprite({ anchorX: 4, anchorY: 8, row: 3 }));
    renderer.render(1);
    expect(ctx.draws[0]!.args).toEqual([IMG, 64, 96, 32, 32, 6, -3, 32, 32]);
  });

  it('animFrame 超出 frameCount 時以取餘數繪製', () => {
    const { ctx, renderer } = setup([mk({ animFrame: 5 })], sprite({ frameCount: 4 }));
    renderer.render(0);
    expect(ctx.draws[0]!.args[1]).toBe(32); // 5 % 4 = 1
  });

  it('每次 render 都設 imageSmoothingEnabled=false', () => {
    const { ctx, renderer } = setup([mk()]);
    ctx.imageSmoothingEnabled = true;
    renderer.render(0);
    expect(ctx.imageSmoothingEnabled).toBe(false);
  });

  it('略過非活躍實體；liveCount=0 時不繪製', () => {
    const { ctx, renderer } = setup([mk({ state: MissileState.DEAD })]);
    renderer.render(0.5);
    expect(ctx.draws.length).toBe(0);
  });
});

// ───────── 瞬移 ─────────

describe('teleported 瞬移幀', () => {
  it('當幀不插值，直接畫在當前位置', () => {
    const { ctx, renderer } = setup([mk({ prevX: 0, prevY: 0, x: 100, y: 50, teleported: true })]);
    renderer.render(0.5);
    expect(dest(ctx.draws[0]!)).toEqual([100, 50]); // 非 (50, 25)
  });

  it('繪製後重設旗標，且 prev 對齊 current，之後的畫面幀不會滑動', () => {
    const m = mk({ prevX: 0, prevY: 0, x: 100, y: 50, teleported: true });
    const { ctx, renderer } = setup([m]);
    renderer.render(0.3);
    expect(m.teleported).toBe(false);
    expect(m.prevX).toBe(100);
    expect(m.prevY).toBe(50);
    renderer.render(0.6); // 同一 Tick 內的下一個畫面幀
    expect(dest(ctx.draws[1]!)).toEqual([100, 50]);
  });

  it('只影響瞬移的實體，其他實體照常插值', () => {
    const a = mk({ x: 100, y: 50, teleported: true });
    const b = mk({ x: 10, y: 10 });
    const { ctx, renderer } = setup([a, b]);
    renderer.render(0.5);
    expect(dest(ctx.draws[0]!)).toEqual([100, 50]);
    expect(dest(ctx.draws[1]!)).toEqual([5, 5]);
    expect(b.teleported).toBe(false);
  });

  it('即使貼圖解析失敗（null），旗標仍會重設', () => {
    const m = mk({ x: 9, y: 9, teleported: true });
    const { ctx, renderer } = setup([m], null);
    renderer.render(0.5);
    expect(ctx.draws.length).toBe(0);
    expect(m.teleported).toBe(false);
  });
});

// ───────── 混色隔離 ─────────

describe('混色模式隔離', () => {
  it('繪製時套用混色，結束後無條件還原為 source-over / 1.0', () => {
    const { ctx, renderer } = setup([mk({ specIndex: 1 })], sprite({ opacity: 0.5, blendMode: 'additive' }));
    renderer.render(0);
    expect(ctx.draws[0]!.op).toBe('lighter');
    expect(ctx.draws[0]!.alpha).toBe(0.5);
    expect(ctx.globalCompositeOperation).toBe('source-over');
    expect(ctx.globalAlpha).toBe(1);
  });

  it('前一個實體的混色不會洩漏給下一個', () => {
    const { ctx, renderer } = setup([mk({ specIndex: 1 }), mk({ specIndex: 0 })], sprite({ blendMode: undefined }));
    renderer.render(0);
    expect(ctx.draws[0]!.op).toBe('lighter');
    expect(ctx.draws[1]!.op).toBe('source-over');
    expect(ctx.draws[1]!.alpha).toBe(1);
  });

  it('drawImage 拋例外時狀態仍被重設', () => {
    const { ctx, renderer } = setup([mk({ specIndex: 1 })], sprite({ opacity: 0.3, blendMode: 'additive' }));
    ctx.throwOnDraw = true;
    expect(() => renderer.render(0)).toThrow('boom');
    expect(ctx.globalCompositeOperation).toBe('source-over');
    expect(ctx.globalAlpha).toBe(1);
  });
});

// ───────── 256 進位動畫 ─────────

describe('advanceAnim：256 進位整數推進', () => {
  const st = (animFrame = 0, animAcc = 0) => ({ animFrame, animAcc });

  it('speed=64：每 4 Tick 進 1 幀，餘數歸零', () => {
    const m = st();
    for (let i = 0; i < 3; i++) advanceAnim(m, 64, 8);
    expect(m).toEqual({ animFrame: 0, animAcc: 192 });
    advanceAnim(m, 64, 8);
    expect(m).toEqual({ animFrame: 1, animAcc: 0 });
  });

  it('speed=100：進位時保留餘數（100,200,44→幀1,144,244,88→幀2）', () => {
    const m = st();
    advanceAnim(m, 100, 8); advanceAnim(m, 100, 8);
    expect(m).toEqual({ animFrame: 0, animAcc: 200 });
    advanceAnim(m, 100, 8);
    expect(m).toEqual({ animFrame: 1, animAcc: 44 });
    advanceAnim(m, 100, 8); advanceAnim(m, 100, 8); advanceAnim(m, 100, 8);
    expect(m).toEqual({ animFrame: 2, animAcc: 88 });
  });

  it('speed=256 每 Tick 進 1 幀；speed=512 每 Tick 進 2 幀', () => {
    const a = st(); advanceAnim(a, 256, 8);
    expect(a).toEqual({ animFrame: 1, animAcc: 0 });
    const b = st(); advanceAnim(b, 512, 8);
    expect(b).toEqual({ animFrame: 2, animAcc: 0 });
  });

  it('長時間無漂移：speed=85 跑 256 Tick 恰好 85 幀、餘數 0', () => {
    const m = st();
    for (let i = 0; i < 256; i++) advanceAnim(m, 85, 1000);
    expect(m).toEqual({ animFrame: 85, animAcc: 0 });
  });

  it('循環：最後一幀進位後回到 0；非循環則停在最後一幀', () => {
    const a = st(3, 0); advanceAnim(a, 256, 4, true);
    expect(a.animFrame).toBe(0);
    const b = st(3, 0); advanceAnim(b, 256, 4, false);
    expect(b.animFrame).toBe(3);
  });

  it('speed=0 或 frameCount<=0：不變動', () => {
    const a = st(2, 10); advanceAnim(a, 0, 8);
    expect(a).toEqual({ animFrame: 2, animAcc: 10 });
    const b = st(2, 10); advanceAnim(b, 100, 0);
    expect(b).toEqual({ animFrame: 2, animAcc: 10 });
  });
});

describe('動畫只跟 Tick 走，不跟畫面幀走', () => {
  it('render 呼叫 10 次，動畫幀不變；tickAnimations 呼叫 4 次才進 1 幀', () => {
    const m = mk();
    const { renderer } = setup([m], sprite({ speed: 64 }));
    for (let i = 0; i < 10; i++) renderer.render(0.5);
    expect(m.animFrame).toBe(0);
    for (let i = 0; i < 4; i++) renderer.tickAnimations();
    expect(m.animFrame).toBe(1);
  });

  it('略過非活躍實體與無貼圖的實體', () => {
    const dead = mk({ state: MissileState.DEAD });
    const { renderer } = setup([dead], sprite({ speed: 256 }));
    renderer.tickAnimations();
    expect(dead.animFrame).toBe(0);

    const m = mk();
    const r2 = setup([m], null);
    r2.renderer.tickAnimations();
    expect(m.animFrame).toBe(0);
  });
});
