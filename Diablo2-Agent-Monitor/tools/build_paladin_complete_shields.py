#!/usr/bin/env python3
"""
build_paladin_complete_shields.py
依據 d2-engine 規範與暴雪原廠 COF/DCC 骨架，全面重構聖騎士盾牌體系：
1. 為重裝紋章盾 (Heavy) 合成暴雪原廠真正未開神聖之盾的飾紋盾 (Heraldic Shield, 冷峻金屬銀十字)
2. 為輕裝、中裝、重裝合成【手盾一體】的神聖之盾 (Holy Shield) 形態：
   - light_holyshield (輕裝身軀 + 金色神聖紋章盾)
   - medium_holyshield (中裝身軀 + 金色神聖紋章盾)
   - heavy_holyshield (重裝身軀 + 金色神聖紋章盾)
3. 徹底根治「神聖之盾從手上飛走」病灶，實現手盾合一、時間到無縫換回！
"""

import os
import sys
import json
from pathlib import Path
from PIL import Image
import numpy as np

SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
TOOLS_DIR = PROJECT_DIR / 'tools'
sys.path.insert(0, str(TOOLS_DIR))

from dcc_to_png import DCCDecoder, load_palette
from rebuild_anchoring_system import DCC_16_DIR_MAP
from build_paladin_holy_shield_gold import apply_holy_gold_tint

PALETTE_PATH = TOOLS_DIR / "mpq_raw/d2data/data/global/palette/ACT1/pal.dat"
pal = load_palette(str(PALETTE_PATH), brightness_boost=1.35)

PA_BASE = TOOLS_DIR / 'mpq_raw/d2char/data/global/CHARS/PA'
WEB_PALADIN = PROJECT_DIR / 'web/assets/characters/paladin'

ACTIONS_CONFIG = {
    'idle':     {'cof': 'PANU1HS.COF', 'sfx': 'NU1HS', 'fps': 12, 'loop': True},
    'walk':     {'cof': 'PAWL1HS.COF', 'sfx': 'WL1HS', 'fps': 14, 'loop': True},
    'run':      {'cof': 'PARN1HS.COF', 'sfx': 'RN1HS', 'fps': 18, 'loop': True},
    'attack':   {'cof': 'PAA11HS.COF', 'sfx': 'A11HS', 'fps': 20, 'loop': False},
    'cast':     {'cof': 'PASC1HS.COF', 'sfx': 'SC1HS', 'fps': 16, 'loop': False},
    'special1': {'cof': 'PAS11HS.COF', 'sfx': 'S11HS', 'fps': 20, 'loop': False}
}

def composite_paladin_action(cof_path, parts_dict, out_png, gold_shield=False, pad=8):
    with open(cof_path, 'rb') as f:
        cof_data = f.read()
    
    layers_cnt = cof_data[0]
    frames_cnt = cof_data[1]
    dirs_cnt = cof_data[2]
    fps = cof_data[3]
    total_priority_bytes = layers_cnt * frames_cnt * dirs_cnt
    priority_data = cof_data[-total_priority_bytes:]
    
    decoders = {}
    for code, dcc_path in parts_dict.items():
        if os.path.exists(dcc_path):
            decoders[code] = DCCDecoder(dcc_path)
            
    min_left, max_right = 9999, -9999
    min_top, max_bottom = 9999, -9999
    
    # 遍歷計算全局包圍盒
    for cof_dir in range(dirs_cnt):
        dcc_dir = DCC_16_DIR_MAP[cof_dir]
        for f in range(frames_cnt):
            for dec in decoders.values():
                dfs = dec.decode_direction(dcc_dir)
                if not dfs: continue
                fr = dfs[min(f, len(dfs) - 1)]
                fw, fh = fr['width'], fr['height']
                if fw == 0 or fh == 0: continue
                min_left = min(min_left, fr['x_offset'])
                max_right = max(max_right, fr['x_offset'] + fw)
                min_top = min(min_top, fr['y_offset'] - fh + 1)
                max_bottom = max(max_bottom, fr['y_offset'])
                
    cell_w = max_right - min_left + pad
    cell_h = max_bottom - min_top + pad
    anchor_x = -min_left + pad // 2
    anchor_y = -min_top + pad // 2
    
    sheet = Image.new('RGBA', (cell_w * frames_cnt, cell_h * dirs_cnt), (0, 0, 0, 0))
    
    for cof_dir in range(dirs_cnt):
        dcc_dir = DCC_16_DIR_MAP[cof_dir]
        for frame in range(frames_cnt):
            dst_cell_x = frame * cell_w
            dst_cell_y = cof_dir * cell_h
            p_offset = (cof_dir * frames_cnt + frame) * layers_cnt
            p_layers = priority_data[p_offset : p_offset + layers_cnt]
            
            for code in p_layers:
                dec = decoders.get(code)
                if not dec: continue
                dfs = dec.decode_direction(dcc_dir)
                if not dfs: continue
                fr = dfs[min(frame, len(dfs) - 1)]
                fw, fh = fr['width'], fr['height']
                if fw == 0 or fh == 0: continue
                
                fimg = Image.new('RGBA', (fw, fh), (0, 0, 0, 0))
                pixels = fr['pixels']
                for y in range(fh):
                    src_y = (fh - 1 - y) if fr['bottom_up'] else y
                    for x in range(fw):
                        idx = pixels[src_y * fw + x]
                        if idx:
                            fimg.putpixel((x, y), (*pal[idx][:3], 255))
                            
                # 盾牌部件神聖金光轉化 (若 gold_shield 為 True)
                if code == 7 and gold_shield:
                    fimg = apply_holy_gold_tint(fimg)
                    
                dx = dst_cell_x + anchor_x + fr['x_offset']
                dy = dst_cell_y + anchor_y + fr['y_offset'] - fh + 1
                sheet.paste(fimg, (dx, dy), fimg)
                
    os.makedirs(os.path.dirname(out_png), exist_ok=True)
    sheet.save(out_png, 'PNG', optimize=True)
    return {
        "directions": dirs_cnt,
        "frames": frames_cnt,
        "cell_width": cell_w,
        "cell_height": cell_h,
        "anchor_x": anchor_x,
        "anchor_y": anchor_y,
        "fps": fps
    }

def build_variant_set(tier_name, out_dir_name, hd_suffix, body_suffix, gold_shield, var_name, desc):
    target_dir = WEB_PALADIN / out_dir_name
    target_dir.mkdir(parents=True, exist_ok=True)
    
    manifest = {
        "character": "paladin",
        "armor_tier": out_dir_name,
        "description": desc,
        "directions_order": [4, 8, 0, 9, 5, 10, 1, 11, 6, 12, 2, 13, 7, 14, 3, 15],
        "actions": {}
    }
    
    print(f"\n=======================================================")
    print(f"  Synthesizing Paladin Set: [{out_dir_name}] (GoldShield: {gold_shield})")
    print(f"=======================================================")
    
    for act_name, cfg in ACTIONS_CONFIG.items():
        sfx = cfg['sfx']
        cof_path = PA_BASE / f"COF/{cfg['cof']}"
        parts = {
            0: str(PA_BASE / f"HD/PAHD{hd_suffix}{sfx}.dcc"),
            1: str(PA_BASE / f"TR/PATR{body_suffix}{sfx}.dcc"),
            2: str(PA_BASE / f"LG/PALG{body_suffix}{sfx}.dcc"),
            3: str(PA_BASE / f"RA/PARA{body_suffix}{sfx}.dcc"),
            4: str(PA_BASE / f"LA/PALA{body_suffix}{sfx}.dcc"),
            5: str(PA_BASE / f"RH/PARHSSD{sfx}.dcc"),
            7: str(PA_BASE / f"SH/PASHHSH{sfx}.dcc"), # 紋章神盾
            8: str(PA_BASE / f"S1/PAS1{body_suffix}{sfx}.dcc"),
            9: str(PA_BASE / f"S2/PAS2{body_suffix}{sfx}.dcc"),
        }
        
        out_png = target_dir / f"paladin_{act_name}.png"
        meta = composite_paladin_action(str(cof_path), parts, str(out_png), gold_shield=gold_shield)
        manifest['actions'][act_name] = {
            'name': act_name,
            'file': f"paladin_{act_name}.png",
            'directions': meta['directions'],
            'frames': meta['frames'],
            'cell_width': meta['cell_width'],
            'cell_height': meta['cell_height'],
            'anchor_x': meta['anchor_x'],
            'anchor_y': meta['anchor_y'],
            'fps': cfg['fps'],
            'loop': cfg['loop']
        }
        print(f"  [{out_dir_name}] {act_name:<10}: {meta['cell_width']}x{meta['cell_height']} (ax:{meta['anchor_x']}, ay:{meta['anchor_y']})")
        
    json_path = target_dir / "manifest.json"
    js_path = target_dir / "manifest.js"
    
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
        
    with open(js_path, 'w', encoding='utf-8') as f:
        f.write(f"window.{var_name} = {json.dumps(manifest, ensure_ascii=False, indent=2)};\n")
        
    print(f"Manifest written to: {json_path}")

def main():
    # 1. 真正的重裝·紋章盾 (Heavy Heraldic - 暴雪原廠銀灰金屬飾紋盾，未開神聖之盾)
    build_variant_set(
        tier_name='heavy',
        out_dir_name='heavy',
        hd_suffix='GHM',
        body_suffix='HVY',
        gold_shield=False,
        var_name='PALADIN_HEAVY_MANIFEST',
        desc='Diablo II Paladin Authentic Heavy Armor with True Metallic Heraldic Shield (No Holy Shield)'
    )
    
    # 2. 輕裝神盾形態 (Light Holy Shield - 手盾一體金色神盾)
    build_variant_set(
        tier_name='light_holyshield',
        out_dir_name='light_holyshield',
        hd_suffix='LIT',
        body_suffix='LIT',
        gold_shield=True,
        var_name='PALADIN_LIGHT_HOLYSHIELD_MANIFEST',
        desc='Diablo II Paladin Light Armor with Authentic Golden Holy Shield Integrated'
    )
    
    # 3. 中裝神盾形態 (Medium Holy Shield - 手盾一體金色神盾)
    build_variant_set(
        tier_name='medium_holyshield',
        out_dir_name='medium_holyshield',
        hd_suffix='HLM',
        body_suffix='MED',
        gold_shield=True,
        var_name='PALADIN_MEDIUM_HOLYSHIELD_MANIFEST',
        desc='Diablo II Paladin Medium Armor with Authentic Golden Holy Shield Integrated'
    )
    
    # 4. 重裝神盾形態 (Heavy Holy Shield - 手盾一體金色神盾)
    build_variant_set(
        tier_name='heavy_holyshield',
        out_dir_name='heavy_holyshield',
        hd_suffix='GHM',
        body_suffix='HVY',
        gold_shield=True,
        var_name='PALADIN_HEAVY_HOLYSHIELD_MANIFEST',
        desc='Diablo II Paladin Heavy Armor with Authentic Golden Holy Shield Integrated'
    )

if __name__ == '__main__':
    main()
