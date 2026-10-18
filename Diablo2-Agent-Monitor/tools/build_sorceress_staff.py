#!/usr/bin/env python3
"""
build_sorceress_staff.py
為魔法使 (Sorceress) 中裝 (Medium Armor) 合成正統雙手長法杖 (Long Staff - LST) 動作圖集
包含:
1. 待命 (idle): SONUSTF (8 frames, 16 dirs)
2. 行走 (walk): SOWLSTF (8 frames, 16 dirs)
3. 奔跑 (run): SORNSTF (8 frames, 16 dirs)
4. 攻擊 (attack): SOA1STF (18 frames, 16 dirs)
5. 施法 (cast): SOSCSTF (14 frames, 16 dirs)

更新 web/assets/characters/sorceress/medium/manifest.json 與 manifest.js
"""

import sys, os, json
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
TOOLS_DIR = PROJECT_DIR / 'tools'
sys.path.insert(0, str(TOOLS_DIR))

from rebuild_anchoring_system import composite_character_action, update_manifest

so_base = TOOLS_DIR / 'mpq_raw/d2char/data/global/CHARS/SO'
target_dir = PROJECT_DIR / 'web/assets/characters/sorceress/medium'
target_dir.mkdir(parents=True, exist_ok=True)

# 長法杖各動作對應部件
actions_config = {
    'idle': {
        'cof': 'SONUSTF.COF',
        'fps': 12, 'loop': True,
        'parts': {
            0: str(so_base / 'HD/SOHDLITNUHTH.dcc'),
            1: str(so_base / 'TR/SOTRMEDNUHTH.dcc'),
            2: str(so_base / 'LG/SOLGMEDNUHTH.dcc'),
            3: str(so_base / 'RA/SORAMEDNUHTH.dcc'),
            4: str(so_base / 'LA/SOLAMEDNUHTH.dcc'),
            5: str(so_base / 'RH/SORHLSTNUSTF.dcc'),
            8: str(so_base / 'S1/SOS1MEDNUHTH.dcc'),
            9: str(so_base / 'S2/SOS2MEDNUHTH.dcc'),
        }
    },
    'walk': {
        'cof': 'SOWLSTF.COF',
        'fps': 14, 'loop': True,
        'parts': {
            0: str(so_base / 'HD/SOHDLITWLHTH.dcc'),
            1: str(so_base / 'TR/SOTRMEDWLHTH.dcc'),
            2: str(so_base / 'LG/SOLGMEDWLHTH.dcc'),
            3: str(so_base / 'RA/SORAMEDWLHTH.dcc'),
            4: str(so_base / 'LA/SOLAMEDWLHTH.dcc'),
            5: str(so_base / 'RH/SORHLSTWLSTF.dcc'),
            8: str(so_base / 'S1/SOS1MEDWLHTH.dcc'),
            9: str(so_base / 'S2/SOS2MEDWLHTH.dcc'),
        }
    },
    'run': {
        'cof': 'SORNSTF.COF',
        'fps': 18, 'loop': True,
        'parts': {
            0: str(so_base / 'HD/SOHDLITRNHTH.dcc'),
            1: str(so_base / 'TR/SOTRMEDRNHTH.dcc'),
            2: str(so_base / 'LG/SOLGMEDRNHTH.dcc'),
            3: str(so_base / 'RA/SORAMEDRNHTH.dcc'),
            4: str(so_base / 'LA/SOLAMEDRNHTH.dcc'),
            5: str(so_base / 'RH/SORHLSTRNSTF.dcc'),
            8: str(so_base / 'S1/SOS1MEDRNHTH.dcc'),
            9: str(so_base / 'S2/SOS2MEDRNHTH.dcc'),
        }
    },
    'attack': {
        'cof': 'SOA1STF.COF',
        'fps': 20, 'loop': False,
        'parts': {
            0: str(so_base / 'HD/SOHDLITA1STF.dcc'),
            1: str(so_base / 'TR/SOTRMEDA1STF.dcc'),
            2: str(so_base / 'LG/SOLGMEDA1STF.dcc'),
            3: str(so_base / 'RA/SORAMEDA1STF.dcc'),
            4: str(so_base / 'LA/SOLAMEDA1STF.dcc'),
            5: str(so_base / 'RH/SORHLSTA1STF.dcc'),
            8: str(so_base / 'S1/SOS1MEDA1STF.dcc'),
            9: str(so_base / 'S2/SOS2MEDA1STF.dcc'),
        }
    },
    'cast': {
        'cof': 'SOSCSTF.COF',
        'fps': 16, 'loop': False,
        'parts': {
            0: str(so_base / 'HD/SOHDLITSC2HS.dcc'),
            1: str(so_base / 'TR/SOTRMEDSCHTH.dcc'),
            2: str(so_base / 'LG/SOLGMEDSCHTH.dcc'),
            3: str(so_base / 'RA/SORAMEDSCSTF.dcc'),
            4: str(so_base / 'LA/SOLAMEDSCSTF.dcc'),
            5: str(so_base / 'RH/SORHLSTSCSTF.dcc'),
            8: str(so_base / 'S1/SOS1MEDSCHTH.dcc'),
            9: str(so_base / 'S2/SOS2MEDSCHTH.dcc'),
        }
    }
}

actions_manifest = {}

for act_name, cfg in actions_config.items():
    cof_path = so_base / f"COF/{cfg['cof']}"
    if not cof_path.exists():
        cof_path = so_base / f"COF/{cfg['cof'].lower()}"
    out_png = target_dir / f"sorceress_{act_name}.png"
    print(f"Synthesizing Sorceress [medium staff] {act_name}...")
    meta = composite_character_action('SO', str(cof_path), cfg['parts'], str(out_png))
    actions_manifest[act_name] = {
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
    print(f"  -> {act_name}: {meta['cell_width']}x{meta['cell_height']}, frames={meta['frames']}, ax={meta['anchor_x']}, ay={meta['anchor_y']}")

update_manifest(target_dir, "SORCERESS_MEDIUM_MANIFEST", actions_manifest)
print("Sorceress staff synthesis completed successfully!")
