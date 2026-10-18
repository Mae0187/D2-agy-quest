/**
 * @file Diablo2-Agent-Monitor/web/js/d2_engine_controller.js
 * @description Signal/Slot Coordinator binding Backend SSE Stream, Fixed-Timestep 25FPS Loop,
 *              D2CombatHSM, D2SweptPhysicsEngine, and Phase 1 D2ViewShell.
 */

import { UI_CONFIG } from '../../../d2-engine/templates/ui_config.js';
import { D2CombatHSM } from '../../../d2-engine/templates/d2_combat_hsm.js';
import { D2SweptPhysicsEngine } from '../../../d2-engine/templates/d2_physics_swept.js';

export class D2EngineController {
  /**
   * @param {import('../../../d2-engine/templates/d2_view_shell.js').D2ViewShell} viewShell
   * @param {object} domElements HUD 與沙盒控制項 DOM 參考
   */
  constructor(viewShell, domElements = {}) {
    this.viewShell = viewShell;
    this.dom = domElements;

    this.hsm = new D2CombatHSM();
    this.physics = new D2SweptPhysicsEngine();

    this.isAutoRunning = false;
    this.rafId = null;
    this.lastTimestampMs = 0;
    this.accumulatorMs = 0;
    this.eventSource = null;

    this._bindInternalSignals();
    this._augmentDeterministicHarness();
  }

  /**
   * 完成 Model 層與 View 層之 Signal / Slot 綁定
   */
  _bindInternalSignals() {
    // Slot 1: 當 HSM 到達關鍵動作幀 f_act 發出投射物請求時，驅動 Swept Physics 生成投射物
    this.hsm.signals.connect('spawnProjectileRequested', (req) => {
      this.physics.spawnDirectionalProjectile({
        actorWorldPos: this.hsm.state.actorWorldPos,
        direction: req.direction,
        handSource: req.handSource,
        isAoE: req.isAoE,
        speedSubTilesPerTick: 2.2 // 高速位移以驗證 Swept Circle 防穿透
      });
    });

    // Slot 2: 當 HSM 狀態更新時，同步更新 ViewShell 與 DOM HUD
    this.hsm.signals.connect('stateUpdated', (hsmSnap) => {
      const physSnap = this.physics.getPhysicsSnapshot();
      const hasActiveHit = physSnap.hitOverlays.length > 0;

      this.viewShell.setViewState({
        sceneMode: hsmSnap.sceneMode,
        gammaFadeStep: hsmSnap.gammaFadeStep,
        characterClass: hsmSnap.characterClass,
        agentIntent: hsmSnap.agentIntent,
        animMode: hsmSnap.animMode,
        direction: hsmSnap.direction,
        frameIndex: hsmSnap.frameIndex,
        holyShieldOverride: hsmSnap.holyShieldOverride,
        handSource: hsmSnap.handSource,
        campfireStepPhase: hsmSnap.campfireStepPhase,
        targetMonster: physSnap.primaryMonster
          ? {
              sizeClass: physSnap.primaryMonster.sizeClass,
              worldPos: physSnap.primaryMonster.worldPos,
              showHitOverlay: hasActiveHit
            }
          : undefined
      });

      // 在 Canvas 上疊加繪製飛行中之投射物實體
      this._renderActiveProjectilesOverlay(physSnap.projectiles);
      this._updateDomHud(hsmSnap, physSnap);
    });
  }

  _renderActiveProjectilesOverlay(projectiles) {
    if (!projectiles || projectiles.length === 0) return;
    const ctx = this.viewShell.ctx;
    ctx.save();
    for (const p of projectiles) {
      const pt = this.viewShell.worldToScreen(p.worldPos.x, p.worldPos.y, p.worldPos.z);
      const drawX = pt.x + (p.screenFineTune?.dx || 0);
      const drawY = pt.y + (p.screenFineTune?.dy || 0);

      const grad = ctx.createRadialGradient(drawX, drawY, 1, drawX, drawY, 10);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.4, '#38bdf8');
      grad.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(drawX, drawY, 10, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  _updateDomHud(hsmSnap, physSnap) {
    const intentCfg = UI_CONFIG.AGENT_INTENT_MAP[hsmSnap.agentIntent];
    if (this.dom.badge && intentCfg) {
      this.dom.badge.textContent = intentCfg.hudLabel;
      this.dom.badge.style.color = intentCfg.hudColor;
      this.dom.badge.style.borderColor = intentCfg.hudColor;
    }
    if (this.dom.readout) {
      this.dom.readout.textContent =
        `MODE: ${hsmSnap.animMode} | DIR: ${hsmSnap.direction} | FRAME: ${hsmSnap.frameIndex} | QUEUE: ${hsmSnap.queueStatus.queuedCount}`;
    }
    if (this.dom.orbLife) {
      this.dom.orbLife.innerHTML = `LIFE<br/>${hsmSnap.lifePct}%`;
    }
    if (this.dom.orbMana) {
      this.dom.orbMana.innerHTML = `MANA<br/>${hsmSnap.manaPct}%`;
    }
  }

  /**
   * 推進單一確定性邏輯步長 (40ms Tick)：先更動物理碰撞，再推進 HSM 狀態機
   */
  stepSingleTick() {
    this.physics.stepPhysicsTick();
    this.hsm.stepTick();
  }

  /**
   * 啟動 25 FPS 固定時間步長主迴圈
   */
  startAutoLoop() {
    if (this.isAutoRunning) return;
    this.isAutoRunning = true;
    this.lastTimestampMs = performance.now();

    const loop = (now) => {
      if (!this.isAutoRunning) return;
      const deltaMs = Math.min(200, now - this.lastTimestampMs);
      this.lastTimestampMs = now;
      this.accumulatorMs += deltaMs;

      while (this.accumulatorMs >= UI_CONFIG.ENGINE.TICK_MS) {
        this.stepSingleTick();
        this.accumulatorMs -= UI_CONFIG.ENGINE.TICK_MS;
      }
      this.rafId = requestAnimationFrame(loop);
    };

    this.rafId = requestAnimationFrame(loop);
  }

  stopAutoLoop() {
    this.isAutoRunning = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /**
   * 連接 run_app.py 提供之 SSE 即時事件流 (/api/agent/stream)
   */
  connectBackendSSE(sseUrl = '/api/agent/stream') {
    if (this.eventSource) {
      this.eventSource.close();
    }
    this.eventSource = new EventSource(sseUrl);
    this.eventSource.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data);
        if (data && data.intent) {
          this.hsm.receiveAgentEvent(data);
        }
      } catch (err) {
        console.error('[D2EngineController] SSE parse error:', err);
      }
    };
  }

  /**
   * 擴充 window.__D2_HARNESS__ 供 Playwright 無頭瀏覽器直接驅動邏輯幀與物理碰撞測試
   */
  _augmentDeterministicHarness() {
    if (typeof window !== 'undefined' && window.__D2_HARNESS__) {
      const baseHarness = window.__D2_HARNESS__;
      window.__D2_HARNESS__ = {
        ...baseHarness,
        pauseLoop: () => this.stopAutoLoop(),
        stepTicks: (count = 1) => {
          this.stopAutoLoop();
          for (let i = 0; i < count; i++) {
            this.stepSingleTick();
          }
          return {
            hsm: this.hsm.getSnapshot(),
            physics: this.physics.getPhysicsSnapshot(),
            telemetry: this.viewShell.lastRenderTelemetry
          };
        },
        pushAgentEvent: (evt) => this.hsm.receiveAgentEvent(evt),
        testSweptSegment: (pointA, pointB, centerC) =>
          D2SweptPhysicsEngine.computeSweptSegmentToCircle(pointA, pointB, centerC)
      };
    }
  }
}
