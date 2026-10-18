/**
 * @file d2-engine/templates/d2_combat_hsm.js
 * @description 120ms Event Coalescing Queue, Hierarchical Combat State Machine (HSM),
 *              Atomic Equipment Override, and 5-Stage Campfire-to-Dungeon Transition Director.
 */

import { UI_CONFIG } from './ui_config.js';

/**
 * 確定性偽隨機數產生器 (Mulberry32) — 確保無頭瀏覽器視覺回歸測試 100% 可重現
 */
export class SeededPRNG {
  constructor(seed = UI_CONFIG.ENGINE.DEFAULT_SEED) {
    this.state = seed >>> 0;
  }

  nextFloat() {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

/**
 * 簡單 Signal 發射器，用於 Model 層與 View/Controller 層之 Signal/Slot 解耦通訊
 */
export class SignalEmitter {
  constructor() {
    this.listeners = new Map();
  }

  connect(signalName, slotCallback) {
    if (!this.listeners.has(signalName)) {
      this.listeners.set(signalName, new Set());
    }
    this.listeners.get(signalName).add(slotCallback);
    return () => this.listeners.get(signalName)?.delete(slotCallback);
  }

  emit(signalName, payload) {
    const callbacks = this.listeners.get(signalName);
    if (!callbacks) return;
    for (const cb of callbacks) {
      cb(payload);
    }
  }
}

/**
 * 120ms (3 Ticks) 滑動時間窗事件聚合器與優先級佇列
 */
export class EventCoalescerQueue {
  constructor() {
    this.coalesceWindowMs = UI_CONFIG.ENGINE.COALESCE_WINDOW_MS;
    this.pendingCoalesceMap = new Map();
    this.priorityQueue = [];
    this.seqCounter = 0;
  }

  /**
   * 推入正規化後之 Agent 事件
   * @param {{ intent: string, timestampMs?: number, payload?: object }} rawEvent
   * @param {number} nowMs 當前邏輯時鐘毫秒
   */
  pushEvent(rawEvent, nowMs) {
    const intentKey = rawEvent.intent;
    const intentSpec = UI_CONFIG.AGENT_INTENT_MAP[intentKey];
    if (!intentSpec) return;

    const priority = intentSpec.priority;

    // P = 0 (ERROR_HAZARD / QUEST_COMPLETE) 立即繞過聚合窗並排入最前端
    if (priority === 0) {
      if (intentKey === 'ERROR_HAZARD') {
        this.clearNonCritical();
      }
      this._enqueueDirect(intentKey, priority, rawEvent.payload || {}, nowMs, 1);
      return;
    }

    // 針對 CODE_GENERATING 與 TOOL_EXECUTING 進行 120ms 時間窗聚合
    if (intentKey === 'CODE_GENERATING' || intentKey === 'DEEP_THINKING') {
      const existing = this.pendingCoalesceMap.get(intentKey);
      if (existing && (nowMs - existing.firstSeenMs) <= this.coalesceWindowMs) {
        existing.burstCount += 1;
        existing.lastSeenMs = nowMs;
        existing.payload = { ...existing.payload, ...(rawEvent.payload || {}) };
        return;
      }
      const bucket = {
        intent: intentKey,
        priority,
        firstSeenMs: nowMs,
        lastSeenMs: nowMs,
        burstCount: 1,
        payload: rawEvent.payload || {}
      };
      this.pendingCoalesceMap.set(intentKey, bucket);
      return;
    }

    this._enqueueDirect(intentKey, priority, rawEvent.payload || {}, nowMs, 1);
  }

  /**
   * 每個 40ms Tick 由狀態機呼叫，將屆滿 120ms 聚合窗之事件刷入優先級佇列
   * @param {number} nowMs 當前邏輯時鐘毫秒
   */
  flushExpiredBuckets(nowMs) {
    for (const [key, bucket] of this.pendingCoalesceMap.entries()) {
      if ((nowMs - bucket.firstSeenMs) >= this.coalesceWindowMs) {
        this._enqueueDirect(
          bucket.intent,
          bucket.priority,
          bucket.payload,
          bucket.lastSeenMs,
          bucket.burstCount
        );
        this.pendingCoalesceMap.delete(key);
      }
    }
  }

  _enqueueDirect(intent, priority, payload, timestampMs, burstCount) {
    this.seqCounter += 1;
    this.priorityQueue.push({
      intent,
      priority,
      payload,
      timestampMs,
      burstCount,
      seq: this.seqCounter
    });
    // 依優先級升序排列（0 最優先），同優先級依序號先進先出
    this.priorityQueue.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.seq - b.seq;
    });
  }

  peekHighest() {
    return this.priorityQueue.length > 0 ? this.priorityQueue[0] : null;
  }

  popHighest() {
    return this.priorityQueue.shift() || null;
  }

  clearNonCritical() {
    this.pendingCoalesceMap.clear();
    this.priorityQueue = this.priorityQueue.filter((item) => item.priority === 0);
  }

  getQueueSnapshot() {
    return {
      queuedCount: this.priorityQueue.length,
      coalescingKeys: Array.from(this.pendingCoalesceMap.keys()),
      topItem: this.peekHighest()
    };
  }
}

/**
 * 階層式戰鬥與轉場狀態機 (D2CombatHSM)
 */
export class D2CombatHSM {
  constructor(seed = UI_CONFIG.ENGINE.DEFAULT_SEED) {
    this.prng = new SeededPRNG(seed);
    this.signals = new SignalEmitter();
    this.eventQueue = new EventCoalescerQueue();

    this.clockMs = 0;
    this.tickCount = 0;

    // 角色與狀態機核心欄位
    this.state = {
      sceneMode: 'DUNGEON',           // 'CAMPFIRE' | 'DUNGEON'
      transitionStage: 'ACTIVE',      // 'ACTIVE' | 'COMMIT_WAIT' | 'GAMMA_OUT' | 'HANDOVER' | 'GAMMA_IN'
      gammaFadeStep: 0,
      campfireStepPhase: 'FRONT_IDLE', // 'BACK_IDLE' | 'STEP_FORWARD' | 'FRONT_IDLE'
      characterClass: 'PALADIN',
      agentIntent: 'IDLE_PATROL',
      animMode: 'TN',
      direction: 0,
      frameIndex: 0,
      comboToggle: 0,                 // 用於 A1 <-> A2 連斬交替
      burstExtensionLoops: 0,         // 高頻聚合延長迴圈數
      holyShieldOverride: true,
      pendingHolyShieldToggle: null,  // 等待 SC 關鍵幀切換之目標布林值
      handSource: 'RIGHT_HAND',
      actorWorldPos: { x: 0, y: 0, z: 0 },
      lifePct: 100,
      manaPct: 100
    };
  }

  /**
   * 外部投遞 Agent 狀態事件（Slot 入口）
   */
  receiveAgentEvent(eventObj) {
    this.eventQueue.pushEvent(eventObj, this.clockMs);
  }

  /**
   * 預約於下一次施法動作 (SC) 關鍵幀切換神聖之盾狀態
   */
  requestHolyShieldCast(enableOverride) {
    this.state.pendingHolyShieldToggle = Boolean(enableOverride);
    this.receiveAgentEvent({
      intent: 'TOOL_EXECUTING',
      payload: { skillType: 'HOLY_SHIELD_CAST' }
    });
  }

  /**
   * 啟動營火選角至地牢之五階段無縫轉場導演協定
   */
  triggerCampfireToDungeonTransition() {
    if (this.state.sceneMode !== 'CAMPFIRE') return;
    if (this.state.campfireStepPhase === 'BACK_IDLE') {
      this.state.campfireStepPhase = 'STEP_FORWARD';
      this.state.frameIndex = 0;
    }
    this.state.transitionStage = 'COMMIT_WAIT';
  }

  /**
   * 固定 25 FPS (40ms) 推進一個遊戲 Tick
   */
  stepTick() {
    this.clockMs += UI_CONFIG.ENGINE.TICK_MS;
    this.tickCount += 1;

    // 1. 若處於營火轉場管線，優先執行五階段轉場導演
    if (this.state.transitionStage !== 'ACTIVE') {
      this._stepSceneTransitionDirector();
      this.signals.emit('stateUpdated', this.getSnapshot());
      return;
    }

    // 2. 刷新屆滿 120ms 之聚合事件桶
    this.eventQueue.flushExpiredBuckets(this.clockMs);

    // 3. 檢查是否有 P = 0 (ERROR_HAZARD) 強制搶佔事件
    const topEvent = this.eventQueue.peekHighest();
    if (topEvent && topEvent.priority === 0 && topEvent.intent === 'ERROR_HAZARD') {
      this.eventQueue.popHighest();
      this._applyImmediateInterrupt(topEvent);
      this.signals.emit('stateUpdated', this.getSnapshot());
      return;
    }

    // 4. 取得當前職業動畫總幀數 N 與關鍵動作幀 f_act
    const classPreset = UI_CONFIG.PAPERDOLL_PRESETS[this.state.characterClass] || UI_CONFIG.PAPERDOLL_PRESETS.PALADIN;
    const totalFrames = classPreset.animTotalFrames[this.state.animMode] || 8;
    const actionFrame = classPreset.actionFlagFrame[this.state.animMode] ?? Math.floor(totalFrames / 2);

    // 5. 推進動畫幀計數
    const nextFrame = this.state.frameIndex + 1;

    // 6. 檢查是否抵達關鍵動作幀 f_act（觸發投射物發射、AoE 或神聖之盾原子性換裝）
    if (this.state.frameIndex === actionFrame) {
      this._onActionFlagFrameReached();
      // 若佇列中有更高優先級之一般指令 (P <= 1)，允許在完成關鍵幀打擊後平滑切入
      const candidate = this.eventQueue.peekHighest();
      if (candidate && candidate.priority <= 1 && candidate.intent !== this.state.agentIntent) {
        const nextCmd = this.eventQueue.popHighest();
        this._transitionToIntent(nextCmd);
        this.signals.emit('stateUpdated', this.getSnapshot());
        return;
      }
    }

    // 7. 動畫迴圈結束幀 (f_cur == N - 1) 狀態轉移判定
    if (nextFrame >= totalFrames) {
      if (this.state.burstExtensionLoops > 0) {
        this.state.burstExtensionLoops -= 1;
        this.state.frameIndex = 0;
        // 連斬模式下 A1 與 A2 交替播放
        if (this.state.agentIntent === 'CODE_GENERATING') {
          this.state.comboToggle = 1 - this.state.comboToggle;
          this.state.animMode = this.state.comboToggle === 0 ? 'A1' : 'A2';
        }
      } else if (this.eventQueue.peekHighest()) {
        const nextCmd = this.eventQueue.popHighest();
        this._transitionToIntent(nextCmd);
      } else {
        // 佇列已空，平滑回歸 IDLE_PATROL (TN)
        this.state.agentIntent = 'IDLE_PATROL';
        this.state.animMode = 'TN';
        this.state.frameIndex = 0;
      }
    } else {
      this.state.frameIndex = nextFrame;
    }

    this.signals.emit('stateUpdated', this.getSnapshot());
  }

  _applyImmediateInterrupt(errorEvent) {
    this.state.agentIntent = 'ERROR_HAZARD';
    const isFatal = Boolean(errorEvent.payload?.fatal);
    // 輕微錯誤舉盾格擋 (BL)，嚴重錯誤受創後仰 (GH)
    this.state.animMode = isFatal ? 'GH' : 'BL';
    this.state.frameIndex = 0;
    this.state.burstExtensionLoops = 0;
    this.state.lifePct = Math.max(15, this.state.lifePct - (isFatal ? 25 : 8));

    this.signals.emit('combatActionTriggered', {
      type: isFatal ? 'HAZARD_GET_HIT' : 'HAZARD_BLOCK',
      intent: 'ERROR_HAZARD',
      direction: this.state.direction
    });
  }

  _transitionToIntent(cmd) {
    const spec = UI_CONFIG.AGENT_INTENT_MAP[cmd.intent];
    if (!spec) return;

    this.state.agentIntent = cmd.intent;
    this.state.frameIndex = 0;

    if (cmd.intent === 'CODE_GENERATING') {
      this.state.comboToggle = 1 - this.state.comboToggle;
      this.state.animMode = this.state.comboToggle === 0 ? 'A1' : 'A2';
      // 依據 120ms 聚合之 burstCount 決定延長連斬迴圈次數
      this.state.burstExtensionLoops = Math.min(3, Math.max(0, (cmd.burstCount || 1) - 1));
    } else {
      this.state.animMode = spec.d2AnimModes[0] || 'TN';
      this.state.burstExtensionLoops = 0;
    }

    if (cmd.intent === 'QUEST_COMPLETE') {
      this.state.lifePct = 100;
      this.state.manaPct = 100;
      this.signals.emit('combatActionTriggered', {
        type: 'ELITE_KILL_LOOT_DROP',
        intent: 'QUEST_COMPLETE',
        direction: this.state.direction
      });
    }
  }

  _onActionFlagFrameReached() {
    // 處理神聖之盾於 SC 關鍵幀之原子性圖集覆寫
    if (this.state.animMode === 'SC' && this.state.pendingHolyShieldToggle !== null) {
      this.state.holyShieldOverride = this.state.pendingHolyShieldToggle;
      this.state.pendingHolyShieldToggle = null;
      this.signals.emit('holyShieldToggled', {
        holyShieldOverride: this.state.holyShieldOverride,
        frameIndex: this.state.frameIndex
      });
    }

    // 觸發武器揮砍或法術投射物發射 Signal
    if (
      this.state.agentIntent === 'CODE_GENERATING' ||
      this.state.agentIntent === 'TOOL_EXECUTING' ||
      this.state.agentIntent === 'TEST_AOE'
    ) {
      const isAoE = this.state.agentIntent === 'TEST_AOE';
      this.state.manaPct = Math.max(10, this.state.manaPct - (isAoE ? 12 : 4));
      this.signals.emit('spawnProjectileRequested', {
        intent: this.state.agentIntent,
        animMode: this.state.animMode,
        direction: this.state.direction,
        handSource: this.state.handSource,
        isAoE
      });
    }
  }

  /**
   * 維度五：營火選角至地牢五階段無縫轉場導演
   */
  _stepSceneTransitionDirector() {
    const maxGamma = UI_CONFIG.ENGINE.GAMMA_TRANSITION_FRAMES;

    if (this.state.transitionStage === 'COMMIT_WAIT') {
      // 階段一：若角色尚在 STEP_FORWARD，等待完整走完 12 幀 (0~11) 抵達前景錨點
      if (this.state.campfireStepPhase === 'STEP_FORWARD') {
        if (this.state.frameIndex < 11) {
          this.state.frameIndex += 1;
          return;
        }
        this.state.campfireStepPhase = 'FRONT_IDLE';
        this.state.frameIndex = 0;
      }
      this.state.transitionStage = 'GAMMA_OUT';
      this.state.gammaFadeStep = 0;
    } else if (this.state.transitionStage === 'GAMMA_OUT') {
      // 階段二：8 幀 (320ms) 調色盤 Gamma 衰減至全黑
      this.state.gammaFadeStep += 1;
      if (this.state.gammaFadeStep >= maxGamma) {
        this.state.transitionStage = 'HANDOVER';
      }
    } else if (this.state.transitionStage === 'HANDOVER') {
      // 階段三：共用 Canvas 上下文原子性切換至地牢場景，保留職業與神聖之盾裝備狀態
      this.state.sceneMode = 'DUNGEON';
      this.state.direction = 0;
      this.state.animMode = 'WL';
      this.state.frameIndex = 0;
      this.state.transitionStage = 'GAMMA_IN';
    } else if (this.state.transitionStage === 'GAMMA_IN') {
      // 階段四 & 五：8 幀 Gamma 漸亮並踏出 4 幀 WL 進入 TN 警戒巡邏，解除轉場鎖定
      this.state.gammaFadeStep = Math.max(0, this.state.gammaFadeStep - 1);
      this.state.frameIndex = (this.state.frameIndex + 1) % 8;
      if (this.state.gammaFadeStep === 0) {
        this.state.animMode = 'TN';
        this.state.frameIndex = 0;
        this.state.transitionStage = 'ACTIVE';
      }
    }
  }

  getSnapshot() {
    return {
      ...this.state,
      actorWorldPos: { ...this.state.actorWorldPos },
      clockMs: this.clockMs,
      tickCount: this.tickCount,
      queueStatus: this.eventQueue.getQueueSnapshot()
    };
  }
}
