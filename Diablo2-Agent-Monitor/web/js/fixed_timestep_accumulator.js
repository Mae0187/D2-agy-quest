/**
 * Diablo II 25 FPS 原版遊戲時鐘步長累加器 (Fixed Timestep Accumulator at 25Hz)
 * 與螢幕刷新率 (60Hz / 120Hz / 144Hz) 徹底解耦，精準還原 D2 核心 40ms 邏輯步進。
 */
class FixedTimestepAccumulator {
    constructor(tickRateHz = 25, onTick = null, onRender = null) {
        this.stepMs = 1000 / tickRateHz; // 40.0 ms
        this.onTick = onTick;
        this.onRender = onRender;
        
        this.accumulator = 0.0;
        this.lastTimestamp = 0.0;
        this.isRunning = false;
        this.rafId = null;
        this.maxSubSteps = 5; // 防止瀏覽器休眠切換造成的螺旋卡死

        // 統計資訊
        this.tickCount = 0;
        this.fps = 60;
        this.fpsFrames = 0;
        this.fpsLastCheck = performance.now();
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.lastTimestamp = performance.now();
        this.accumulator = 0.0;
        this.loop(this.lastTimestamp);
        
        // 增設無頭環境與背景分頁防呆計時器 (若 requestAnimationFrame 被瀏覽器暫停，確保 40ms 核心邏輯不中斷)
        if (this.fallbackTimer) clearInterval(this.fallbackTimer);
        this.fallbackTimer = setInterval(() => {
            if (!this.isRunning) return;
            const now = performance.now();
            if (now - this.lastTimestamp >= this.stepMs) {
                this.loop(now);
            }
        }, 16);
    }

    stop() {
        this.isRunning = false;
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        if (this.fallbackTimer) {
            clearInterval(this.fallbackTimer);
            this.fallbackTimer = null;
        }
    }

    loop(timestamp) {
        if (!this.isRunning) return;

        let deltaMs = timestamp - this.lastTimestamp;
        this.lastTimestamp = timestamp;

        // 鉗制最大單幀間隔 (防止切換分頁後暴衝)
        if (deltaMs > 250) deltaMs = 250;

        this.accumulator += deltaMs;

        // 25Hz 固定邏輯步進
        let subSteps = 0;
        while (this.accumulator >= this.stepMs && subSteps < this.maxSubSteps) {
            if (this.onTick) {
                this.onTick(this.stepMs, this.tickCount);
            }
            this.accumulator -= this.stepMs;
            this.tickCount++;
            subSteps++;
        }

        // 畫面渲染插值係數 (Alpha: 0.0 ~ 1.0)
        const alpha = Math.min(Math.max(this.accumulator / this.stepMs, 0.0), 1.0);
        if (this.onRender) {
            this.onRender(alpha);
        }

        // 統計 FPS
        this.fpsFrames++;
        if (timestamp - this.fpsLastCheck >= 1000) {
            this.fps = Math.round((this.fpsFrames * 1000) / (timestamp - this.fpsLastCheck));
            this.fpsFrames = 0;
            this.fpsLastCheck = timestamp;
        }

        this.rafId = requestAnimationFrame(t => this.loop(t));
    }
}

window.FixedTimestepAccumulator = FixedTimestepAccumulator;
