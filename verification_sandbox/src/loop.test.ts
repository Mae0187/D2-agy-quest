// loop.test.ts — 純 Node 環境（不需 jsdom）；document/window 以 EventTarget 偽造
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MissileManager } from './manager.js';
import { MissileLoop, type MissileLoopOptions } from './loop.js';

// ───────── 測試工具 ─────────

let focused = true;
function makeDoc() {
  return Object.assign(new EventTarget(), { hidden: false, hasFocus: () => focused });
}
let doc: ReturnType<typeof makeDoc>;
let win: EventTarget;

function makeRaf() {
  let next = 1;
  const q = new Map<number, (t: number) => void>();
  return {
    raf: (cb: (t: number) => void) => { const id = next++; q.set(id, cb); return id; },
    caf: (id: number) => { q.delete(id); },
    get pending() { return q.size; },
    /** 以指定時間戳觸發目前排程中的那一個 rAF 回呼 */
    fire(t: number) {
      const first = q.entries().next().value;
      if (!first) throw new Error('no pending rAF');
      q.delete(first[0]);
      first[1](t);
    },
  };
}

function setup(extra: Partial<MissileLoopOptions> = {}) {
  const h = makeRaf();
  const step = vi.fn();
  const alphas: number[] = [];
  const manager = { step } as unknown as MissileManager;
  const loop = new MissileLoop(manager, {
    onRender: (a) => { alphas.push(a); },
    raf: h.raf,
    caf: h.caf,
    ...extra,
  });
  return { h, step, loop, alphas };
}

const fireHidden = (hidden: boolean) => {
  doc.hidden = hidden;
  doc.dispatchEvent(new Event('visibilitychange'));
};

beforeEach(() => {
  focused = true;
  doc = makeDoc();
  win = new EventTarget();
  vi.stubGlobal('document', doc);
  vi.stubGlobal('window', win);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ───────── 固定步長一致性 ─────────

describe('25Hz 累加器：不同畫面更新率的邏輯推進一致', () => {
  // 時長取 10020ms，使最後一幀的經過時間（≈10014~10017ms）遠離 40ms 邊界，避免浮點誤差造成 ±1
  function simulate(hz: number, durationMs = 10020) {
    const { h, step, loop, alphas } = setup();
    loop.start();
    const dt = 1000 / hz;
    const t0 = 1000;
    let frames = 0;
    for (let k = 0; k * dt <= durationMs; k++) {
      h.fire(t0 + k * dt);
      frames++;
    }
    loop.stop();
    return { ticks: step.mock.calls.length, frames, alphas };
  }

  it.each([60, 75, 144, 240])('%dHz：10 秒 = 250 個 Tick，每個畫面幀都渲染一次', (hz) => {
    const r = simulate(hz);
    expect(r.ticks).toBe(250);
    expect(r.alphas.length).toBe(r.frames);
  });

  it('60Hz 與 144Hz 的 Tick 數完全相同', () => {
    expect(simulate(60).ticks).toBe(simulate(144).ticks);
  });

  it('alpha 恆在 [0,1]', () => {
    for (const hz of [60, 144]) {
      for (const a of simulate(hz).alphas) {
        expect(a).toBeGreaterThanOrEqual(0);
        expect(a).toBeLessThanOrEqual(1);
      }
    }
  });

  it('第一幀只建立基準，不推進 Tick', () => {
    const { h, step, loop } = setup();
    loop.start();
    h.fire(123456);
    expect(step).not.toHaveBeenCalled();
    expect(loop.alpha).toBe(0);
  });

  it('alpha = 餘裕毫秒 / 40', () => {
    const { h, step, loop } = setup();
    loop.start();
    h.fire(1000);
    h.fire(1050); // 50ms → 1 Tick，餘 10ms
    expect(step).toHaveBeenCalledTimes(1);
    expect(loop.alpha).toBeCloseTo(0.25, 10);
  });

  it('時間戳倒退不會產生 Tick 或負 alpha', () => {
    const { h, step, loop } = setup();
    loop.start();
    h.fire(1000);
    h.fire(900);
    expect(step).not.toHaveBeenCalled();
    expect(loop.alpha).toBeGreaterThanOrEqual(0);
  });

  it('onTick 與 step 次數一致', () => {
    const onTick = vi.fn();
    const { h, step, loop } = setup({ onTick });
    loop.start();
    h.fire(1000);
    h.fire(1130); // 3 Tick
    expect(step).toHaveBeenCalledTimes(3);
    expect(onTick).toHaveBeenCalledTimes(3);
  });
});

// ───────── 防死亡螺旋 ─────────

describe('防死亡螺旋', () => {
  it('delta 199ms → 4 Tick；200ms → 5 Tick（未截斷）', () => {
    let s = setup(); s.loop.start(); s.h.fire(1000); s.h.fire(1199);
    expect(s.step).toHaveBeenCalledTimes(4);
    expect(s.loop.alpha).toBeCloseTo(39 / 40, 10);

    s = setup(); s.loop.start(); s.h.fire(1000); s.h.fire(1200);
    expect(s.step).toHaveBeenCalledTimes(5);
    expect(s.loop.alpha).toBe(0);
  });

  it('1000ms 卡頓：最多追 5 Tick，超額被捨棄', () => {
    const { h, step, loop } = setup();
    loop.start();
    h.fire(1000);
    h.fire(2000);
    expect(step).toHaveBeenCalledTimes(5);
    expect(loop.lastTicks).toBe(5);
    expect(loop.alpha).toBe(0);
  });

  it('截斷後只保留相位餘數（alpha 不跳變）', () => {
    const { h, step, loop } = setup();
    loop.start();
    h.fire(1000);
    h.fire(2030); // 1030ms：5 Tick 後剩 830，取餘 30 → alpha 0.75
    expect(step).toHaveBeenCalledTimes(5);
    expect(loop.alpha).toBeCloseTo(0.75, 10);
  });

  it('截斷後不會爆衝補跑：下一個 40ms 只推進 1 Tick', () => {
    const { h, step, loop } = setup();
    loop.start();
    h.fire(1000);
    h.fire(2000);          // 5 Tick（截斷）
    h.fire(2040);          // 僅 1 Tick
    expect(step).toHaveBeenCalledTimes(6);
  });

  it('step 拋例外後迴圈仍持續排程', () => {
    const { h, step, loop } = setup();
    loop.start();
    h.fire(1000);
    step.mockImplementationOnce(() => { throw new Error('boom'); });
    expect(() => h.fire(1040)).toThrow('boom');
    expect(h.pending).toBe(1);
    expect(loop.running).toBe(true);
    expect(() => h.fire(1080)).not.toThrow();
  });
});

// ───────── 掛起 / 恢復 ─────────

describe('可見性 / 失焦 掛起與恢復', () => {
  it('document.hidden：取消排程，恢復後重新排程', () => {
    const { h, loop } = setup();
    loop.start();
    expect(h.pending).toBe(1);

    fireHidden(true);
    expect(h.pending).toBe(0);
    expect(loop.running).toBe(false);

    fireHidden(false);
    expect(h.pending).toBe(1);
    expect(loop.running).toBe(true);
  });

  it('恢復後第一幀只建立基準，不補跑掛起期間', () => {
    const { h, step, loop } = setup();
    loop.start();
    h.fire(1000);
    h.fire(1040);
    expect(step).toHaveBeenCalledTimes(1);

    fireHidden(true);
    fireHidden(false);
    h.fire(60_000);            // 掛起了近一分鐘
    expect(step).toHaveBeenCalledTimes(1);
    h.fire(60_040);
    expect(step).toHaveBeenCalledTimes(2);
  });

  it('恢復時清空累加器（掛起前的餘數不殘留）', () => {
    const { h, step, loop } = setup();
    loop.start();
    h.fire(1000);
    h.fire(1020);              // acc = 20，尚無 Tick
    fireHidden(true);
    fireHidden(false);
    h.fire(9000);              // 基準
    h.fire(9020);              // 若 acc 殘留 20，這裡會湊滿 40 而誤推進
    expect(step).not.toHaveBeenCalled();
    h.fire(9040);
    expect(step).toHaveBeenCalledTimes(1);
  });

  it('rAF 觸發時恰好已隱藏（事件尚未到）：不執行、不續排', () => {
    const { h, step, loop } = setup();
    loop.start();
    h.fire(1000);
    doc.hidden = true;         // 不派發事件
    h.fire(1040);
    expect(step).not.toHaveBeenCalled();
    expect(h.pending).toBe(0);
    expect(loop.running).toBe(false);
    fireHidden(false);         // 之後事件到達 → 恢復
    expect(h.pending).toBe(1);
  });

  it('視窗 blur / focus：掛起與恢復', () => {
    const { h, loop } = setup();
    loop.start();
    win.dispatchEvent(new Event('blur'));
    expect(h.pending).toBe(0);
    win.dispatchEvent(new Event('focus'));
    expect(h.pending).toBe(1);
    expect(loop.running).toBe(true);
  });

  it('pauseOnBlur=false：失焦不掛起，但隱藏分頁仍掛起', () => {
    const { h, loop } = setup({ pauseOnBlur: false });
    loop.start();
    win.dispatchEvent(new Event('blur'));
    expect(h.pending).toBe(1);
    fireHidden(true);
    expect(h.pending).toBe(0);
  });

  it('建構時視窗已失焦：start() 不排程，focus 後才啟動', () => {
    focused = false;
    const { h, loop } = setup();
    loop.start();
    expect(h.pending).toBe(0);
    win.dispatchEvent(new Event('focus'));
    expect(h.pending).toBe(1);
  });

  it('stop() 之後，可見性事件不會讓迴圈復活', () => {
    const { h, loop } = setup();
    loop.start();
    loop.stop();
    fireHidden(true);
    fireHidden(false);
    expect(h.pending).toBe(0);
    expect(loop.running).toBe(false);
  });

  it('start() 可重複呼叫，不會重複排程', () => {
    const { h, loop } = setup();
    loop.start();
    loop.start();
    expect(h.pending).toBe(1);
  });

  it('dispose() 移除全域監聽', () => {
    const rmDoc = vi.spyOn(doc, 'removeEventListener');
    const rmWin = vi.spyOn(win, 'removeEventListener');
    const { h, loop } = setup();
    loop.start();
    loop.dispose();
    expect(h.pending).toBe(0);
    expect(rmDoc).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    expect(rmWin).toHaveBeenCalledWith('blur', expect.any(Function));
    expect(rmWin).toHaveBeenCalledWith('focus', expect.any(Function));
  });
});
