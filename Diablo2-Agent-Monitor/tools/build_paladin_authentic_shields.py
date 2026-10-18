#!/usr/bin/env python3
"""
build_paladin_authentic_shields.py
為聖騎士重裝 (Heavy) 雙盾形態以原廠 MPQ DCC + COF 合成無瑕動作圖集：
1. 重裝·紋章盾 (Heavy Heraldic Shield) -> web/assets/characters/paladin/heavy/
2. 重裝·塔盾 (Heavy Tower Shield) -> web/assets/characters/paladin/heavy_tower/

包含:
- idle: PANU1HS (8 frames, 16 dirs)
- walk: PAWL1HS (10 frames, 16 dirs)
- run: PARN1HS (8 frames, 16 dirs)
- attack: PAA11HS (15 frames, 16 dirs)
- cast: PASC1HS (16 frames, 16 dirs)

嚴格遵守 AGY 規範：原廠二進位 DCC 解碼，非固定網格 Bounding Box 與腳底錨定，0 空性格，0 抖動。
"""

import sys, os, json
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
TOOLS_DIR = PROJECT_DIR / 'tools'
sys.path.insert(0, str(TOOLS_DIR))

from rebuild_anchoring_system import composite_character_action, update_manifest

pa_base = TOOLS_DIR / 'mpq_raw/d2char/data/global/CHARS/PA'

actions_config = {
    'idle': {
        'cof': 'PANU1HS.COF',
        'sfx': 'NU1HS',
        'fps': 12, 'loop': True
    },
    'walk': {
        'cof': 'PAWL1HS.COF',
        'sfx': 'WL1HS',
        'fps': 14, 'loop': True
    },
    'run': {
        'cof': 'PARN1HS.COF',
        'sfx': 'RN1HS',
        'fps': 18, 'loop': True
    },
    'attack': {
        'cof': 'PAA11HS.COF',
        'sfx': 'A11HS',
        'fps': 20, 'loop': False
    },
    'cast': {
        'cof': 'PASC1HS.COF',
        'sfx': 'SC1HS',
        'fps': 16, 'loop': False
    }
}

variants = [
    {
        'tier': 'heavy',
        'shield_code': 'HSH',
        'var_name': 'PALADIN_HEAVY_MANIFEST',
        'desc': 'Diablo II Paladin (Heavy Armor, Heraldic Shield) 16-direction action sprite set'
    },
    {
        'tier': 'heavy_tower',
        'shield_code': 'TOW',
        'var_name': 'PALADIN_HEAVY_TOWER_MANIFEST',
        'desc': 'Diablo II Paladin (Heavy Armor, Tower Shield) 16-direction action sprite set'
    }
]

for var in variants:
    tier = var['tier']
    s_code = var['shield_code']
    target_dir = PROJECT_DIR / f'web/assets/characters/paladin/{tier}'
    target_dir.mkdir(parents=True, exist_ok=True)
    
    actions_manifest = {}
    print(f"\n=== Synthesizing Paladin [{tier}] (Shield: {s_code}) ===")
    
    for act_name, cfg in actions_config.items():
        sfx = cfg['sfx']
        cof_path = pa_base / f"COF/{cfg['cof']}"
        parts = {
            0: str(pa_base / f'HD/PAHDGHM{sfx}.dcc'),
            1: str(pa_base / f'TR/PATRHVY{sfx}.dcc'),
            2: str(pa_base / f'LG/PALGHVY{sfx}.dcc'),
            3: str(pa_base / f'RA/PARAHVY{sfx}.dcc'),
            4: str(pa_base / f'LA/PALAHVY{sfx}.dcc'),
            5: str(pa_base / f'RH/PARHSSD{sfx}.dcc'),
            7: str(pa_base / f'SH/PASH{s_code}{sfx}.dcc'),
            8: str(pa_base / f'S1/PAS1HVY{sfx}.dcc'),
            9: str(pa_base / f'S2/PAS2HVY{sfx}.dcc'),
        }
        out_png = target_dir / f"paladin_{act_name}.png"
        meta = composite_character_action('PA', str(cof_path), parts, str(out_png))
        actions_manifest[act_name] = {
            'name': act_name,
            'file': f'paladin_{act_name}.png',
            'directions': meta['directions'],
            'frames': meta['frames'],
            'cell_width': meta['cell_width'],
            'cell_height': meta['cell_height'],
            'anchor_x': meta['anchor_x'],
            'anchor_y': meta['anchor_y'],
            'fps': cfg['fps'],
            'loop': cfg['loop']
        }
        print(f"  [{tier}] {act_name:<8}: {meta['cell_width']}x{meta['cell_height']}, frames={meta['frames']}, ax={meta['anchor_x']}, ay={meta['anchor_y']}")
        
    update_manifest(target_dir, var['var_name'], actions_manifest)

print("\nPaladin dual shields authentic synthesis completed successfully!")
