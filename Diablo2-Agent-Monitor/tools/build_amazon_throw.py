#!/usr/bin/env python3
"""
build_amazon_throw.py
為亞馬遜合成 Light, Medium, Heavy 三種裝甲形態的原廠 16 方向投擲標槍精靈圖 (TH1HT)
並更新 manifest.json 與 manifest.js
"""

import sys, os, json
from pathlib import Path
from PIL import Image

SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
sys.path.insert(0, str(SCRIPT_DIR))

from rebuild_anchoring_system import composite_character_action, update_manifest

am_base = SCRIPT_DIR / 'mpq_raw/d2char/data/global/CHARS/AM'
am_cof = am_base / 'COF/amth1ht.cof'

for tier, sfx, hd_file in [
    ('light', 'LIT', 'AMHDLITTH1HT.dcc'),
    ('medium', 'MED', 'AMHDLITTH1HT.dcc'),
    ('heavy', 'HVY', 'AMHDLITTH1HT.dcc')
]:
    parts = {
        0: str(am_base / f'HD/{hd_file}'),
        1: str(am_base / f'TR/AMTR{sfx}TH1HT.dcc'),
        2: str(am_base / f'LG/AMLG{sfx}TH1HT.dcc'),
        3: str(am_base / f'RA/AMRA{sfx}TH1HT.dcc'),
        4: str(am_base / f'LA/AMLA{sfx}TH1HT.dcc'),
        5: str(am_base / 'RH/AMRHJAVTH1HT.dcc'),
        7: str(am_base / 'SH/AMSHKITTH1HT.dcc'),
        8: str(am_base / f'S1/AMS1{sfx}TH1HT.dcc'),
        9: str(am_base / f'S2/AMS2{sfx}TH1HT.dcc'),
    }
    target_dir = PROJECT_DIR / f'web/assets/characters/amazon/{tier}'
    out_throw = target_dir / 'amazon_throw.png'
    meta = composite_character_action('AM', str(am_cof), parts, str(out_throw))
    
    # 設置接地 anchor_y: 95
    ay = 95
    ax = meta['anchor_x']
    cw = meta['cell_width']
    ch = meta['cell_height']
    
    if tier == 'light':
        root_dir = PROJECT_DIR / 'web/assets/characters/amazon'
        im = Image.open(out_throw)
        im.save(root_dir / 'amazon_throw.png')
        
    print(f"Amazon [{tier}] throw built: {cw}x{ch}, ax={ax}, ay={ay}")
    
    actions_dict = {
        'attack_throw': {
            'name': 'attack_throw',
            'file': 'amazon_throw.png',
            'directions': 16,
            'frames': meta['frames'],
            'cell_width': cw,
            'cell_height': ch,
            'anchor_x': ax,
            'anchor_y': ay,
            'fps': 20,
            'loop': False
        }
    }
    var_name = f'AMAZON_{tier.upper()}_MANIFEST'
    update_manifest(target_dir, var_name, actions_dict)

root_dir = PROJECT_DIR / 'web/assets/characters/amazon'
update_manifest(root_dir, 'AMAZON_MANIFEST', actions_dict)
print("All Amazon throw manifests updated successfully!")
