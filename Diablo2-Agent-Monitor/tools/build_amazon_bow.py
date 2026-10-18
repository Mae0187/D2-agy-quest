#!/usr/bin/env python3
"""
build_amazon_bow.py
為亞馬遜合成 Light, Medium, Heavy 三種裝甲形態的原廠 16 方向弓箭射擊精靈圖 (A1BOW)
並更新 manifest.json 與 manifest.js
"""

import sys, os, json
from pathlib import Path
from PIL import Image

SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
TOOLS_DIR = PROJECT_DIR / 'tools'
sys.path.insert(0, str(TOOLS_DIR))

from rebuild_anchoring_system import composite_character_action, update_manifest

am_base = TOOLS_DIR / 'mpq_raw/d2char/data/global/CHARS/AM'
am_cof = am_base / 'COF/ama1bow.cof'

for tier, sfx, hd_file in [
    ('light', 'LIT', 'AMHDLITA1BOW.dcc'),
    ('medium', 'MED', 'AMHDLITA1BOW.dcc'),
    ('heavy', 'HVY', 'AMHDLITA1BOW.dcc')
]:
    parts = {
        0: str(am_base / f'HD/{hd_file}'),
        1: str(am_base / f'TR/AMTR{sfx}A1BOW.dcc'),
        2: str(am_base / f'LG/AMLG{sfx}A1BOW.dcc'),
        3: str(am_base / f'RA/AMRA{sfx}A1BOW.dcc'),
        4: str(am_base / f'LA/AMLA{sfx}A1BOW.dcc'),
        6: str(am_base / 'LH/AMLHLBWA1BOW.dcc'),
        8: str(am_base / f'S1/AMS1{sfx}A1BOW.dcc'),
        9: str(am_base / f'S2/AMS2{sfx}A1BOW.dcc'),
    }
    target_dir = PROJECT_DIR / f'web/assets/characters/amazon/{tier}'
    out_bow = target_dir / 'amazon_bow.png'
    os.makedirs(target_dir, exist_ok=True)
    meta = composite_character_action('AM', str(am_cof), parts, str(out_bow))
    
    # 設置接地 anchor_y: 103 (依中位數足部接觸點精準對齊)
    ay = 103
    ax = meta['anchor_x']
    cw = meta['cell_width']
    ch = meta['cell_height']
    
    if tier == 'light':
        root_dir = PROJECT_DIR / 'web/assets/characters/amazon'
        im = Image.open(out_bow)
        im.save(root_dir / 'amazon_bow.png')
        
    print(f"Amazon [{tier}] bow built: {cw}x{ch}, ax={ax}, ay={ay}")
    
    actions_dict = {
        'attack_bow': {
            'name': 'attack_bow',
            'file': 'amazon_bow.png',
            'directions': 16,
            'frames': meta['frames'],
            'cell_width': cw,
            'cell_height': ch,
            'anchor_x': ax,
            'anchor_y': ay,
            'fps': 18,
            'loop': False
        }
    }
    
    var_name = f"AMAZON_{tier.upper()}_MANIFEST"
    update_manifest(target_dir, var_name, actions_dict)

# 同步更新根目錄 manifest
root_dir = PROJECT_DIR / 'web/assets/characters/amazon'
update_manifest(root_dir, "AMAZON_MANIFEST", actions_dict)
print("Amazon bow update complete across all tiers!")
