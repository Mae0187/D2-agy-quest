#!/usr/bin/env python3
"""
build_paladin_heavy_both.py
為聖騎士高精度萃取重裝兩大形態：
1. 重裝·紋章盾 (Heavy Heraldic Shield) -> web/assets/characters/paladin/heavy/
2. 重裝·塔盾 (Heavy Tower Shield) -> web/assets/characters/paladin/heavy_tower/

關鍵修復：
徹底根除先前將 index 0 (盾牌白十字與金屬高光) 誤當成背景抹除導致的「盾牌一閃一閃破洞」缺陷！
背景嚴格鎖定 index == 9 (灰色底色)，並以 labels 座標擦除文字標籤，保留 100% 完整盾牌！
"""

import os, sys, json
from pathlib import Path
from PIL import Image
import numpy as np

SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
TOOLS_DIR = PROJECT_DIR / 'tools'
sys.path.insert(0, str(TOOLS_DIR))

from export_authentic_armors_v3 import extract_action, DIRECTIONS_16

PALADIN_SPRITERS = PROJECT_DIR / 'assets/characters/paladin/spriters'
WEB_PALADIN = PROJECT_DIR / 'web/assets/characters/paladin'

cfg = {
    'idle':   {'y1': 0,    'y2': 1720, 'x1': 0,    'x2': 989,  'frames': 16, 'cw': 90,  'ch': 90,  'ax': 45, 'ay': 80, 'fps': 12, 'loop': True},
    'walk':   {'y1': 1720, 'y2': 3430, 'x1': 0,    'x2': 988,  'frames': 10, 'cw': 90,  'ch': 90,  'ax': 45, 'ay': 80, 'fps': 14, 'loop': True},
    'run':    {'y1': 3430, 'y2': 5330, 'x1': 0,    'x2': 750,  'frames': 8,  'cw': 90,  'ch': 90,  'ax': 45, 'ay': 80, 'fps': 18, 'loop': True},
    'attack': {'y1': 5330, 'y2': 7500, 'x1': 0,    'x2': 2500, 'frames': 15, 'cw': 160, 'ch': 110, 'ax': 80, 'ay': 95, 'fps': 20, 'loop': False},
    'cast':   {'y1': 1720, 'y2': 3430, 'x1': 1244, 'x2': 2400, 'frames': 16, 'cw': 120, 'ch': 100, 'ax': 60, 'ay': 90, 'fps': 16, 'loop': False},
}

labels = [
    (0, 0, 89, 16),
    (0, 1725, 45, 16),
    (1244, 1725, 92, 19),
    (0, 3434, 38, 16),
    (5, 5335, 60, 16)
]

def process_variant(gif_name, tier_name, desc, var_name):
    gif_path = PALADIN_SPRITERS / gif_name
    im = Image.open(gif_path)
    arr = np.array(im)
    rgb = np.array(im.convert('RGB'))

    # 背景僅鎖定 index 9，絕不刪除 index 0 (盾牌十字與高光)
    is_bg = (arr == 9)
    rgba = np.dstack((rgb, np.where(is_bg, 0, 255).astype(np.uint8)))

    # 標籤擦除防護
    for lx, ly, lw, lh in labels:
        y1 = max(0, ly - 2)
        y2 = min(im.height, ly + lh + 4)
        x1 = max(0, lx - 2)
        x2 = min(im.width, lx + lw + 4)
        rgba[y1:y2, x1:x2, 3] = 0

    out_dir = WEB_PALADIN / tier_name
    os.makedirs(out_dir, exist_ok=True)

    manifest = {
        "character": "paladin",
        "armor_tier": tier_name,
        "description": desc,
        "directions_order": DIRECTIONS_16,
        "actions": {}
    }

    for act_name, acfg in cfg.items():
        out_img, actual_frames = extract_action(
            rgba=rgba,
            y1=acfg['y1'], y2=acfg['y2'],
            x1=acfg['x1'], x2=acfg['x2'],
            num_dirs=16,
            expected_frames=acfg['frames'],
            cell_w=acfg['cw'], cell_h=acfg['ch'],
            anchor_x=acfg['ax'], anchor_y=acfg['ay']
        )
        fname = f"paladin_{act_name}.png"
        out_path = out_dir / fname
        out_img.save(out_path, 'PNG', optimize=True)

        manifest['actions'][act_name] = {
            'name': act_name,
            'file': fname,
            'directions': 16,
            'frames': actual_frames,
            'cell_width': acfg['cw'],
            'cell_height': acfg['ch'],
            'anchor_x': acfg['ax'],
            'anchor_y': acfg['ay'],
            'fps': acfg['fps'],
            'loop': acfg['loop']
        }
        print(f"[{tier_name}] {act_name:<10}: frames={actual_frames}, size={out_img.size}")

    with open(out_dir / "manifest.json", 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)

    with open(out_dir / "manifest.js", 'w', encoding='utf-8') as f:
        f.write(f"window.{var_name} = " + json.dumps(manifest, indent=2, ensure_ascii=False) + ";\n")

    print(f"Successfully processed {tier_name} ({desc})!")

def main():
    print("=== Processing Paladin Heavy (Heraldic Shield) ===")
    process_variant(
        'paladin_heavy_heraldic.gif',
        'heavy',
        'Diablo II Paladin (Heavy Heraldic Shield Armor) 16-direction action sprite set',
        'PALADIN_HEAVY_MANIFEST'
    )

    print("\n=== Processing Paladin Heavy Tower Shield (Tower Shield) ===")
    process_variant(
        'paladin_heavy_tower.gif',
        'heavy_tower',
        'Diablo II Paladin (Heavy Tower Shield Armor) 16-direction action sprite set',
        'PALADIN_HEAVY_TOWER_MANIFEST'
    )

if __name__ == '__main__':
    main()
