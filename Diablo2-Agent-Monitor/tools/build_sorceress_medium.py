#!/usr/bin/env python3
"""
build_sorceress_medium.py
為魔法使 (Sorceress) 從暴雪原版 MPQ DCC 全部件合成正統 16 方向中裝 (Medium Armor) 動作精靈圖集
包含:
1. 待命 (idle): NUHTH (8 frames, 16 directions)
2. 行走 (walk): WLHTH (8 frames, 16 directions)
3. 奔跑 (run): RNHTH (8 frames, 16 directions)
4. 攻擊 (attack): A1HTH (16 frames, 16 directions)
5. 施法 (cast): SCHTH (14 frames, 16 directions)

自動更新 web/assets/characters/sorceress/medium/manifest.json 與 manifest.js
"""

import sys, os, json, hashlib
from pathlib import Path
from PIL import Image

SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
TOOLS_DIR = PROJECT_DIR / 'tools'
sys.path.insert(0, str(TOOLS_DIR))

from rebuild_anchoring_system import composite_character_action, update_manifest

so_base = TOOLS_DIR / 'mpq_raw/d2char/data/global/CHARS/SO'
target_dir = PROJECT_DIR / 'web/assets/characters/sorceress/medium'
target_dir.mkdir(parents=True, exist_ok=True)

ACTIONS_CONFIG = {
    'idle': {
        'mode': 'NUHTH',
        'fps': 12,
        'loop': True
    },
    'walk': {
        'mode': 'WLHTH',
        'fps': 14,
        'loop': True
    },
    'run': {
        'mode': 'RNHTH',
        'fps': 18,
        'loop': True
    },
    'attack': {
        'mode': 'A1HTH',
        'fps': 20,
        'loop': False
    },
    'cast': {
        'mode': 'SCHTH',
        'fps': 16,
        'loop': False
    }
}

actions_manifest_dict = {}

for act_name, cfg in ACTIONS_CONFIG.items():
    mode = cfg['mode']
    cof_path = so_base / f'COF/so{mode.lower()}.cof'
    if not cof_path.exists():
        cof_path = so_base / f'COF/SO{mode}.COF'
        
    parts = {
        0: str(so_base / f'HD/SOHDLIT{mode}.dcc'),
        1: str(so_base / f'TR/SOTRMED{mode}.dcc'),
        2: str(so_base / f'LG/SOLGMED{mode}.dcc'),
        3: str(so_base / f'RA/SORAMED{mode}.dcc'),
        4: str(so_base / f'LA/SOLAMED{mode}.dcc'),
        8: str(so_base / f'S1/SOS1MED{mode}.dcc'),
        9: str(so_base / f'S2/SOS2MED{mode}.dcc'),
    }
    
    out_png = target_dir / f'sorceress_{act_name}.png'
    print(f"Synthesizing Sorceress [medium] {act_name}...")
    meta = composite_character_action('SO', str(cof_path), parts, str(out_png))
    
    actions_manifest_dict[act_name] = {
        'name': act_name,
        'file': f'sorceress_{act_name}.png',
        'directions': meta['directions'],
        'frames': meta['frames'],
        'cell_width': meta['cell_width'],
        'cell_height': meta['cell_height'],
        'anchor_x': meta['anchor_x'],
        'anchor_y': meta['anchor_y'],
        'fps': cfg['fps'],
        'loop': cfg['loop']
    }
    print(f" -> {act_name}: {meta['cell_width']}x{meta['cell_height']}, frames={meta['frames']}, dirs={meta['directions']}, ax={meta['anchor_x']}, ay={meta['anchor_y']}")

# 更新 manifest.json 與 manifest.js
update_manifest(target_dir, "SORCERESS_MEDIUM_MANIFEST", actions_manifest_dict)
print("\nSorceress medium manifest updated successfully!")

# MD5 驗證
def get_md5(fpath):
    with open(fpath, 'rb') as f:
        return hashlib.md5(f.read()).hexdigest()

print("\n--- Tier MD5 Verification ---")
for act in ['idle', 'walk', 'run', 'attack', 'cast']:
    m_med = get_md5(target_dir / f'sorceress_{act}.png')
    m_lit = get_md5(PROJECT_DIR / f'web/assets/characters/sorceress/light/sorceress_{act}.png')
    m_hvy = get_md5(PROJECT_DIR / f'web/assets/characters/sorceress/heavy/sorceress_{act}.png')
    is_distinct = (m_med != m_lit and m_med != m_hvy)
    print(f"{act:8}: medium={m_med[:8]}, light={m_lit[:8]}, heavy={m_hvy[:8]} -> Distinct: {is_distinct}")
