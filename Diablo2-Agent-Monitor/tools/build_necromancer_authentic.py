#!/usr/bin/env python3
"""
build_necromancer_authentic.py
為死靈法師 (Necromancer) 中裝 (Medium) 與 重裝 (Heavy) 合成正統手持魔杖 (Wand - WND) 全套動作圖集
不裝配聖騎士單手劍與風箏盾，徹底還原真正死靈法師！
包含:
1. 待命 (idle): NENU1HS (8 frames, 16 dirs)
2. 行走 (walk): NEWL1HS (8 frames, 16 dirs)
3. 奔跑 (run): NERN1HS (8 frames, 16 dirs)
4. 攻擊 (attack): NEA11HS (19 frames, 16 dirs)
5. 施法 (cast): NESC1HS (15 frames, 16 dirs)

更新 web/assets/characters/necromancer/medium/ 與 heavy/ 的 manifest.json 與 manifest.js
"""

import sys, os, json
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
TOOLS_DIR = PROJECT_DIR / 'tools'
sys.path.insert(0, str(TOOLS_DIR))

from rebuild_anchoring_system import composite_character_action, update_manifest

ne_base = TOOLS_DIR / 'mpq_raw/d2char/data/global/CHARS/NE'

actions_config = {
    'idle': {
        'cof': 'NENU1HS.COF',
        'fps': 12, 'loop': True,
        'rh': 'NERHWNDNU1HS.dcc'
    },
    'walk': {
        'cof': 'NEWL1HS.COF',
        'fps': 14, 'loop': True,
        'rh': 'NERHWNDWL1HS.dcc'
    },
    'run': {
        'cof': 'NERN1HS.COF',
        'fps': 18, 'loop': True,
        'rh': 'NERHWNDRN1HS.dcc'
    },
    'attack': {
        'cof': 'NEA11HS.COF',
        'fps': 20, 'loop': False,
        'rh': 'NERHWNDA11HS.dcc'
    },
    'cast': {
        'cof': 'NESC1HS.COF',
        'fps': 16, 'loop': False,
        'rh': 'NERHWNDSC1HS.dcc'
    }
}

for tier in ['medium', 'heavy']:
    sfx = 'MED' if tier == 'medium' else 'HVY'
    target_dir = PROJECT_DIR / f'web/assets/characters/necromancer/{tier}'
    target_dir.mkdir(parents=True, exist_ok=True)
    
    actions_manifest = {}
    print(f"\n=== Synthesizing Necromancer [{tier}] with authentic Wand ===")
    
    for act_name, cfg in actions_config.items():
        cof_file = cfg['cof']
        cof_path = ne_base / f"COF/{cof_file}"
        cof_data = cof_path.read_bytes()
        layers_cnt = cof_data[0]
        act_code = cfg.get('act', act_name[:2].upper())
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
            if cid == 0:
                p = ne_base / f'HD/NEHDLIT{act_code}{wcl}.dcc'
            elif cid in [1, 2, 3, 4, 8, 9]:
                p = ne_base / f'{cname}/NE{cname}{sfx}{act_code}{wcl}.dcc'
            elif cid == 5:
                p = ne_base / f'RH/NERHWND{act_code}{wcl}.dcc'
            elif cid == 7:
                p = None # no shield
            
            if p and p.exists():
                parts[cid] = str(p)
                
        out_png = target_dir / f"necromancer_{act_name}.png"
        meta = composite_character_action('NE', str(cof_path), parts, str(out_png))
        actions_manifest[act_name] = {
            'name': act_name,
            'file': f'necromancer_{act_name}.png',
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
        
    var_name = f"NECROMANCER_{tier.upper()}_MANIFEST"
    update_manifest(target_dir, var_name, actions_manifest)

print("\nNecromancer medium and heavy synthesis completed successfully!")
