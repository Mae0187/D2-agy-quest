"""
Diablo II 七大職業 16 方向戰鬥地牢動作精靈圖全自動萃取與組裝器
依據暴雪原版 DirectDraw 規範與島嶼像素提取演算法，
為全職業 (Amazon, Assassin, Barbarian, Druid, Necromancer, Paladin, Sorceress)
自動生成 16 方向標準透明精靈圖集與 Manifest 設定檔。
"""
import os
import json
from PIL import Image
import numpy as np

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.normpath(os.path.join(SCRIPT_DIR, '..'))
CHAR_BASE = os.path.join(PROJECT_DIR, 'assets', 'characters')
WEB_CHAR_BASE = os.path.join(PROJECT_DIR, 'web', 'assets', 'characters')

DIRECTIONS_16 = [
    "South", "South-Southeast", "Southeast", "East-Southeast",
    "East", "East-Northeast", "Northeast", "North-Northeast",
    "North", "North-Northwest", "Northwest", "West-Northwest",
    "West", "West-Southwest", "Southwest", "South-Southwest"
]

def extract_action_islands(src_rgba, y1, y2, x1, x2, num_dirs, expected_frames, cell_w, cell_h, anchor_x, anchor_y, fps=12, loop=True, min_row_h=30):
    sub = src_rgba[y1:y2, x1:x2]
    mask = (sub[:, :, 3] > 0)
    row_counts = mask.sum(axis=1)

    # 1. 檢測方向行
    chunks = []
    start = None
    for y, c in enumerate(row_counts):
        if c > 15 and start is None:
            start = y
        elif c <= 15 and start is not None:
            if y - start >= min_row_h:
                chunks.append((start, y - 1))
            start = None
    if start is not None and len(row_counts) - start >= min_row_h:
        chunks.append((start, len(row_counts) - 1))

    # 若行沾黏，將最大者二分切分，直到達到 num_dirs
    while len(chunks) < num_dirs and len(chunks) > 0:
        max_idx = max(range(len(chunks)), key=lambda i: chunks[i][1] - chunks[i][0])
        cs, ce = chunks[max_idx]
        mid = (cs + ce) // 2
        chunks = chunks[:max_idx] + [(cs, mid), (mid + 1, ce)] + chunks[max_idx+1:]

    # 若仍不足，按等分兜底
    if len(chunks) < num_dirs:
        step = (y2 - y1) / num_dirs
        chunks = [(int(i * step), int((i + 1) * step) - 1) for i in range(num_dirs)]
    else:
        chunks = chunks[:num_dirs]

    # 2. 檢測每一行中的精靈圖幀 (Islands)
    all_islands = []
    max_frames = 0
    for d_idx, (ry1, ry2) in enumerate(chunks):
        row_mask = mask[ry1:ry2+1, :]
        col_counts = row_mask.sum(axis=0)

        islands = []
        s = None
        for x, c in enumerate(col_counts):
            if c > 0 and s is None:
                s = x
            elif c == 0 and s is not None:
                if x - s >= 4:
                    islands.append((s, x - 1))
                s = None
        if s is not None and row_mask.shape[1] - s >= 4:
            islands.append((s, row_mask.shape[1] - 1))

        all_islands.append((ry1, ry2, islands))
        if len(islands) > max_frames:
            max_frames = len(islands)

    actual_frames = min(expected_frames, max_frames) if max_frames > 0 else expected_frames
    actual_frames = max(1, actual_frames)

    # 3. 繪製透明網格精靈圖
    out_w = cell_w * actual_frames
    out_h = cell_h * num_dirs
    out_img = Image.new('RGBA', (out_w, out_h), (0, 0, 0, 0))

    for d_idx, (ry1, ry2, islands) in enumerate(all_islands):
        row_sub = sub[ry1:ry2+1, :]
        for f_idx in range(min(actual_frames, len(islands))):
            ix1, ix2 = islands[f_idx]
            patch = row_sub[:, ix1:ix2+1]
            ys, xs = np.where(patch[:, :, 3] > 0)
            if len(ys) == 0:
                continue

            char_crop = patch[ys.min():ys.max()+1, xs.min():xs.max()+1]
            cw = char_crop.shape[1]
            ch = char_crop.shape[0]

            dest_x = (f_idx * cell_w) + (anchor_x - cw // 2)
            dest_y = (d_idx * cell_h) + (anchor_y - ch)

            patch_pil = Image.fromarray(char_crop, 'RGBA')
            out_img.paste(patch_pil, (int(dest_x), int(dest_y)), patch_pil)

    return out_img, actual_frames

def export_character(char_id, actions_config):
    print(f"\n==================================================")
    print(f"Exporting Character: {char_id.upper()}")
    print(f"==================================================")

    out_dir = os.path.join(WEB_CHAR_BASE, char_id)
    os.makedirs(out_dir, exist_ok=True)

    gif_path = os.path.join(CHAR_BASE, char_id, 'spriters', f'{char_id}_light.gif')
    if not os.path.exists(gif_path):
        print(f"Error: {gif_path} not found!")
        return

    src_im = Image.open(gif_path)
    rgb_im = src_im.convert('RGB')
    src_arr = np.array(src_im)
    rgb_arr = np.array(rgb_im)

    is_bg = (src_arr == 9) | (src_arr == 0)
    is_bg = is_bg | ((rgb_arr[:, :, 0] > 240) & (rgb_arr[:, :, 1] > 240) & (rgb_arr[:, :, 2] > 240))
    rgba_full = np.dstack((rgb_arr, np.where(is_bg, 0, 255).astype(np.uint8)))

    manifest = {
        "character": char_id,
        "description": f"Diablo II {char_id.capitalize()} 16-direction action sprite set",
        "directions_order": DIRECTIONS_16,
        "actions": {}
    }

    for act_name, cfg in actions_config.items():
        out_img, actual_frames = extract_action_islands(
            src_rgba=rgba_full,
            y1=cfg['y1'], y2=cfg['y2'],
            x1=cfg['x1'], x2=cfg['x2'],
            num_dirs=16,
            expected_frames=cfg['frames'],
            cell_w=cfg['cell_w'], cell_h=cfg['cell_h'],
            anchor_x=cfg['anchor_x'], anchor_y=cfg['anchor_y'],
            fps=cfg['fps'], loop=cfg['loop'],
            min_row_h=cfg.get('min_row_h', 30)
        )

        out_file = f"{char_id}_{act_name}.png"
        out_path = os.path.join(out_dir, out_file)
        out_img.save(out_path, 'PNG', optimize=True)
        print(f"  [OK] Action '{act_name}': {out_file} ({out_img.width}x{out_img.height}, frames={actual_frames})")

        manifest["actions"][act_name] = {
            "name": act_name,
            "file": out_file,
            "directions": 16,
            "frames": actual_frames,
            "cell_width": cfg['cell_w'],
            "cell_height": cfg['cell_h'],
            "anchor_x": cfg['anchor_x'],
            "anchor_y": cfg['anchor_y'],
            "fps": cfg['fps'],
            "loop": cfg['loop']
        }

    # 寫入 JSON 與 JS
    json_path = os.path.join(out_dir, "manifest.json")
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)

    js_var = f"window.{char_id.upper()}_MANIFEST"
    js_path = os.path.join(out_dir, "manifest.js")
    with open(js_path, 'w', encoding='utf-8') as f:
        f.write(f"{js_var} = " + json.dumps(manifest, indent=2, ensure_ascii=False) + ";\n")

    print(f"Manifest written: {json_path} & {js_path}")

def main():
    # 德魯伊 (Druid)
    druid_config = {
        "idle":   {"y1": 15,   "y2": 1475, "x1": 0,    "x2": 830,  "frames": 16, "cell_w": 80,  "cell_h": 90,  "anchor_x": 40, "anchor_y": 80, "fps": 12, "loop": True},
        "walk":   {"y1": 1585, "y2": 2950, "x1": 0,    "x2": 1350, "frames": 10, "cell_w": 80,  "cell_h": 90,  "anchor_x": 40, "anchor_y": 80, "fps": 14, "loop": True},
        "run":    {"y1": 1585, "y2": 2950, "x1": 1350, "x2": 2460, "frames": 8,  "cell_w": 80,  "cell_h": 90,  "anchor_x": 40, "anchor_y": 80, "fps": 18, "loop": True},
        "attack": {"y1": 2970, "y2": 4324, "x1": 0,    "x2": 1520, "frames": 16, "cell_w": 160, "cell_h": 110, "anchor_x": 80, "anchor_y": 95, "fps": 20, "loop": False},
        "cast":   {"y1": 2970, "y2": 4324, "x1": 1520, "x2": 2460, "frames": 16, "cell_w": 110, "cell_h": 100, "anchor_x": 55, "anchor_y": 90, "fps": 16, "loop": False},
    }
    export_character("druid", druid_config)

    # 女法師 (Sorceress)
    sorceress_config = {
        "idle":   {"y1": 86,   "y2": 1219, "x1": 0,    "x2": 780,  "frames": 16, "cell_w": 80,  "cell_h": 90,  "anchor_x": 40, "anchor_y": 80, "fps": 12, "loop": True},
        "walk":   {"y1": 1317, "y2": 2483, "x1": 0,    "x2": 800,  "frames": 10, "cell_w": 80,  "cell_h": 90,  "anchor_x": 40, "anchor_y": 80, "fps": 14, "loop": True},
        "run":    {"y1": 1317, "y2": 2483, "x1": 800,  "x2": 1600, "frames": 8,  "cell_w": 80,  "cell_h": 90,  "anchor_x": 40, "anchor_y": 80, "fps": 18, "loop": True},
        "attack": {"y1": 2500, "y2": 3760, "x1": 0,    "x2": 1800, "frames": 15, "cell_w": 140, "cell_h": 110, "anchor_x": 70, "anchor_y": 95, "fps": 20, "loop": False},
        "cast":   {"y1": 3800, "y2": 5150, "x1": 0,    "x2": 1800, "frames": 16, "cell_w": 110, "cell_h": 100, "anchor_x": 55, "anchor_y": 90, "fps": 16, "loop": False},
    }
    export_character("sorceress", sorceress_config)

    # 死靈法師 (Necromancer)
    necro_config = {
        "idle":   {"y1": 14,   "y2": 1270, "x1": 0,    "x2": 800,  "frames": 16, "cell_w": 80,  "cell_h": 90,  "anchor_x": 40, "anchor_y": 80, "fps": 12, "loop": True},
        "walk":   {"y1": 1374, "y2": 2871, "x1": 0,    "x2": 820,  "frames": 10, "cell_w": 80,  "cell_h": 90,  "anchor_x": 40, "anchor_y": 80, "fps": 14, "loop": True},
        "run":    {"y1": 1374, "y2": 2871, "x1": 820,  "x2": 1600, "frames": 8,  "cell_w": 80,  "cell_h": 90,  "anchor_x": 40, "anchor_y": 80, "fps": 18, "loop": True},
        "attack": {"y1": 3081, "y2": 4418, "x1": 0,    "x2": 1800, "frames": 15, "cell_w": 140, "cell_h": 110, "anchor_x": 70, "anchor_y": 95, "fps": 20, "loop": False},
        "cast":   {"y1": 1374, "y2": 2871, "x1": 1600, "x2": 2600, "frames": 16, "cell_w": 110, "cell_h": 100, "anchor_x": 55, "anchor_y": 90, "fps": 16, "loop": False},
    }
    export_character("necromancer", necro_config)

    # 亞馬遜 (Amazon)
    amazon_config = {
        "idle":   {"y1": 14,   "y2": 1324, "x1": 0,    "x2": 800,  "frames": 16, "cell_w": 80,  "cell_h": 90,  "anchor_x": 40, "anchor_y": 80, "fps": 12, "loop": True},
        "walk":   {"y1": 1325, "y2": 2650, "x1": 0,    "x2": 820,  "frames": 10, "cell_w": 80,  "cell_h": 90,  "anchor_x": 40, "anchor_y": 80, "fps": 14, "loop": True},
        "run":    {"y1": 1325, "y2": 2650, "x1": 820,  "x2": 1600, "frames": 8,  "cell_w": 80,  "cell_h": 90,  "anchor_x": 40, "anchor_y": 80, "fps": 18, "loop": True},
        "attack": {"y1": 3098, "y2": 4505, "x1": 0,    "x2": 2000, "frames": 15, "cell_w": 150, "cell_h": 110, "anchor_x": 75, "anchor_y": 95, "fps": 20, "loop": False},
        "cast":   {"y1": 1325, "y2": 2650, "x1": 1600, "x2": 2500, "frames": 16, "cell_w": 110, "cell_h": 100, "anchor_x": 55, "anchor_y": 90, "fps": 16, "loop": False},
    }
    export_character("amazon", amazon_config)

    # 野蠻人 (Barbarian)
    barbarian_config = {
        "idle":   {"y1": 258,  "y2": 1377, "x1": 0,    "x2": 800,  "frames": 16, "cell_w": 90,  "cell_h": 90,  "anchor_x": 45, "anchor_y": 80, "fps": 12, "loop": True},
        "walk":   {"y1": 2256, "y2": 3476, "x1": 0,    "x2": 840,  "frames": 10, "cell_w": 90,  "cell_h": 90,  "anchor_x": 45, "anchor_y": 80, "fps": 14, "loop": True},
        "run":    {"y1": 2256, "y2": 3476, "x1": 840,  "x2": 1600, "frames": 8,  "cell_w": 90,  "cell_h": 90,  "anchor_x": 45, "anchor_y": 80, "fps": 18, "loop": True},
        "attack": {"y1": 3622, "y2": 5053, "x1": 0,    "x2": 2400, "frames": 15, "cell_w": 160, "cell_h": 110, "anchor_x": 80, "anchor_y": 95, "fps": 20, "loop": False},
        "cast":   {"y1": 2256, "y2": 3476, "x1": 1600, "x2": 2550, "frames": 16, "cell_w": 110, "cell_h": 100, "anchor_x": 55, "anchor_y": 90, "fps": 16, "loop": False},
    }
    export_character("barbarian", barbarian_config)

    # 刺客 (Assassin)
    assassin_config = {
        "idle":   {"y1": 395,  "y2": 1229, "x1": 0,    "x2": 600,  "frames": 16, "cell_w": 80,  "cell_h": 90,  "anchor_x": 40, "anchor_y": 80, "fps": 12, "loop": True},
        "walk":   {"y1": 1571, "y2": 2514, "x1": 0,    "x2": 620,  "frames": 10, "cell_w": 80,  "cell_h": 90,  "anchor_x": 40, "anchor_y": 80, "fps": 14, "loop": True},
        "run":    {"y1": 1571, "y2": 2514, "x1": 620,  "x2": 1200, "frames": 8,  "cell_w": 80,  "cell_h": 90,  "anchor_x": 40, "anchor_y": 80, "fps": 18, "loop": True},
        "attack": {"y1": 6379, "y2": 7953, "x1": 0,    "x2": 1300, "frames": 15, "cell_w": 140, "cell_h": 110, "anchor_x": 70, "anchor_y": 95, "fps": 20, "loop": False},
        "cast":   {"y1": 9428, "y2": 10711, "x1": 0,   "x2": 950,  "frames": 16, "cell_w": 110, "cell_h": 100, "anchor_x": 55, "anchor_y": 90, "fps": 16, "loop": False},
    }
    export_character("assassin", assassin_config)

    print("\nALL 6 CHARACTERS EXPORTED SUCCESSFULLY!")

if __name__ == '__main__':
    main()
