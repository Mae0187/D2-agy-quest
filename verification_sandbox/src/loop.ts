// loop.ts — 25Hz 固定邏輯步長主迴圈
import type { MissileManager } from './manager.js';

export const TICK_MS = 40;          // 25Hz
export const MAX_CATCHUP_TICKS = 5; // 單次畫面更新最多追 5 tick (200ms)

export interface MissileLoopOptions {
  /** 每次 manager.step() 之後呼叫（動畫幀推進等「每 Tick 一次」的工作放這裡） */
  onTick?: () => void;
  /** 每個畫面幀呼叫一次，alpha ∈ [0,1] 為插值比例 */
  onRender: (alpha: number) => void;
  /** 失焦時是否掛起，預設 true */
  pauseOnBlur?: boolean;
  /** 可注入以利測試 */
  raf?: (cb: (t: number) => void) => number;
  caf?: (id: number) => void;
  now?: () => number;
}

export class MissileLoop {
  private readonly manager: MissileManager;
  private readonly opt: MissileLoopOptions;
  private readonly raf: (cb: (t: number) => void) => number;
  private readonly caf: (id: number) => void;
  private readonly pauseOnBlur: boolean;

  private wantRunning = false;   // 使用者意圖：start() 後為 true
  private rafId = 0;
  private lastTime: number | null = null; // null = 下一幀重設基準戳
  private acc = 0;
  private focused = true;

  /** 最近一次畫面更新實際執行的 tick 數（除錯 / 統計用） */
  public lastTicks = 0;
  /** 最近一次插值比例 */
  public alpha = 0;

  constructor(manager: MissileManager, opt: MissileLoopOptions) {
    this.manager = manager;
    this.opt = opt;
    this.pauseOnBlur = opt.pauseOnBlur ?? true;
    this.raf = opt.raf ?? ((cb) => requestAnimationFrame(cb));
    this.caf = opt.caf ?? ((id) => cancelAnimationFrame(id));

    if (typeof document !== 'undefined') {
      this.focused = typeof document.hasFocus === 'function' ? document.hasFocus() : true;
      document.addEventListener('visibilitychange', this.onVisibility);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('blur', this.onBlur);
      window.addEventListener('focus', this.onFocus);
    }
  }

  get running(): boolean {
    return this.rafId !== 0;
  }

  start(): void {
    if (this.wantRunning) return;
    this.wantRunning = true;
    this.syncState();
  }

  stop(): void {
    if (!this.wantRunning) return;
    this.wantRunning = false;
    this.syncState();
  }

  /** 移除全域事件監聽，銷毀時呼叫 */
  dispose(): void {
    this.stop();
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.onVisibility);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('blur', this.onBlur);
      window.removeEventListener('focus', this.onFocus);
    }
  }

  // ───────── 掛起 / 恢復 ─────────

  private onVisibility = (): void => this.syncState();
  private onBlur = (): void => { this.focused = false; this.syncState(); };
  private onFocus = (): void => { this.focused = true; this.syncState(); };

  private shouldRun(): boolean {
    if (!this.wantRunning) return false;
    if (typeof document !== 'undefined' && document.hidden) return false;
    if (this.pauseOnBlur && !this.focused) return false;
    return true;
  }

  private syncState(): void {
    const should = this.shouldRun();
    if (should && this.rafId === 0) {
      // 恢復：清掉累加器並讓下一幀重設基準戳，避免把掛起期間當成 delta
      this.lastTime = null;
      this.acc = 0;
      this.rafId = this.raf(this.frame);
    } else if (!should && this.rafId !== 0) {
      this.caf(this.rafId);
      this.rafId = 0;
      this.lastTime = null;
    }
  }

  // ───────── 主迴圈 ─────────

  private frame = (timestamp: number): void => {
    this.rafId = 0;
    if (!this.shouldRun()) { this.lastTime = null; return; }

    // 先排下一幀，這樣 step/render 拋例外也不會讓迴圈永久死掉
    this.rafId = this.raf(this.frame);

    if (this.lastTime === null) {
      this.lastTime = timestamp; // 第一幀 / 恢復後第一幀：只建立基準
    }
    let delta = timestamp - this.lastTime;
    this.lastTime = timestamp;
    if (delta < 0) delta = 0; // 防時間戳倒退

    this.acc += delta;

    let ticks = 0;
    while (this.acc >= TICK_MS && ticks < MAX_CATCHUP_TICKS) {
      this.manager.step();
      this.opt.onTick?.();
      this.acc -= TICK_MS;
      ticks++;
    }

    // 防死亡螺旋：仍有超額時間 → 捨棄，只保留相位餘數，並重設基準戳
    if (this.acc >= TICK_MS) {
      this.acc %= TICK_MS;
      this.lastTime = timestamp;
    }

    this.lastTicks = ticks;
    this.alpha = Math.min(1, Math.max(0, this.acc / TICK_MS));
    this.opt.onRender(this.alpha);
  };
}
