#!/usr/bin/env python3
"""
build_amazon_authentic_movement.py
為亞馬遜 (Amazon) 輕裝 (light)、中裝 (medium)、重裝 (heavy) 打造正統 MPQ DCC + COF 雙武器移動圖集：
1. 標槍形態 (Spear/Javelin Mode):
   - idle_spear (NU1HT), walk_spear (WL1HT), run_spear (RN1HT), attack_spear (A11HT), attack_throw (TH1HT), cast (SC1HT)
   - 同時輸出為預設 idle, walk, run, attack
2. 弓箭形態 (Bow Mode):
   - idle_bow (NUBOW), walk_bow (WLBOW), run_bow (RNBOW), attack_bow (A1BOW)

徹底解決：
1. 中裝移動重複輕裝問題（以原廠 MED DCC 重構）
2. 重裝拿弩問題（以原廠 HVY 弓與標槍 DCC 重構，無弩）
3. 射弓完拿弓移動、標槍攻擊完拿標槍移動
"""

import sys, os, json, shutil
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
TOOLS_DIR = PROJECT_DIR / 'tools'
sys.path.insert(0, str(TOOLS_DIR))

from rebuild_anchoring_system import composite_character_action, update_manifest

am_base = TOOLS_DIR / 'mpq_raw/d2char/data/global/CHARS/AM'

actions_config = {
    'idle_spear':   {'cof': 'AMNU1HT.COF', 'act': 'NU', 'fps': 12, 'loop': True, 'weapon': 'RHJAV'},
    'walk_spear':   {'cof': 'AMWL1HT.COF', 'act': 'WL', 'fps': 14, 'loop': True, 'weapon': 'RHJAV'},
    'run_spear':    {'cof': 'AMRN1HT.COF', 'act': 'RN', 'fps': 18, 'loop': True, 'weapon': 'RHJAV'},
    'attack_spear': {'cof': 'AMA11HT.COF', 'act': 'A1', 'fps': 20, 'loop': False, 'weapon': 'RHJAV'},
    'attack_throw': {'cof': 'AMTH1HT.COF', 'act': 'TH', 'fps': 20, 'loop': False, 'weapon': 'RHJAV'},
    'cast':         {'cof': 'AMSC1HT.COF', 'act': 'SC', 'fps': 16, 'loop': False, 'weapon': 'RHJAV'},
    'idle_bow':     {'cof': 'AMNUBOW.COF', 'act': 'NU', 'fps': 12, 'loop': True, 'weapon': 'LHLBB'},
    'walk_bow':     {'cof': 'AMWLBOW.COF', 'act': 'WL', 'fps': 14, 'loop': True, 'weapon': 'LHLBB'},
    'run_bow':      {'cof': 'AMRNBOW.COF', 'act': 'RN', 'fps': 18, 'loop': True, 'weapon': 'LHLBB'},
    'attack_bow':   {'cof': 'AMA1BOW.COF', 'act': 'A1', 'fps': 18, 'loop': False, 'weapon': 'LHLBB'},
}

tiers = [
    ('light', 'LIT', 'AMAZON_LIGHT_MANIFEST'),
    ('medium', 'MED', 'AMAZON_MEDIUM_MANIFEST'),
    ('heavy', 'HVY', 'AMAZON_HEAVY_MANIFEST'),
]

for tier_name, tier_sfx, var_name in tiers:
    print(f"\n=======================================================")
    print(f"=== Synthesizing Amazon [{tier_name}] (Tier: {tier_sfx}) ===")
    print(f"=======================================================")
    
    target_dir = PROJECT_DIR / f'web/assets/characters/amazon/{tier_name}'
    target_dir.mkdir(parents=True, exist_ok=True)
    
    actions_manifest = {}
    
    for act_key, cfg in actions_config.items():
        cof_file = cfg['cof']
        act_code = cfg['act']
        cof_path = am_base / 'COF' / cof_file
        cof_data = cof_path.read_bytes()
        layers_cnt = cof_data[0]
        
        pos = 28
        parts = {}
        for _ in range(layers_cnt):
            cid = cof_data[pos]
            wcl = cof_data[pos+4:pos+8].decode('latin1', errors='ignore').strip('\x00').upper()
            pos += 9
            
            p = None
            if cid == 0:
                p = am_base / f'HD/AMHDLIT{act_code}{wcl}.dcc'
            elif cid == 1:
                p = am_base / f'TR/AMTR{tier_sfx}{act_code}{wcl}.dcc'
            elif cid == 2:
                p = am_base / f'LG/AMLG{tier_sfx}{act_code}{wcl}.dcc'
            elif cid == 3:
                p = am_base / f'RA/AMRA{tier_sfx}{act_code}{wcl}.dcc'
            elif cid == 4:
                p = am_base / f'LA/AMLA{tier_sfx}{act_code}{wcl}.dcc'
            elif cid == 5:
                p = am_base / f'RH/AMRHJAV{act_code}{wcl}.dcc'
            elif cid == 6:
                p = am_base / f'LH/AMLHLBB{act_code}{wcl}.dcc'
            elif cid == 7:
                p = am_base / f'SH/AMSHBUC{act_code}{wcl}.dcc'
            elif cid == 8:
                p = am_base / f'S1/AMS1{tier_sfx}{act_code}{wcl}.dcc'
            elif cid == 9:
                p = am_base / f'S2/AMS2{tier_sfx}{act_code}{wcl}.dcc'
                
            if p and p.exists():
                parts[cid] = str(p)
                
        out_png = target_dir / f"amazon_{act_key}.png"
        meta = composite_character_action('AM', str(cof_path), parts, str(out_png))
        
        actions_manifest[act_key] = {
            'name': act_key,
            'file': f'amazon_{act_key}.png',
            'directions': meta['directions'],
            'frames': meta['frames'],
            'cell_width': meta['cell_width'],
            'cell_height': meta['cell_height'],
            'anchor_x': meta['anchor_x'],
            'anchor_y': meta['anchor_y'],
            'fps': cfg['fps'],
            'loop': cfg['loop']
        }
        print(f"  [{tier_name}] {act_key:<14}: {meta['cell_width']}x{meta['cell_height']}, frames={meta['frames']}, ax={meta['anchor_x']}, ay={meta['anchor_y']}")

    # 複製預設圖集與別名對齊 (idle -> idle_spear, walk -> walk_spear, run -> run_spear, attack -> attack_spear)
    shutil.copyfile(target_dir / "amazon_idle_spear.png", target_dir / "amazon_idle.png")
    shutil.copyfile(target_dir / "amazon_walk_spear.png", target_dir / "amazon_walk.png")
    shutil.copyfile(target_dir / "amazon_run_spear.png", target_dir / "amazon_run.png")
    shutil.copyfile(target_dir / "amazon_attack_spear.png", target_dir / "amazon_attack.png")
    shutil.copyfile(target_dir / "amazon_attack_spear.png", target_dir / "amazon_spear.png")
    shutil.copyfile(target_dir / "amazon_attack_bow.png", target_dir / "amazon_bow.png")
    shutil.copyfile(target_dir / "amazon_attack_throw.png", target_dir / "amazon_throw.png")

    for alias, src_key, f_name in [
        ('idle', 'idle_spear', 'amazon_idle.png'),
        ('walk', 'walk_spear', 'amazon_walk.png'),
        ('run', 'run_spear', 'amazon_run.png'),
        ('attack', 'attack_spear', 'amazon_attack.png'),
        ('spear', 'attack_spear', 'amazon_spear.png'),
        ('bow', 'attack_bow', 'amazon_bow.png'),
        ('throw', 'attack_throw', 'amazon_throw.png'),
    ]:
        actions_manifest[alias] = dict(actions_manifest[src_key])
        actions_manifest[alias]['name'] = alias
        actions_manifest[alias]['file'] = f_name

    update_manifest(target_dir, var_name, actions_manifest)

print("\nAmazon light, medium, heavy authentic dual-mode synthesis completed successfully!")
