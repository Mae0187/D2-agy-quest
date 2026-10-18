/**
 * @file d2-engine/templates/ui_config.js
 * @description Single Source of Truth (SSOT) UI & Geometry Configuration for D2-agy-quest (Phase 1)
 */

export const PATH_RESOLVER = {
  /**
   * 兼容 Web 相對路徑與 Python PyInstaller (sys._MEIPASS) 注入環境之靜態資源解析器
   * @param {string} relativePath 欲載入之資產相對路徑
   * @returns {string} 完整解析路徑
   */
  resolveAssetPath(relativePath) {
    const cleanRel = String(relativePath).replace(/^\/+/, '');
    if (typeof window !== 'undefined' && window.__D2_ENV__ && window.__D2_ENV__.MEIPASS_BASE_URL) {
      const base = String(window.__D2_ENV__.MEIPASS_BASE_URL).replace(/\/+$/, '');
      return `${base}/${cleanRel}`;
    }
    return `./assets/${cleanRel}`;
  }
};

export const UI_CONFIG = Object.freeze({
  ENGINE: {
    FPS: 25,
    TICK_MS: 40,
    COALESCE_WINDOW_MS: 120,
    COALESCE_TICKS: 3,
    GAMMA_TRANSITION_FRAMES: 8,
    DEFAULT_SEED: 0x113CD200
  },

  VIEWPORT: {
    WIDTH: 960,
    HEIGHT: 600,
    TILE_WIDTH: 32,
    TILE_HEIGHT: 16,
    SUBTILE_GRID_RADIUS: 14,
    BACKGROUND_COLOR: '#080605'
  },

  /**
   * 2. AGENT 狀態機映射結構對齊（定義視覺與動畫碼呈現）
   */
  AGENT_INTENT_MAP: {
    IDLE_PATROL: {
      intent: 'IDLE_PATROL',
      priority: 3,
      d2AnimModes: ['TN', 'WL'],
      auraOverlay: null,
      hudLabel: 'IDLE PATROL // 地牢巡邏待命',
      hudColor: '#c7b377',
      orbGlow: 'rgba(199, 179, 119, 0.35)'
    },
    DEEP_THINKING: {
      intent: 'DEEP_THINKING',
      priority: 2,
      d2AnimModes: ['TN'],
      auraOverlay: 'meditation_aura',
      hudLabel: 'DEEP THINKING // 深度推理靈氣展開',
      hudColor: '#4882e8',
      orbGlow: 'rgba(72, 130, 232, 0.65)'
    },
    CODE_GENERATING: {
      intent: 'CODE_GENERATING',
      priority: 2,
      d2AnimModes: ['A1', 'A2'],
      auraOverlay: 'fanaticism_aura',
      hudLabel: 'CODE STREAMING // 高速連斬生成代碼',
      hudColor: '#f5c542',
      orbGlow: 'rgba(245, 197, 66, 0.7)'
    },
    TOOL_EXECUTING: {
      intent: 'TOOL_EXECUTING',
      priority: 1,
      d2AnimModes: ['SC'],
      auraOverlay: 'conviction_aura',
      hudLabel: 'TOOL EXECUTING // 調用工具施法',
      hudColor: '#a855f7',
      orbGlow: 'rgba(168, 85, 247, 0.7)'
    },
    TEST_AOE: {
      intent: 'TEST_AOE',
      priority: 1,
      d2AnimModes: ['SC'],
      auraOverlay: 'holy_freeze_aura',
      hudLabel: 'TEST AOE // 單元測試範圍爆發',
      hudColor: '#22d3ee',
      orbGlow: 'rgba(34, 211, 238, 0.8)'
    },
    ERROR_HAZARD: {
      intent: 'ERROR_HAZARD',
      priority: 0,
      d2AnimModes: ['BL', 'GH'],
      auraOverlay: 'amplify_damage_curse',
      hudLabel: 'ERROR HAZARD // 例外報錯受創格擋',
      hudColor: '#ef4444',
      orbGlow: 'rgba(239, 68, 68, 0.9)'
    },
    QUEST_COMPLETE: {
      intent: 'QUEST_COMPLETE',
      priority: 0,
      d2AnimModes: ['NU'],
      auraOverlay: 'tyrael_wings_glow',
      hudLabel: 'QUEST COMPLETE // 菁英擊殺任務完成',
      hudColor: '#d99b26',
      orbGlow: 'rgba(217, 155, 38, 0.95)'
    }
  },

  /**
   * 3.1 鐵律 12：方向性發射偏移（Directional Fire Offset）
   * 支援 8 方向主基準與法杖/左手/右手側向偏移、預設離地高度 40px
   */
  FIRE_OFFSET_CONFIG: {
    DEFAULT_Z_FIRE_PX: 40,
    HAND_LATERAL_SUBTILES: {
      RIGHT_HAND: 0.28,
      LEFT_HAND: -0.28,
      STAFF_CENTER: 0.0
    },
    FORWARD_RADIUS_SUBTILES: 0.65,
    /**
     * 8 方向（0:南, 1:西南, 2:西, 3:西北, 4:北, 5:東北, 6:東, 7:東南）角度與螢幕微調像素 (dx, dy)
     */
    DIRECTION_8_TABLE: [
      { dir: 0, label: 'S',  angleRad: Math.PI * 0.25,  dx: 0,  dy: 4  },
      { dir: 1, label: 'SW', angleRad: Math.PI * 0.50,  dx: -4, dy: 2  },
      { dir: 2, label: 'W',  angleRad: Math.PI * 0.75,  dx: -6, dy: 0  },
      { dir: 3, label: 'NW', angleRad: Math.PI * 1.00,  dx: -4, dy: -3 },
      { dir: 4, label: 'N',  angleRad: Math.PI * 1.25,  dx: 0,  dy: -5 },
      { dir: 5, label: 'NE', angleRad: Math.PI * 1.50,  dx: 4,  dy: -3 },
      { dir: 6, label: 'E',  angleRad: Math.PI * 1.75,  dx: 6,  dy: 0  },
      { dir: 7, label: 'SE', angleRad: 0.0,             dx: 4,  dy: 2  }
    ],
    /**
     * 16 方向角度映射表（支援更高精度投射物發射計算）
     */
    DIRECTION_16_TABLE: Array.from({ length: 16 }, (_, i) => ({
      dir: i,
      label: `D16_${i}`,
      angleRad: (i * (Math.PI / 8)),
      dx: 0,
      dy: 0
    }))
  },

  /**
   * 3.2 & 3.3 鐵律 12：怪物圓柱體半徑（0.5 / 1.0 / 1.5 sub-tiles）與受擊軀幹錨點高度（z_torso）
   */
  MONSTER_GEOMETRY_PRESETS: {
    SMALL: {
      sizeClass: 'SMALL',
      radiusSubTiles: 0.5,
      torsoHeightPx: 28,
      spriteHeightPx: 56,
      label: 'Small (0.5 sub-tile / Fallen)'
    },
    MEDIUM: {
      sizeClass: 'MEDIUM',
      radiusSubTiles: 1.0,
      torsoHeightPx: 44,
      spriteHeightPx: 88,
      label: 'Medium (1.0 sub-tile / Doom Knight)'
    },
    LARGE: {
      sizeClass: 'LARGE',
      radiusSubTiles: 1.5,
      torsoHeightPx: 64,
      spriteHeightPx: 128,
      label: 'Large (1.5 sub-tiles / Balrog Elite)'
    }
  },

  /**
   * 維度四：複合紙娃娃 COF 圖層繪製順序表（依 8 方向動態調整盾牌 LH 與右武 RH 前後遮擋）
   */
  COF_LAYER_ORDER_BY_DIR: {
    0: ['LG', 'TR', 'LA', 'RA', 'HD', 'RH', 'LH', 'SH'], // S: 盾牌在最前
    1: ['LG', 'RA', 'RH', 'TR', 'HD', 'LA', 'LH', 'SH'], // SW: 左盾在前、右武在後
    2: ['LG', 'RA', 'RH', 'TR', 'HD', 'LA', 'LH', 'SH'], // W: 左側朝向鏡頭
    3: ['RH', 'RA', 'LG', 'TR', 'HD', 'LA', 'LH', 'SH'], // NW: 背側面
    4: ['LH', 'LA', 'RH', 'RA', 'LG', 'TR', 'HD', 'SH'], // N: 背對鏡頭，盾武皆被軀幹遮擋
    5: ['LH', 'LA', 'LG', 'TR', 'HD', 'RA', 'RH', 'SH'], // NE: 右武在前、左盾在後
    6: ['LH', 'LA', 'LG', 'TR', 'HD', 'RA', 'RH', 'SH'], // E: 右側朝向鏡頭
    7: ['LG', 'LA', 'LH', 'TR', 'HD', 'RA', 'RH', 'SH']  // SE: 右武偏前
  },

  /**
   * 角色裝備槽位與神聖之盾動態覆寫預覽配置
   */
  PAPERDOLL_PRESETS: {
    PALADIN: {
      classId: 'paladin',
      displayName: 'Paladin (聖騎士)',
      animTotalFrames: { NU: 8, TN: 8, WL: 8, RN: 8, A1: 10, A2: 10, SC: 12, BL: 4, GH: 6 },
      actionFlagFrame: { A1: 5, A2: 5, SC: 6 },
      slots: {
        HD: { baseAsset: 'pal_hd_cap', color: '#d4d4d8' },
        TR: { baseAsset: 'pal_tr_plt', color: '#71717a' },
        LG: { baseAsset: 'pal_lg_plt', color: '#52525b' },
        LA: { baseAsset: 'pal_la_plt', color: '#a1a1aa' },
        RA: { baseAsset: 'pal_ra_plt', color: '#a1a1aa' },
        RH: { baseAsset: 'pal_rh_flc', color: '#60a5fa' },
        LH: { baseAsset: 'pal_lh_kit', overrideAsset: 'pal_lh_hsd', baseColor: '#94a3b8', overrideColor: '#facc15' },
        SH: { baseAsset: null, overrideAsset: 'holy_shield_glow' }
      }
    },
    SORCERESS: {
      classId: 'sorceress',
      displayName: 'Sorceress (法師)',
      animTotalFrames: { NU: 8, TN: 8, WL: 8, RN: 8, A1: 12, A2: 12, SC: 14, BL: 5, GH: 6 },
      actionFlagFrame: { A1: 6, A2: 6, SC: 7 },
      slots: {
        HD: { baseAsset: 'sor_hd_ci0', color: '#fde047' },
        TR: { baseAsset: 'sor_tr_ltp', color: '#7e22ce' },
        LG: { baseAsset: 'sor_lg_ltp', color: '#581c87' },
        LA: { baseAsset: 'sor_la_ltp', color: '#a855f7' },
        RA: { baseAsset: 'sor_ra_ltp', color: '#a855f7' },
        RH: { baseAsset: 'sor_rh_ob1', color: '#38bdf8' },
        LH: { baseAsset: 'sor_lh_lid', overrideAsset: 'sor_lh_bsh', baseColor: '#c084fc', overrideColor: '#e879f9' },
        SH: { baseAsset: null, overrideAsset: 'energy_shield_glow' }
      }
    }
  }
});
