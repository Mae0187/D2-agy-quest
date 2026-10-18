/**
 * @file d2-engine/templates/d2_view_shell.js
 * @description Pure View Renderer & Deterministic Visual Harness for D2-agy-quest (Phase 1)
 */

import { UI_CONFIG } from './ui_config.js';

export class D2ViewShell {
  /**
   * @param {HTMLCanvasElement} canvas 目標畫布
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.canvas.width = UI_CONFIG.VIEWPORT.WIDTH;
    this.canvas.height = UI_CONFIG.VIEWPORT.HEIGHT;

    // 純視圖呈現狀態（View State Snapshot），於 Phase 2 由狀態機與物理引擎驅動更新
    this.viewState = {
      sceneMode: 'DUNGEON', // 'CAMPFIRE' | 'DUNGEON'
      gammaFadeStep: 0,     // 0 (全亮) ~ 8 (全黑)
      characterClass: 'PALADIN',
      agentIntent: 'IDLE_PATROL',
      animMode: 'TN',
      direction: 0,
      frameIndex: 0,
      holyShieldOverride: true,
      handSource: 'RIGHT_HAND',
      campfireStepPhase: 'FRONT_IDLE', // 'BACK_IDLE' | 'STEP_FORWARD' | 'FRONT_IDLE'
      actorWorldPos: { x: 0, y: 0, z: 0 },
      targetMonster: {
        sizeClass: 'MEDIUM',
        worldPos: { x: 3.5, y: 0.0, z: 0 },
        showHitOverlay: true
      },
      debugFlags: {
        showSubTileGrid: true,
        showFireOffsetGizmo: true,
        showSweptCorridor: true,
        showMonsterCylinder: true,
        showTorsoAnchor: true,
        showLayerOrderHUD: true
      }
    };

    this.lastRenderTelemetry = null;
    this._installDeterministicHarness();
  }

  /**
   * 世界座標 (x_w, y_w, z_w) 轉螢幕像素座標 (x_s, y_s)
   * 對齊 Phase 0 數學公式：x_s = (x_w - y_w)*(W/2) + X_cam, y_s = (x_w + y_w)*(H/2) - z_w + Y_cam
   */
  worldToScreen(xw, yw, zw = 0) {
    const halfW = UI_CONFIG.VIEWPORT.TILE_WIDTH / 2;
    const halfH = UI_CONFIG.VIEWPORT.TILE_HEIGHT / 2;
    const camX = this.canvas.width * 0.42;
    const camY = this.canvas.height * 0.52;
    return {
      x: Math.round((xw - yw) * halfW + camX),
      y: Math.round((xw + yw) * halfH - zw + camY)
    };
  }

  /**
   * 計算鐵律 12 之方向性投射物發射點（World Space 與 Screen Space）
   */
  computeDirectionalFireSpawn() {
    const cfg = UI_CONFIG.FIRE_OFFSET_CONFIG;
    const dirEntry = cfg.DIRECTION_8_TABLE[this.viewState.direction] || cfg.DIRECTION_8_TABLE[0];
    const theta = dirEntry.angleRad;
    const rForward = cfg.FORWARD_RADIUS_SUBTILES;
    const lHand = cfg.HAND_LATERAL_SUBTILES[this.viewState.handSource] ?? 0;
    const zFire = cfg.DEFAULT_Z_FIRE_PX;

    const wx = this.viewState.actorWorldPos.x + (Math.cos(theta) * rForward - Math.sin(theta) * lHand);
    const wy = this.viewState.actorWorldPos.y + (Math.sin(theta) * rForward + Math.cos(theta) * lHand);
    const screenRaw = this.worldToScreen(wx, wy, zFire);

    return {
      world: { x: wx, y: wy, z: zFire },
      screen: {
        x: screenRaw.x + dirEntry.dx,
        y: screenRaw.y + dirEntry.dy
      },
      fineTune: { dx: dirEntry.dx, dy: dirEntry.dy },
      dirLabel: dirEntry.label
    };
  }

  /**
   * 更新視圖狀態並立即觸發單幀重繪
   * @param {Partial<typeof this.viewState>} patch 狀態更新片段
   */
  setViewState(patch) {
    if (patch.debugFlags) {
      this.viewState.debugFlags = { ...this.viewState.debugFlags, ...patch.debugFlags };
    }
    if (patch.targetMonster) {
      this.viewState.targetMonster = { ...this.viewState.targetMonster, ...patch.targetMonster };
    }
    const { debugFlags, targetMonster, ...rest } = patch;
    Object.assign(this.viewState, rest);
    return this.renderFrame();
  }

  /**
   * 單幀確定性渲染管線（回傳 Level 1 幾何遙測 JSON）
   */
  renderFrame() {
    const ctx = this.ctx;
    const { width, height } = this.canvas;
    ctx.clearRect(0, 0, width, height);

    // 1. 底層背景
    ctx.fillStyle = UI_CONFIG.VIEWPORT.BACKGROUND_COLOR;
    ctx.fillRect(0, 0, width, height);

    if (this.viewState.sceneMode === 'CAMPFIRE') {
      this._renderCampfireView(ctx);
    } else {
      this._renderDungeonView(ctx);
    }

    // 2. Gamma 離散階梯轉場遮罩（0~8 幀）
    if (this.viewState.gammaFadeStep > 0) {
      const alpha = Math.min(1, this.viewState.gammaFadeStep / UI_CONFIG.ENGINE.GAMMA_TRANSITION_FRAMES);
      ctx.fillStyle = `rgba(0, 0, 0, ${alpha.toFixed(3)})`;
      ctx.fillRect(0, 0, width, height);
    }

    return this.lastRenderTelemetry;
  }

  _renderCampfireView(ctx) {
    const centerX = Math.round(this.canvas.width / 2);
    const baseBackY = 310;
    const baseFrontY = 395;

    // 根骨骼離散幀位移同步
    let actorY = baseBackY;
    if (this.viewState.campfireStepPhase === 'FRONT_IDLE') {
      actorY = baseFrontY;
    } else if (this.viewState.campfireStepPhase === 'STEP_FORWARD') {
      const progress = Math.min(1, this.viewState.frameIndex / 11);
      actorY = Math.round(baseBackY + (baseFrontY - baseBackY) * progress);
    }

    // 營火光源與火堆視覺底座
    const grad = ctx.createRadialGradient(centerX, 430, 10, centerX, 430, 240);
    grad.addColorStop(0, 'rgba(249, 115, 22, 0.45)');
    grad.addColorStop(0.5, 'rgba(180, 83, 9, 0.18)');
    grad.addColorStop(1, 'rgba(8, 6, 5, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.fillStyle = '#ea580c';
    ctx.beginPath();
    ctx.ellipse(centerX, 445, 38, 16, 0, 0, Math.PI * 2);
    ctx.fill();

    // 繪製選角紙娃娃
    const layerOrder = UI_CONFIG.COF_LAYER_ORDER_BY_DIR[0];
    this._drawCompositePaperdoll(ctx, centerX, actorY, layerOrder);

    this.lastRenderTelemetry = {
      sceneMode: 'CAMPFIRE',
      actorScreenPivot: { x: centerX, y: actorY },
      layerOrderRendered: [...layerOrder],
      campfireStepPhase: this.viewState.campfireStepPhase,
      frameIndex: this.viewState.frameIndex
    };
  }

  _renderDungeonView(ctx) {
    const flags = this.viewState.debugFlags;
    if (flags.showSubTileGrid) {
      this._drawIsometricSubTileGrid(ctx);
    }

    const actorPivot = this.worldToScreen(
      this.viewState.actorWorldPos.x,
      this.viewState.actorWorldPos.y,
      this.viewState.actorWorldPos.z
    );
    const monsterPreset = UI_CONFIG.MONSTER_GEOMETRY_PRESETS[this.viewState.targetMonster.sizeClass];
    const monsterPivot = this.worldToScreen(
      this.viewState.targetMonster.worldPos.x,
      this.viewState.targetMonster.worldPos.y,
      this.viewState.targetMonster.worldPos.z
    );
    const fireSpawn = this.computeDirectionalFireSpawn();

    // 底層靈氣 Underlay
    const intentCfg = UI_CONFIG.AGENT_INTENT_MAP[this.viewState.agentIntent];
    if (intentCfg && intentCfg.auraOverlay) {
      ctx.save();
      ctx.strokeStyle = intentCfg.hudColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(actorPivot.x, actorPivot.y, 38, 19, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 連續 Swept Circle 碰撞走廊輔助線
    if (flags.showSweptCorridor) {
      ctx.save();
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.55)';
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(fireSpawn.screen.x, fireSpawn.screen.y);
      ctx.lineTo(monsterPivot.x, monsterPivot.y - monsterPreset.torsoHeightPx);
      ctx.stroke();
      ctx.restore();
    }

    // 繪製角色複合紙娃娃（依 COF 方向排序）
    const dir = this.viewState.direction;
    const layerOrder = UI_CONFIG.COF_LAYER_ORDER_BY_DIR[dir] || UI_CONFIG.COF_LAYER_ORDER_BY_DIR[0];
    this._drawCompositePaperdoll(ctx, actorPivot.x, actorPivot.y, layerOrder);

    // 繪製方向性發射偏移向量（Fire Offset Gizmo）
    if (flags.showFireOffsetGizmo) {
      ctx.save();
      ctx.strokeStyle = '#38bdf8';
      ctx.fillStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(actorPivot.x, actorPivot.y);
      ctx.lineTo(fireSpawn.screen.x, fireSpawn.screen.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(fireSpawn.screen.x, fireSpawn.screen.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = '11px monospace';
      ctx.fillText(
        `FireSpawn[${fireSpawn.dirLabel}] z=${UI_CONFIG.FIRE_OFFSET_CONFIG.DEFAULT_Z_FIRE_PX}px`,
        fireSpawn.screen.x + 8,
        fireSpawn.screen.y - 6
      );
      ctx.restore();
    }

    // 繪製目標怪物與圓柱體底面 + 受擊特效三明治軀幹錨點
    this._drawTargetMonsterAndAnchors(ctx, monsterPivot, monsterPreset, flags);

    // 左上角 COF 圖層堆疊遙測覆蓋層
    if (flags.showLayerOrderHUD) {
      this._drawLayerTelemetryOverlay(ctx, layerOrder, fireSpawn, monsterPivot, monsterPreset);
    }

    this.lastRenderTelemetry = {
      sceneMode: 'DUNGEON',
      direction: dir,
      animMode: this.viewState.animMode,
      frameIndex: this.viewState.frameIndex,
      holyShieldOverride: this.viewState.holyShieldOverride,
      layerOrderRendered: [...layerOrder],
      actorScreenPivot: actorPivot,
      fireSpawnScreen: fireSpawn.screen,
      monsterFootPivot: monsterPivot,
      monsterTorsoAnchor: {
        x: monsterPivot.x,
        y: monsterPivot.y - monsterPreset.torsoHeightPx
      },
      hitOverlayAnchorDeltaPx: 0
    };
  }

  _drawIsometricSubTileGrid(ctx) {
    const r = UI_CONFIG.VIEWPORT.SUBTILE_GRID_RADIUS;
    ctx.save();
    ctx.strokeStyle = 'rgba(199, 179, 119, 0.14)';
    ctx.lineWidth = 1;
    for (let i = -r; i <= r; i++) {
      const p1 = this.worldToScreen(i, -r, 0);
      const p2 = this.worldToScreen(i, r, 0);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();

      const q1 = this.worldToScreen(-r, i, 0);
      const q2 = this.worldToScreen(r, i, 0);
      ctx.beginPath();
      ctx.moveTo(q1.x, q1.y);
      ctx.lineTo(q2.x, q2.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawCompositePaperdoll(ctx, pivotX, pivotY, layerOrder) {
    const preset = UI_CONFIG.PAPERDOLL_PRESETS[this.viewState.characterClass] || UI_CONFIG.PAPERDOLL_PRESETS.PALADIN;
    const slots = preset.slots;
    const frameOsc = Math.sin((this.viewState.frameIndex / 8) * Math.PI * 2) * 2;

    ctx.save();
    for (const layerCode of layerOrder) {
      if (layerCode === 'LG') {
        ctx.fillStyle = slots.LG.color;
        ctx.fillRect(pivotX - 10, pivotY - 26, 20, 26);
      } else if (layerCode === 'TR') {
        ctx.fillStyle = slots.TR.color;
        ctx.fillRect(pivotX - 13, pivotY - 56 + frameOsc, 26, 30);
      } else if (layerCode === 'HD') {
        ctx.fillStyle = slots.HD.color;
        ctx.beginPath();
        ctx.arc(pivotX, pivotY - 66 + frameOsc, 10, 0, Math.PI * 2);
        ctx.fill();
      } else if (layerCode === 'LA') {
        ctx.fillStyle = slots.LA.color;
        ctx.fillRect(pivotX - 20, pivotY - 52 + frameOsc, 8, 22);
      } else if (layerCode === 'RA') {
        ctx.fillStyle = slots.RA.color;
        ctx.fillRect(pivotX + 12, pivotY - 52 + frameOsc, 8, 22);
      } else if (layerCode === 'RH') {
        ctx.strokeStyle = slots.RH.color;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(pivotX + 16, pivotY - 40 + frameOsc);
        ctx.lineTo(pivotX + 30, pivotY - 72 + frameOsc);
        ctx.stroke();
      } else if (layerCode === 'LH') {
        const isOverride = this.viewState.holyShieldOverride;
        ctx.fillStyle = isOverride ? slots.LH.overrideColor : slots.LH.baseColor;
        ctx.strokeStyle = isOverride ? '#fef08a' : '#475569';
        ctx.lineWidth = isOverride ? 2.5 : 1;
        ctx.beginPath();
        ctx.roundRect(pivotX - 28, pivotY - 56 + frameOsc, 18, 26, 4);
        ctx.fill();
        ctx.stroke();
        if (isOverride) {
          // 神聖之盾十字紋章視覺標記
          ctx.strokeStyle = '#713f12';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(pivotX - 19, pivotY - 52 + frameOsc);
          ctx.lineTo(pivotX - 19, pivotY - 34 + frameOsc);
          ctx.moveTo(pivotX - 25, pivotY - 44 + frameOsc);
          ctx.lineTo(pivotX - 13, pivotY - 44 + frameOsc);
          ctx.stroke();
        }
      } else if (layerCode === 'SH' && this.viewState.holyShieldOverride) {
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.45)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(pivotX - 19, pivotY - 43 + frameOsc, 17, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // 角色腳底基準點十字
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pivotX - 6, pivotY);
    ctx.lineTo(pivotX + 6, pivotY);
    ctx.moveTo(pivotX, pivotY - 6);
    ctx.lineTo(pivotX, pivotY + 6);
    ctx.stroke();
    ctx.restore();
  }

  _drawTargetMonsterAndAnchors(ctx, footPivot, preset, flags) {
    const halfTileW = UI_CONFIG.VIEWPORT.TILE_WIDTH / 2;
    const halfTileH = UI_CONFIG.VIEWPORT.TILE_HEIGHT / 2;
    const rx = preset.radiusSubTiles * halfTileW;
    const ry = preset.radiusSubTiles * halfTileH;
    const torsoY = footPivot.y - preset.torsoHeightPx;

    ctx.save();
    // 1. 底層：怪物圓柱體等距投影橢圓底面
    if (flags.showMonsterCylinder) {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.18)';
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(footPivot.x, footPivot.y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // 2. 中層：怪物本體輪廓與圓柱體高度
    ctx.fillStyle = 'rgba(153, 27, 27, 0.78)';
    ctx.strokeStyle = '#fca5a5';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(
      footPivot.x - Math.max(14, rx * 0.85),
      footPivot.y - preset.spriteHeightPx,
      Math.max(28, rx * 1.7),
      preset.spriteHeightPx,
      6
    );
    ctx.fill();
    ctx.stroke();

    // 3. 頂層（Foreground Overlay）：受擊特效三明治錨點強制鎖定於軀幹中心 (x_s, y_s - z_torso)
    if (this.viewState.targetMonster.showHitOverlay) {
      const hitGrad = ctx.createRadialGradient(footPivot.x, torsoY, 2, footPivot.x, torsoY, 24);
      hitGrad.addColorStop(0, 'rgba(254, 240, 138, 0.95)');
      hitGrad.addColorStop(0.5, 'rgba(249, 115, 22, 0.75)');
      hitGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
      ctx.fillStyle = hitGrad;
      ctx.beginPath();
      ctx.arc(footPivot.x, torsoY, 24, 0, Math.PI * 2);
      ctx.fill();
    }

    if (flags.showTorsoAnchor) {
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(footPivot.x - 8, torsoY);
      ctx.lineTo(footPivot.x + 8, torsoY);
      ctx.moveTo(footPivot.x, torsoY - 8);
      ctx.lineTo(footPivot.x, torsoY + 8);
      ctx.stroke();
      ctx.fillStyle = '#fef08a';
      ctx.font = '11px monospace';
      ctx.fillText(
        `TorsoAnchor (y - ${preset.torsoHeightPx}px) | R=${preset.radiusSubTiles}`,
        footPivot.x + 12,
        torsoY + 4
      );
    }
    ctx.restore();
  }

  _drawLayerTelemetryOverlay(ctx, layerOrder, fireSpawn, monsterPivot, monsterPreset) {
    ctx.save();
    ctx.fillStyle = 'rgba(12, 10, 9, 0.82)';
    ctx.strokeStyle = '#78716c';
    ctx.lineWidth = 1;
    ctx.fillRect(14, 14, 415, 92);
    ctx.strokeRect(14, 14, 415, 92);

    ctx.fillStyle = '#e7e5e4';
    ctx.font = '12px monospace';
    ctx.fillText(
      `[COF Z-Order Dir=${this.viewState.direction}]: ${layerOrder.join(' -> ')}`,
      24,
      36
    );
    const lhAsset = this.viewState.holyShieldOverride ? 'pal_lh_hsd (Holy Shield)' : 'pal_lh_kit (Base Shield)';
    ctx.fillStyle = '#facc15';
    ctx.fillText(`[Slot LH Active]: ${lhAsset} | Mode=${this.viewState.animMode} Frame=${this.viewState.frameIndex}`, 24, 56);
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(
      `[FireSpawn]: (${fireSpawn.screen.x}, ${fireSpawn.screen.y}) | [TorsoAnchor]: (${monsterPivot.x}, ${monsterPivot.y - monsterPreset.torsoHeightPx})`,
      24,
      76
    );
    ctx.fillStyle = '#a8a29e';
    ctx.fillText(`[Gamma Step]: ${this.viewState.gammaFadeStep}/8 | [Scene]: ${this.viewState.sceneMode}`, 24, 94);
    ctx.restore();
  }

  _installDeterministicHarness() {
    if (typeof window !== 'undefined') {
      window.__D2_HARNESS__ = {
        renderExact: (config) => this.setViewState(config),
        getTelemetry: () => this.lastRenderTelemetry,
        getConfig: () => UI_CONFIG
      };
    }
  }
}
