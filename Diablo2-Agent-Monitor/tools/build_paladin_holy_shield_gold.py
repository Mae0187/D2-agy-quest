#!/usr/bin/env python3
"""
build_paladin_holy_shield_gold.py
暴雪原版 MPQ 獨立紋章神盾 (Heraldic Shield) DCC 轉譯與神聖金光圖集生成器：
1. 解碼聖騎士專屬 16 方向獨立盾牌 DCC：
   - idle (PASHHSHNU1HS, 8f 16d)
   - walk (PASHHSHWL1HS, 10f 16d)
   - run (PASHHSHRN1HS, 8f 16d)
   - attack (PASHHSHA11HS, 15f 16d)
   - cast (PASHHSHSC1HS, 16f 16d)
   - special1 (PASHHSHS11HS, 12f 16d)
2. 應用神聖金黃色調映射 (Holy Gold Palette Tint)，高光轉化為白金聖光，重塑原廠神聖之盾視覺。
3. 嚴格對齊至世界坐標腳底中心錨點 (anchor_x, anchor_y)，使盾牌與角色任意裝甲 (Light/Medium/Heavy) 100% 同步貼合。
4. 輸出至 web/assets/skills/paladin/holy_shield/
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

from rebuild_anchoring_system import DCCDecoder, load_palette, DCC_16_DIR_MAP

PALETTE_PATH = TOOLS_DIR / "mpq_raw/d2data/data/global/palette/ACT1/pal.dat"
pal = load_palette(str(PALETTE_PATH), brightness_boost=1.35)

DCC_BASE = TOOLS_DIR / 'mpq_raw/d2char/data/global/CHARS/PA/SH'
OUT_DIR = PROJECT_DIR / 'web/assets/skills/paladin/holy_shield'
OUT_DIR.mkdir(parents=True, exist_ok=True)

ACTIONS = {
    'idle': {'file': 'PASHHSHNU1HS.dcc', 'fps': 12, 'loop': True},
    'walk': {'file': 'PASHHSHWL1HS.dcc', 'fps': 14, 'loop': True},
    'run': {'file': 'PASHHSHRN1HS.dcc', 'fps': 18, 'loop': True},
    'attack': {'file': 'PASHHSHA11HS.dcc', 'fps': 20, 'loop': False},
    'cast': {'file': 'PASHHSHSC1HS.dcc', 'fps': 16, 'loop': False},
    'special1': {'file': 'PASHHSHS11HS.dcc', 'fps': 20, 'loop': False}
}

def apply_holy_gold_tint(rgba_img):
    arr = np.array(rgba_img).astype(float)
    alpha = arr[:, :, 3]
    mask = alpha > 0
    if not np.any(mask):
        return rgba_img

    # 計算亮度
    luma = (0.299 * arr[:, :, 0] + 0.587 * arr[:, :, 1] + 0.114 * arr[:, :, 2]) / 255.0
    out = np.zeros_like(arr)
    out[:, :, 3] = alpha

    # 漸層映射
    # 暗部: (100, 60, 15) -> 金棕
    # 中間部: (190, 140, 40) -> 燦爛金黃
    # 高光部: (255, 255, 230) -> 璀璨白金
    for y in range(arr.shape[0]):
        for x in range(arr.shape[1]):
            if not mask[y, x]:
                continue
            lum = luma[y, x]
            if lum < 0.35:
                t = lum / 0.35
                r = 105 + t * 85
                g = 65 + t * 75
                b = 15 + t * 25
            elif lum < 0.75:
                t = (lum - 0.35) / 0.4
                r = 190 + t * 65
                g = 140 + t * 75
                b = 40 + t * 45
            else:
                t = (lum - 0.75) / 0.25
                r = 255
                g = 215 + t * 40
                b = 85 + t * 145
            out[y, x, 0] = min(255, r)
            out[y, x, 1] = min(255, g)
            out[y, x, 2] = min(255, b)

    return Image.fromarray(out.astype(np.uint8))

def build_gold_shield_action(act_name, dcc_name, pad=8):
    dcc_path = DCC_BASE / dcc_name
    dec = DCCDecoder(str(dcc_path))
    num_dirs_raw = dec.directions
    actual_dirs = [d for d in DCC_16_DIR_MAP if d < num_dirs_raw]
    
    # 計算全局包圍盒
    min_left, max_right = 9999, -9999
    min_top, max_bottom = 9999, -9999
    
    decoded_dirs = {}
    for d in actual_dirs:
        dfs = dec.decode_direction(d)
        decoded_dirs[d] = dfs
        for fr in dfs:
            fw, fh = fr['width'], fr['height']
            if fw == 0 or fh == 0: continue
            xo = fr['x_offset']
            yo = fr['y_offset']
            top = yo - fh + 1
            bottom = yo
            min_left = min(min_left, xo)
            max_right = max(max_right, xo + fw)
            min_top = min(min_top, top)
            max_bottom = max(max_bottom, bottom)
            
    cell_w = max_right - min_left + pad
    cell_h = max_bottom - min_top + pad
    anchor_x = -min_left + pad // 2
    anchor_y = -min_top + pad // 2
    
    fpd = dec.frames_per_dir
    num_out_dirs = len(actual_dirs)
    sheet = Image.new('RGBA', (cell_w * fpd, cell_h * num_out_dirs), (0, 0, 0, 0))
    
    for row_idx, d in enumerate(actual_dirs):
        dfs = decoded_dirs[d]
        for f_idx, fr in enumerate(dfs):
            fw, fh = fr['width'], fr['height']
            if fw == 0 or fh == 0: continue
            frame_img = Image.new('RGBA', (fw, fh), (0, 0, 0, 0))
            pixels = fr['pixels']
            for y in range(fh):
                src_y = (fh - 1 - y) if fr['bottom_up'] else y
                for x in range(fw):
                    idx = pixels[src_y * fw + x]
                    if idx:
                        frame_img.putpixel((x, y), (*pal[idx][:3], 255))
            
            # 轉換為神聖金光
            frame_gold = apply_holy_gold_tint(frame_img)
            
            dx = f_idx * cell_w + anchor_x + fr['x_offset']
            dy = row_idx * cell_h + anchor_y + fr['y_offset'] - fh + 1
            sheet.paste(frame_gold, (dx, dy), frame_gold)
            
    out_file = f"holy_shield_{act_name}.png"
    out_path = OUT_DIR / out_file
    sheet.save(out_path, 'PNG', optimize=True)
    print(f"Built {act_name:<10}: dirs={num_out_dirs}, frames={fpd}, cell=({cell_w}x{cell_h}), anchor=({anchor_x},{anchor_y}) -> {out_file}")
    
    return {
        'name': act_name,
        'file': out_file,
        'directions': num_out_dirs,
        'frames': fpd,
        'cell_width': cell_w,
        'cell_height': cell_h,
        'anchor_x': anchor_x,
        'anchor_y': anchor_y,
        'fps': ACTIONS[act_name]['fps'],
        'loop': ACTIONS[act_name]['loop']
    }

def main():
    manifest = {
        'name': 'paladin_holy_shield_gold',
        'description': 'Diablo II Paladin Holy Shield 16-direction Golden Heraldic Shield Overlay',
        'actions': {}
    }
    
    for act_name, cfg in ACTIONS.items():
        meta = build_gold_shield_action(act_name, cfg['file'])
        manifest['actions'][act_name] = meta
        
    json_path = OUT_DIR / 'manifest.json'
    js_path = OUT_DIR / 'manifest.js'
    
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
        
    with open(js_path, 'w', encoding='utf-8') as f:
        f.write(f"window.PALADIN_HOLY_SHIELD_MANIFEST = {json.dumps(manifest, ensure_ascii=False, indent=2)};\n")
        
    print(f"\nAll 6 Holy Shield Golden actions generated successfully!")
    print(f"Manifest written to: {json_path}")

if __name__ == '__main__':
    main()
