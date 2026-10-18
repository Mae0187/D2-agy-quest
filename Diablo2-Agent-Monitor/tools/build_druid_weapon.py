#!/usr/bin/env python3
"""
build_druid_weapon.py
為德魯伊 (Druid) 輕裝 (Light Armor) 合成正統單手戰斧 (Axe - AXE) 動作圖集
包含:
1. 待命 (idle): DZNU1HS (6 frames, 16 dirs)
2. 行走 (walk): DZWL1HS (8 frames, 16 dirs)
3. 奔跑 (run): DZRN1HS (8 frames, 16 dirs)
4. 攻擊 (attack): DZA11HS (16 frames, 16 dirs)
5. 施法 (cast): DZSC1HS (16 frames, 16 dirs)

更新 web/assets/characters/druid/light/manifest.json 與 manifest.js
"""

import sys, os, json
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
TOOLS_DIR = PROJECT_DIR / 'tools'
sys.path.insert(0, str(TOOLS_DIR))

from rebuild_anchoring_system import composite_character_action, update_manifest

dz_base = TOOLS_DIR / 'mpq_raw/d2exp/data/global/CHARS/DZ'
target_dir = PROJECT_DIR / 'web/assets/characters/druid/light'
target_dir.mkdir(parents=True, exist_ok=True)

actions_config = {
    'idle': {
        'cof': 'DZNU1HS.COF',
        'fps': 12, 'loop': True,
        'rh': 'DZRHAXENU1HS.dcc'
    },
    'walk': {
        'cof': 'DZWL1HS.COF',
        'fps': 14, 'loop': True,
        'rh': 'DZRHAXEWL1HS.dcc'
    },
    'run': {
        'cof': 'DZRN1HS.COF',
        'fps': 18, 'loop': True,
        'rh': 'DZRHAXERN1HS.dcc'
    },
    'attack': {
        'cof': 'DZA11HS.COF',
        'fps': 20, 'loop': False,
        'rh': 'DZRHAXEA11HS.dcc'
    },
    'cast': {
        'cof': 'DZSC1HS.COF',
        'fps': 16, 'loop': False,
        'rh': 'DZRHAXESC1HS.dcc'
    }
}

actions_manifest = {}

for act_name, cfg in actions_config.items():
    cof_file = cfg['cof']
    cof_path = dz_base / f"COF/{cof_file}"
    cof_data = cof_path.read_bytes()
    layers_cnt = cof_data[0]
    
    act_code = 'NU'
    if act_name == 'attack': act_code = 'A1'
    elif act_name == 'cast': act_code = 'SC'
    elif act_name == 'idle': act_code = 'NU'
    elif act_name == 'walk': act_code = 'WL'
    elif act_name == 'run': act_code = 'RN'
    
    pos = 28
    parts = {}
    for _ in range(layers_cnt):
        cid = cof_data[pos]
        wcl = cof_data[pos+4:pos+8].decode('latin1', errors='ignore').strip('\x00').strip().upper()
        pos += 9
        cname = {0:'HD', 1:'TR', 2:'LG', 3:'RA', 4:'LA', 5:'RH', 6:'LH', 7:'SH', 8:'S1', 9:'S2'}.get(cid)
        if not cname: continue
        
        p = None
        if cid == 5:
            p = dz_base / f'RH/{cfg["rh"]}'
        elif cid == 7:
            p = None # no shield
        else:
            p = dz_base / f'{cname}/DZ{cname}LIT{act_code}{wcl}.dcc'
            if not p.exists() and wcl != 'HTH':
                p_alt = dz_base / f'{cname}/DZ{cname}LIT{act_code}HTH.dcc'
                if p_alt.exists():
                    p = p_alt
        
        if p and p.exists():
            parts[cid] = str(p)
            
    out_png = target_dir / f"druid_{act_name}.png"
    print(f"Synthesizing Druid [light axe] {act_name}...")
    meta = composite_character_action('DZ', str(cof_path), parts, str(out_png))
    actions_manifest[act_name] = {
        'name': act_name,
        'file': f'druid_{act_name}.png',
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

# 如果根目錄 druid 沒有指定，也同步更新
update_manifest(target_dir, "DRUID_LIGHT_MANIFEST", actions_manifest)
root_dir = PROJECT_DIR / 'web/assets/characters/druid'
update_manifest(root_dir, "DRUID_MANIFEST", actions_manifest)
print("Druid light axe synthesis completed successfully!")
