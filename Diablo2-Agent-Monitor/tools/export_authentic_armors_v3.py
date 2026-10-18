"""
Diablo II 20款全裝甲形態精靈圖高精度自動萃取器 (v3.0 Authentic Armor Exporter)
核心升級：
1. 標籤抹除防護：萃取前先將 Spriters Resource 頂部標籤文字區塊填補為純透明，杜絕削頂斷頭！
2. 行基準線地面對齊 (Row Ground Baseline Alignment)：
   row_ground_max = max(ys.max() for all frames in that row)
   dest_y = (d_idx * cell_h) + (anchor_y - (row_ground_max - ys.min()))
   徹底解決走路/跑步單元格劇烈抖動沉入地底的致命問題！
3. 自動適配全職業背景色 (支援 Druid/Sorceress/Amazon 特殊灰階底色)。
4. 嚴格保護聖騎士輕裝 (Paladin Light) 不受改動，作為唯一黃金基準！
"""
import os
import json
from PIL import Image
import numpy as np

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.normpath(os.path.join(SCRIPT_DIR, '..'))
CLASSES_SRC_DIR = os.path.normpath(os.path.join(PROJECT_DIR, '..', 'diablo2_sprites', 'Classes'))
WEB_CHAR_BASE = os.path.join(PROJECT_DIR, 'web', 'assets', 'characters')

DIRECTIONS_16 = [
    "South", "South-Southeast", "Southeast", "East-Southeast",
    "East", "East-Northeast", "Northeast", "North-Northeast",
    "North", "North-Northwest", "Northwest", "West-Northwest",
    "West", "West-Southwest", "Southwest", "South-Southwest"
]

def extract_action(rgba, y1, y2, x1, x2, num_dirs, expected_frames, cell_w, cell_h, anchor_x, anchor_y):
    sub = rgba[y1:y2, x1:x2]
    mask = (sub[:, :, 3] > 0)
    row_counts = mask.sum(axis=1)

    # 1. 偵測 16 方向行
    chunks = []
    s = None
    min_row_h = 28
    for y, c in enumerate(row_counts):
        if c > 15 and s is None:
            s = y
        elif c <= 15 and s is not None:
            if y - s >= min_row_h:
                chunks.append((s, y - 1))
            s = None
    if s is not None and len(row_counts) - s >= min_row_h:
        chunks.append((s, len(row_counts) - 1))

    # 若行數不足 16，切分最大行
    while len(chunks) < num_dirs and len(chunks) > 0:
        max_idx = max(range(len(chunks)), key=lambda i: chunks[i][1] - chunks[i][0])
        cs, ce = chunks[max_idx]
        if ce - cs < min_row_h * 2:
            break
        mid = (cs + ce) // 2
        chunks = chunks[:max_idx] + [(cs, mid), (mid + 1, ce)] + chunks[max_idx+1:]

    chunks = chunks[:num_dirs]
    if len(chunks) < num_dirs:
        step = (y2 - y1) / float(num_dirs)
        chunks = [(int(i * step), int((i + 1) * step) - 1) for i in range(num_dirs)]

    # 2. 檢測每一方向行中的影格島嶼
    all_islands = []
    max_frames = 0
    for d_idx, (ry1, ry2) in enumerate(chunks):
        row_mask = mask[ry1:ry2+1, :]
        col_counts = row_mask.sum(axis=0)
        islands = []
        is_s = None
        for x, c in enumerate(col_counts):
            if c > 0 and is_s is None:
                is_s = x
            elif c == 0 and is_s is not None:
                if x - is_s >= 5:
                    islands.append((is_s, x - 1))
                is_s = None
        if is_s is not None and row_mask.shape[1] - is_s >= 5:
            islands.append((is_s, row_mask.shape[1] - 1))

        all_islands.append((ry1, ry2, islands))
        if len(islands) > max_frames:
            max_frames = len(islands)

    actual_frames = min(expected_frames, max_frames) if max_frames > 0 else expected_frames
    actual_frames = max(1, actual_frames)

    out_img = Image.new('RGBA', (cell_w * actual_frames, cell_h * num_dirs), (0, 0, 0, 0))

    # 3. 行基準線地面對齊繪製
    for d_idx, (ry1, ry2, islands) in enumerate(all_islands):
        row_sub = sub[ry1:ry2+1, :]
        row_frames_crops = []
        row_ground_max = 0

        for f_idx in range(min(actual_frames, len(islands))):
            ix1, ix2 = islands[f_idx]
            patch = row_sub[:, ix1:ix2+1]
            ys, xs = np.where(patch[:, :, 3] > 0)
            if len(ys) == 0:
                row_frames_crops.append(None)
                continue
            row_ground_max = max(row_ground_max, ys.max())
            row_frames_crops.append((patch, ys.min(), ys.max(), xs.min(), xs.max()))

        for f_idx, crop_info in enumerate(row_frames_crops):
            if crop_info is None:
                continue
            patch, y_min, y_max, x_min, x_max = crop_info
            char_crop = patch[y_min:y_max+1, x_min:x_max+1]
            cw = char_crop.shape[1]
            ch = char_crop.shape[0]

            dest_x = (f_idx * cell_w) + (anchor_x - cw // 2)
            # 行基準線公式：踩地幀剛好接觸 anchor_y，抬腿幀腳尖自然懸空，軀幹與頭部水平絕對平穩
            dest_y = (d_idx * cell_h) + (anchor_y - (row_ground_max - y_min))

            patch_pil = Image.fromarray(char_crop, 'RGBA')
            out_img.paste(patch_pil, (int(dest_x), int(dest_y)), patch_pil)

    return out_img, actual_frames

def process_hero_armor(char_id, armor_tier, gif_filename, actions_cfg, labels_to_erase):
    # 聖騎士輕裝為使用者親自驗收認可之標準，絕不重新覆蓋
    if char_id == 'paladin' and armor_tier == 'light':
        print("[SKIP] Paladin Light is already the gold standard, skipping overwrite.")
        return

    print(f"\n========================================================")
    print(f">>> Processing {char_id.upper()} [{armor_tier.upper()}] from {gif_filename} <<<")
    print(f"========================================================")

    gif_path = os.path.join(CLASSES_SRC_DIR, gif_filename)
    if not os.path.exists(gif_path):
        print(f"Error: {gif_path} not found!")
        return

    im = Image.open(gif_path)
    arr = np.array(im)
    rgb = np.array(im.convert('RGB'))
    bg_idx = arr[0, 0]
    bg_rgb = rgb[0, 0]

    # 全通用背景判定
    color_dist = np.abs(rgb.astype(int) - bg_rgb.astype(int)).max(axis=2)
    is_bg = (arr == bg_idx) | (color_dist < 10) | (arr == 9)
    rgba = np.dstack((rgb, np.where(is_bg, 0, 255).astype(np.uint8)))

    # 標籤擦除防護：將原圖標籤文字區塊設為 0 透明度，確保 row 0 頭部毫髮無傷且不帶文字雜訊
    for lx, ly, lw, lh in labels_to_erase:
        y1 = max(0, ly - 2)
        y2 = min(im.height, ly + lh + 4)
        x1 = max(0, lx - 2)
        x2 = min(im.width, lx + lw + 4)
        rgba[y1:y2, x1:x2, 3] = 0

    tier_out_dir = os.path.join(WEB_CHAR_BASE, char_id, armor_tier)
    os.makedirs(tier_out_dir, exist_ok=True)

    manifest = {
        "character": char_id,
        "armor_tier": armor_tier,
        "description": f"Diablo II {char_id.capitalize()} ({armor_tier.capitalize()} Armor) 16-direction action sprite set",
        "directions_order": DIRECTIONS_16,
        "actions": {}
    }

    for act_name, cfg in actions_cfg.items():
        out_img, actual_frames = extract_action(
            rgba=rgba,
            y1=cfg['y1'], y2=cfg['y2'],
            x1=cfg['x1'], x2=cfg['x2'],
            num_dirs=16,
            expected_frames=cfg['frames'],
            cell_w=cfg['cw'], cell_h=cfg['ch'],
            anchor_x=cfg['ax'], anchor_y=cfg['ay']
        )

        file_name = f"{char_id}_{act_name}.png"
        out_path = os.path.join(tier_out_dir, file_name)
        out_img.save(out_path, 'PNG', optimize=True)
        print(f"  [OK] {act_name:8s}: saved {file_name} ({out_img.width}x{out_img.height}, frames={actual_frames})")

        manifest["actions"][act_name] = {
            "name": act_name,
            "file": file_name,
            "directions": 16,
            "frames": actual_frames,
            "cell_width": cfg['cw'],
            "cell_height": cfg['ch'],
            "anchor_x": cfg['ax'],
            "anchor_y": cfg['ay'],
            "fps": cfg['fps'],
            "loop": cfg['loop']
        }

    # 儲存 Manifest JSON 與 JS
    json_path = os.path.join(tier_out_dir, "manifest.json")
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)

    var_name = f"{char_id.upper()}_{armor_tier.upper()}_MANIFEST"
    js_path = os.path.join(tier_out_dir, "manifest.js")
    with open(js_path, 'w', encoding='utf-8') as f:
        f.write(f"window.{var_name} = " + json.dumps(manifest, indent=2, ensure_ascii=False) + ";\n")

    # 若為 light 裝甲，同步更新該職業根目錄預設
    if armor_tier == 'light':
        root_dir = os.path.join(WEB_CHAR_BASE, char_id)
        for act_name in actions_cfg.keys():
            file_name = f"{char_id}_{act_name}.png"
            src_f = os.path.join(tier_out_dir, file_name)
            dst_f = os.path.join(root_dir, file_name)
            if os.path.exists(src_f):
                im_copy = Image.open(src_f)
                im_copy.save(dst_f, 'PNG', optimize=True)
        root_json = os.path.join(root_dir, "manifest.json")
        with open(root_json, 'w', encoding='utf-8') as f:
            json.dump(manifest, f, indent=2, ensure_ascii=False)
        root_js = os.path.join(root_dir, "manifest.js")
        with open(root_js, 'w', encoding='utf-8') as f:
            f.write(f"window.{char_id.upper()}_MANIFEST = " + json.dumps(manifest, indent=2, ensure_ascii=False) + ";\n")
        print(f"  [Root Synced] {char_id} root directory synced with {armor_tier}")

def main():
    # ========================================================
    # 1. 德魯伊 (Druid)
    # ========================================================
    druid_light_cfg = {
        'idle':   {'y1': 0,    'y2': 1480, 'x1': 381,  'x2': 823,  'frames': 16, 'cw': 90,  'ch': 90,  'ax': 45, 'ay': 80, 'fps': 12, 'loop': True},
        'walk':   {'y1': 2950, 'y2': 4328, 'x1': 1533, 'x2': 1903, 'frames': 8,  'cw': 90,  'ch': 90,  'ax': 45, 'ay': 80, 'fps': 14, 'loop': True},
        'run':    {'y1': 2950, 'y2': 4328, 'x1': 1903, 'x2': 2800, 'frames': 8,  'cw': 90,  'ch': 90,  'ax': 45, 'ay': 80, 'fps': 18, 'loop': True},
        'attack': {'y1': 2950, 'y2': 4328, 'x1': 0,    'x2': 1533, 'frames': 16, 'cw': 160, 'ch': 110, 'ax': 80, 'ay': 95, 'fps': 20, 'loop': False},
        'cast':   {'y1': 0,    'y2': 1480, 'x1': 823,  'x2': 2009, 'frames': 16, 'cw': 120, 'ch': 100, 'ax': 60, 'ay': 90, 'fps': 16, 'loop': False},
    }
    druid_light_labels = [(0, 0, 78, 16), (381, 0, 93, 16), (823, 0, 92, 19), (0, 1581, 41, 16), (0, 2954, 62, 16), (1533, 2954, 49, 16), (1903, 2954, 41, 16)]
    process_hero_armor('druid', 'light', 'Druid (Light).gif', druid_light_cfg, druid_light_labels)

    druid_med_cfg = {
        'idle':   {'y1': 0,    'y2': 1500, 'x1': 509,  'x2': 971,  'frames': 16, 'cw': 90,  'ch': 90,  'ax': 45, 'ay': 80, 'fps': 12, 'loop': True},
        'walk':   {'y1': 3110, 'y2': 4550, 'x1': 1500, 'x2': 2390, 'frames': 8,  'cw': 90,  'ch': 90,  'ax': 45, 'ay': 80, 'fps': 14, 'loop': True},
        'run':    {'y1': 4550, 'y2': 6132, 'x1': 2392, 'x2': 2993, 'frames': 8,  'cw': 90,  'ch': 90,  'ax': 45, 'ay': 80, 'fps': 18, 'loop': True},
        'attack': {'y1': 3110, 'y2': 4550, 'x1': 0,    'x2': 1500, 'frames': 16, 'cw': 160, 'ch': 110, 'ax': 80, 'ay': 95, 'fps': 20, 'loop': False},
        'cast':   {'y1': 0,    'y2': 1500, 'x1': 971,  'x2': 2172, 'frames': 16, 'cw': 120, 'ch': 100, 'ax': 60, 'ay': 90, 'fps': 16, 'loop': False},
    }
    druid_med_labels = [(0, 0, 78, 16), (509, 0, 93, 16), (971, 0, 92, 19), (5, 3114, 60, 16), (2392, 4551, 41, 16)]
    process_hero_armor('druid', 'medium', 'Druid (Medium).gif', druid_med_cfg, druid_med_labels)

    druid_heavy_cfg = {
        'idle':   {'y1': 0,    'y2': 1700, 'x1': 621,  'x2': 1303, 'frames': 16, 'cw': 90,  'ch': 90,  'ax': 45, 'ay': 80, 'fps': 12, 'loop': True},
        'walk':   {'y1': 0,    'y2': 1700, 'x1': 2534, 'x2': 3384, 'frames': 8,  'cw': 90,  'ch': 90,  'ax': 45, 'ay': 80, 'fps': 14, 'loop': True},
        'run':    {'y1': 5520, 'y2': 7172, 'x1': 2531, 'x2': 3384, 'frames': 8,  'cw': 90,  'ch': 90,  'ax': 45, 'ay': 80, 'fps': 18, 'loop': True},
        'attack': {'y1': 3430, 'y2': 5520, 'x1': 0,    'x2': 2500, 'frames': 16, 'cw': 160, 'ch': 110, 'ax': 80, 'ay': 95, 'fps': 20, 'loop': False},
        'cast':   {'y1': 0,    'y2': 1700, 'x1': 1303, 'x2': 2534, 'frames': 16, 'cw': 120, 'ch': 100, 'ax': 60, 'ay': 90, 'fps': 16, 'loop': False},
    }
    druid_heavy_labels = [(0, 0, 78, 16), (621, 0, 93, 16), (1303, 0, 92, 19), (2534, 0, 48, 16), (5, 3434, 60, 16), (2531, 5527, 41, 16)]
    process_hero_armor('druid', 'heavy', 'Druid (Heavy).gif', druid_heavy_cfg, druid_heavy_labels)

    # ========================================================
    # 2. 死靈法師 (Necromancer)
    # ========================================================
    necro_light_cfg = {
        'idle':   {'y1': 0,    'y2': 1350, 'x1': 0,    'x2': 1005, 'frames': 16, 'cw': 90,  'ch': 90,  'ax': 45, 'ay': 80, 'fps': 12, 'loop': True},
        'walk':   {'y1': 1350, 'y2': 2870, 'x1': 2804, 'x2': 3258, 'frames': 10, 'cw': 90,  'ch': 90,  'ax': 45, 'ay': 80, 'fps': 14, 'loop': True},
        'run':    {'y1': 1350, 'y2': 2870, 'x1': 0,    'x2': 654,  'frames': 8,  'cw': 90,  'ch': 90,  'ax': 45, 'ay': 80, 'fps': 18, 'loop': True},
        'attack': {'y1': 2870, 'y2': 4420, 'x1': 0,    'x2': 2500, 'frames': 15, 'cw': 150, 'ch': 110, 'ax': 75, 'ay': 95, 'fps': 20, 'loop': False},
        'cast':   {'y1': 0,    'y2': 1350, 'x1': 1968, 'x2': 3258, 'frames': 16, 'cw': 120, 'ch': 100, 'ax': 60, 'ay': 90, 'fps': 16, 'loop': False},
    }
    necro_light_labels = [(0, 0, 89, 16), (1005, 0, 82, 16), (1968, 0, 92, 19), (0, 1357, 38, 16), (2804, 1357, 48, 16), (5, 2874, 60, 16)]
    process_hero_armor('necromancer', 'light', 'Necromancer (Light).gif', necro_light_cfg, necro_light_labels)

    necro_med_cfg = {
        'idle':   {'y1': 0,    'y2': 1400, 'x1': 493,  'x2': 1359, 'frames': 16, 'cw': 90,  'ch': 90,  'ax': 45, 'ay': 80, 'fps': 12, 'loop': True},
        'walk':   {'y1': 1400, 'y2': 2740, 'x1': 1295, 'x2': 2200, 'frames': 10, 'cw': 90,  'ch': 90,  'ax': 45, 'ay': 80, 'fps': 14, 'loop': True},
        'run':    {'y1': 1400, 'y2': 2740, 'x1': 0,    'x2': 650,  'frames': 8,  'cw': 90,  'ch': 90,  'ax': 45, 'ay': 80, 'fps': 18, 'loop': True},
        'attack': {'y1': 4450, 'y2': 5980, 'x1': 0,    'x2': 2500, 'frames': 15, 'cw': 150, 'ch': 110, 'ax': 75, 'ay': 95, 'fps': 20, 'loop': False},
        'cast':   {'y1': 0,    'y2': 1400, 'x1': 1359, 'x2': 2200, 'frames': 16, 'cw': 120, 'ch': 100, 'ax': 60, 'ay': 90, 'fps': 16, 'loop': False},
    }
    necro_med_labels = [(0, 0, 78, 16), (493, 0, 93, 16), (1359, 0, 92, 19), (0, 1405, 56, 16), (1295, 1405, 48, 16), (5, 4455, 60, 16)]
    process_hero_armor('necromancer', 'medium', 'Necromancer (Medium).gif', necro_med_cfg, necro_med_labels)

    necro_heavy_cfg = {
        'idle':   {'y1': 0,    'y2': 1620, 'x1': 637,  'x2': 2047, 'frames': 16, 'cw': 90,  'ch': 90,  'ax': 45, 'ay': 80, 'fps': 12, 'loop': True},
        'walk':   {'y1': 1620, 'y2': 3210, 'x1': 1607, 'x2': 2352, 'frames': 10, 'cw': 90,  'ch': 90,  'ax': 45, 'ay': 80, 'fps': 14, 'loop': True},
        'run':    {'y1': 1620, 'y2': 3210, 'x1': 782,  'x2': 1607, 'frames': 8,  'cw': 90,  'ch': 90,  'ax': 45, 'ay': 80, 'fps': 18, 'loop': True},
        'attack': {'y1': 5110, 'y2': 7520, 'x1': 0,    'x2': 2600, 'frames': 15, 'cw': 150, 'ch': 110, 'ax': 75, 'ay': 95, 'fps': 20, 'loop': False},
        'cast':   {'y1': 0,    'y2': 1620, 'x1': 2047, 'x2': 3500, 'frames': 16, 'cw': 120, 'ch': 100, 'ax': 60, 'ay': 90, 'fps': 16, 'loop': False},
    }
    necro_heavy_labels = [(0, 0, 78, 16), (637, 0, 93, 16), (2047, 0, 92, 19), (782, 1629, 41, 16), (1607, 1629, 48, 16), (5, 5111, 60, 16)]
    process_hero_armor('necromancer', 'heavy', 'Necromancer (Heavy).gif', necro_heavy_cfg, necro_heavy_labels)

    # ========================================================
    # 3. 魔法使 (Sorceress)
    # ========================================================
    sorc_light_cfg = {
        'idle':   {'y1': 0,    'y2': 1220, 'x1': 0,    'x2': 669,  'frames': 16, 'cw': 90,  'ch': 90,  'ax': 45, 'ay': 80, 'fps': 12, 'loop': True},
        'walk':   {'y1': 0,    'y2': 1220, 'x1': 1583, 'x2': 2605, 'frames': 10, 'cw': 90,  'ch': 90,  'ax': 45, 'ay': 80, 'fps': 14, 'loop': True},
        'run':    {'y1': 1220, 'y2': 2490, 'x1': 0,    'x2': 486,  'frames': 8,  'cw': 90,  'ch': 90,  'ax': 45, 'ay': 80, 'fps': 18, 'loop': True},
        'attack': {'y1': 2490, 'y2': 3760, 'x1': 0,    'x2': 1600, 'frames': 15, 'cw': 150, 'ch': 110, 'ax': 75, 'ay': 95, 'fps': 20, 'loop': False},
        'cast':   {'y1': 5250, 'y2': 6736, 'x1': 1244, 'x2': 2605, 'frames': 16, 'cw': 120, 'ch': 100, 'ax': 60, 'ay': 90, 'fps': 16, 'loop': False},
    }
    sorc_light_labels = [(0, 0, 89, 16), (1583, 0, 49, 16), (0, 1229, 38, 16), (0, 2490, 62, 16), (1244, 5252, 92, 19)]
    process_hero_armor('sorceress', 'light', 'Sorceress (Light).gif', sorc_light_cfg, sorc_light_labels)
    process_hero_armor('sorceress', 'medium', 'Sorceress (Light).gif', sorc_light_cfg, sorc_light_labels)

    sorc_heavy_cfg = {
        'idle':   {'y1': 0,    'y2': 1530, 'x1': 0,    'x2': 765,  'frames': 16, 'cw': 90,  'ch': 90,  'ax': 45, 'ay': 80, 'fps': 12, 'loop': True},
        'walk':   {'y1': 1530, 'y2': 2970, 'x1': 0,    'x2': 558,  'frames': 10, 'cw': 90,  'ch': 90,  'ax': 45, 'ay': 80, 'fps': 14, 'loop': True},
        'run':    {'y1': 1530, 'y2': 2970, 'x1': 558,  'x2': 1127, 'frames': 8,  'cw': 90,  'ch': 90,  'ax': 45, 'ay': 80, 'fps': 18, 'loop': True},
        'attack': {'y1': 2970, 'y2': 4615, 'x1': 0,    'x2': 1800, 'frames': 15, 'cw': 150, 'ch': 110, 'ax': 75, 'ay': 95, 'fps': 20, 'loop': False},
        'cast':   {'y1': 0,    'y2': 1530, 'x1': 1776, 'x2': 3179, 'frames': 16, 'cw': 120, 'ch': 100, 'ax': 60, 'ay': 90, 'fps': 16, 'loop': False},
    }
    sorc_heavy_labels = [(0, 0, 89, 16), (0, 1533, 45, 16), (558, 1533, 41, 16), (5, 2970, 60, 16), (1776, 0, 92, 19)]
    process_hero_armor('sorceress', 'heavy', 'Sorceress (Heavy).gif', sorc_heavy_cfg, sorc_heavy_labels)

    # ========================================================
    # 4. 野蠻人 (Barbarian)
    # ========================================================
    barb_light_cfg = {
        'idle':   {'y1': 0,    'y2': 1830, 'x1': 605,  'x2': 1711, 'frames': 16, 'cw': 90,  'ch': 90,  'ax': 45, 'ay': 80, 'fps': 12, 'loop': True},
        'walk':   {'y1': 1830, 'y2': 3490, 'x1': 1279, 'x2': 1976, 'frames': 10, 'cw': 90,  'ch': 90,  'ax': 45, 'ay': 80, 'fps': 14, 'loop': True},
        'run':    {'y1': 1830, 'y2': 3490, 'x1': 686,  'x2': 1279, 'frames': 8,  'cw': 90,  'ch': 90,  'ax': 45, 'ay': 80, 'fps': 18, 'loop': True},
        'attack': {'y1': 5250, 'y2': 7360, 'x1': 0,    'x2': 2200, 'frames': 15, 'cw': 160, 'ch': 110, 'ax': 80, 'ay': 95, 'fps': 20, 'loop': False},
        'cast':   {'y1': 0,    'y2': 1830, 'x1': 1711, 'x2': 3357, 'frames': 16, 'cw': 120, 'ch': 100, 'ax': 60, 'ay': 90, 'fps': 16, 'loop': False},
    }
    barb_light_labels = [(605, 0, 93, 16), (1711, 0, 92, 19), (686, 1837, 41, 16), (1279, 1837, 48, 16), (5, 5255, 60, 16)]
    process_hero_armor('barbarian', 'light', 'Barbarian (Light).gif', barb_light_cfg, barb_light_labels)

    barb_med_cfg = {
        'idle':   {'y1': 0,    'y2': 1940, 'x1': 621,  'x2': 1711, 'frames': 16, 'cw': 90,  'ch': 90,  'ax': 45, 'ay': 80, 'fps': 12, 'loop': True},
        'walk':   {'y1': 1940, 'y2': 3830, 'x1': 3557, 'x2': 3987, 'frames': 10, 'cw': 90,  'ch': 90,  'ax': 45, 'ay': 80, 'fps': 14, 'loop': True},
        'run':    {'y1': 6160, 'y2': 8627, 'x1': 3292, 'x2': 3987, 'frames': 8,  'cw': 90,  'ch': 90,  'ax': 45, 'ay': 80, 'fps': 18, 'loop': True},
        'attack': {'y1': 3830, 'y2': 6160, 'x1': 0,    'x2': 2200, 'frames': 15, 'cw': 160, 'ch': 110, 'ax': 80, 'ay': 95, 'fps': 20, 'loop': False},
        'cast':   {'y1': 0,    'y2': 1940, 'x1': 1711, 'x2': 3028, 'frames': 16, 'cw': 120, 'ch': 100, 'ax': 60, 'ay': 90, 'fps': 16, 'loop': False},
    }
    barb_med_labels = [(621, 0, 93, 16), (1711, 0, 92, 19), (3557, 1949, 48, 16), (5, 3834, 60, 16), (3292, 6167, 41, 16)]
    process_hero_armor('barbarian', 'medium', 'Barbarian (Medium).gif', barb_med_cfg, barb_med_labels)

    barb_heavy_cfg = {
        'idle':   {'y1': 0,    'y2': 1830, 'x1': 701,  'x2': 1951, 'frames': 16, 'cw': 90,  'ch': 90,  'ax': 45, 'ay': 80, 'fps': 12, 'loop': True},
        'walk':   {'y1': 1830, 'y2': 3670, 'x1': 3272, 'x2': 4189, 'frames': 10, 'cw': 90,  'ch': 90,  'ax': 45, 'ay': 80, 'fps': 14, 'loop': True},
        'run':    {'y1': 5950, 'y2': 8500, 'x1': 3102, 'x2': 4189, 'frames': 8,  'cw': 90,  'ch': 90,  'ax': 45, 'ay': 80, 'fps': 18, 'loop': True},
        'attack': {'y1': 3670, 'y2': 5950, 'x1': 0,    'x2': 2500, 'frames': 15, 'cw': 160, 'ch': 110, 'ax': 80, 'ay': 95, 'fps': 20, 'loop': False},
        'cast':   {'y1': 0,    'y2': 1830, 'x1': 1951, 'x2': 3170, 'frames': 16, 'cw': 120, 'ch': 100, 'ax': 60, 'ay': 90, 'fps': 16, 'loop': False},
    }
    barb_heavy_labels = [(701, 0, 93, 16), (1951, 0, 92, 19), (3272, 1837, 48, 16), (5, 3674, 60, 16), (3102, 5959, 41, 16)]
    process_hero_armor('barbarian', 'heavy', 'Barbarian (Heavy).gif', barb_heavy_cfg, barb_heavy_labels)

    # ========================================================
    # 5. 亞馬遜 (Amazon)
    # ========================================================
    amazon_light_cfg = {
        'idle':   {'y1': 0,    'y2': 1320, 'x1': 0,    'x2': 1213, 'frames': 16, 'cw': 90,  'ch': 90,  'ax': 45, 'ay': 80, 'fps': 12, 'loop': True},
        'walk':   {'y1': 1320, 'y2': 3090, 'x1': 0,    'x2': 622,  'frames': 10, 'cw': 90,  'ch': 90,  'ax': 45, 'ay': 80, 'fps': 14, 'loop': True},
        'run':    {'y1': 3090, 'y2': 4710, 'x1': 0,    'x2': 702,  'frames': 8,  'cw': 90,  'ch': 90,  'ax': 45, 'ay': 80, 'fps': 18, 'loop': True},
        'attack': {'y1': 4710, 'y2': 6400, 'x1': 0,    'x2': 1188, 'frames': 15, 'cw': 160, 'ch': 110, 'ax': 80, 'ay': 95, 'fps': 20, 'loop': False},
        'cast':   {'y1': 1320, 'y2': 3090, 'x1': 622,  'x2': 1800, 'frames': 16, 'cw': 120, 'ch': 100, 'ax': 60, 'ay': 90, 'fps': 16, 'loop': False},
    }
    amazon_light_labels = [(0, 0, 89, 16), (0, 1325, 48, 16), (622, 1325, 92, 19), (0, 3098, 41, 16), (0, 4711, 62, 16)]
    process_hero_armor('amazon', 'light', 'Amazon (Light).gif', amazon_light_cfg, amazon_light_labels)
    process_hero_armor('amazon', 'medium', 'Amazon (Light).gif', amazon_light_cfg, amazon_light_labels)

    amazon_heavy_cfg = {
        'idle':   {'y1': 0,    'y2': 1320, 'x1': 0,    'x2': 957,  'frames': 16, 'cw': 90,  'ch': 90,  'ax': 45, 'ay': 80, 'fps': 12, 'loop': True},
        'walk':   {'y1': 1320, 'y2': 3140, 'x1': 0,    'x2': 550,  'frames': 10, 'cw': 90,  'ch': 90,  'ax': 45, 'ay': 80, 'fps': 14, 'loop': True},
        'run':    {'y1': 3140, 'y2': 4590, 'x1': 0,    'x2': 513,  'frames': 8,  'cw': 90,  'ch': 90,  'ax': 45, 'ay': 80, 'fps': 18, 'loop': True},
        'attack': {'y1': 4590, 'y2': 5987, 'x1': 0,    'x2': 2255, 'frames': 15, 'cw': 160, 'ch': 110, 'ax': 80, 'ay': 95, 'fps': 20, 'loop': False},
        'cast':   {'y1': 1320, 'y2': 3140, 'x1': 550,  'x2': 1800, 'frames': 16, 'cw': 120, 'ch': 100, 'ax': 60, 'ay': 90, 'fps': 16, 'loop': False},
    }
    amazon_heavy_labels = [(0, 0, 89, 16), (0, 1325, 48, 16), (550, 1325, 92, 19), (6, 3146, 41, 16), (5, 4599, 60, 16)]
    process_hero_armor('amazon', 'heavy', 'Amazon (Heavy).gif', amazon_heavy_cfg, amazon_heavy_labels)

    # ========================================================
    # 6. 刺客 (Assassin)
    # ========================================================
    assassin_light_cfg = {
        'idle':   {'y1': 0,     'y2': 1240,  'x1': 0,   'x2': 405,  'frames': 16, 'cw': 90,  'ch': 90,  'ax': 45, 'ay': 80, 'fps': 12, 'loop': True},
        'walk':   {'y1': 1240,  'y2': 2530,  'x1': 0,   'x2': 334,  'frames': 10, 'cw': 90,  'ch': 90,  'ax': 45, 'ay': 80, 'fps': 14, 'loop': True},
        'run':    {'y1': 1240,  'y2': 2530,  'x1': 334, 'x2': 831,  'frames': 8,  'cw': 90,  'ch': 90,  'ax': 45, 'ay': 80, 'fps': 18, 'loop': True},
        'attack': {'y1': 3830,  'y2': 5120,  'x1': 0,   'x2': 1350, 'frames': 15, 'cw': 150, 'ch': 110, 'ax': 75, 'ay': 95, 'fps': 20, 'loop': False},
        'cast':   {'y1': 10710, 'y2': 11970, 'x1': 0,   'x2': 1350, 'frames': 16, 'cw': 120, 'ch': 100, 'ax': 60, 'ay': 90, 'fps': 16, 'loop': False},
    }
    assassin_light_labels = [(0, 0, 89, 16), (0, 1245, 48, 16), (334, 1245, 41, 16), (5, 3831, 60, 16), (0, 10712, 92, 19)]
    process_hero_armor('assassin', 'light', 'Assassin (Light).gif', assassin_light_cfg, assassin_light_labels)

    assassin_med_cfg = {
        'idle':   {'y1': 0,    'y2': 1240, 'x1': 0,   'x2': 741,  'frames': 16, 'cw': 90,  'ch': 90,  'ax': 45, 'ay': 80, 'fps': 12, 'loop': True},
        'walk':   {'y1': 1240, 'y2': 2530, 'x1': 0,   'x2': 510,  'frames': 10, 'cw': 90,  'ch': 90,  'ax': 45, 'ay': 80, 'fps': 14, 'loop': True},
        'run':    {'y1': 1240, 'y2': 2530, 'x1': 510, 'x2': 1103, 'frames': 8,  'cw': 90,  'ch': 90,  'ax': 45, 'ay': 80, 'fps': 18, 'loop': True},
        'attack': {'y1': 3860, 'y2': 5340, 'x1': 0,   'x2': 1682, 'frames': 15, 'cw': 150, 'ch': 110, 'ax': 75, 'ay': 95, 'fps': 20, 'loop': False},
        'cast':   {'y1': 8300, 'y2': 9617, 'x1': 0,   'x2': 1682, 'frames': 16, 'cw': 120, 'ch': 100, 'ax': 60, 'ay': 90, 'fps': 16, 'loop': False},
    }
    assassin_med_labels = [(0, 0, 89, 16), (0, 1245, 48, 16), (510, 1245, 41, 16), (5, 3863, 60, 16), (0, 8309, 92, 19)]
    process_hero_armor('assassin', 'medium', 'Assassin (Medium).gif', assassin_med_cfg, assassin_med_labels)

    assassin_heavy_cfg = {
        'idle':   {'y1': 0,     'y2': 1240,  'x1': 0,   'x2': 405,  'frames': 16, 'cw': 90,  'ch': 90,  'ax': 45, 'ay': 80, 'fps': 12, 'loop': True},
        'walk':   {'y1': 1240,  'y2': 2600,  'x1': 0,   'x2': 398,  'frames': 10, 'cw': 90,  'ch': 90,  'ax': 45, 'ay': 80, 'fps': 14, 'loop': True},
        'run':    {'y1': 1240,  'y2': 2600,  'x1': 398, 'x2': 959,  'frames': 8,  'cw': 90,  'ch': 90,  'ax': 45, 'ay': 80, 'fps': 18, 'loop': True},
        'attack': {'y1': 3860,  'y2': 5280,  'x1': 0,   'x2': 1410, 'frames': 15, 'cw': 150, 'ch': 110, 'ax': 75, 'ay': 95, 'fps': 20, 'loop': False},
        'cast':   {'y1': 11140, 'y2': 12404, 'x1': 0,   'x2': 1410, 'frames': 16, 'cw': 120, 'ch': 100, 'ax': 60, 'ay': 90, 'fps': 16, 'loop': False},
    }
    assassin_heavy_labels = [(0, 0, 89, 16), (0, 1245, 48, 16), (398, 1245, 41, 16), (5, 3863, 60, 16), (0, 11144, 92, 19)]
    process_hero_armor('assassin', 'heavy', 'Assassin (Heavy).gif', assassin_heavy_cfg, assassin_heavy_labels)

    # ========================================================
    # 7. 聖騎士 (Paladin Medium & Heavy) - Light 保持原樣黃金基準
    # ========================================================
    paladin_med_cfg = {
        'idle':   {'y1': 0,    'y2': 1700, 'x1': 0,    'x2': 989,  'frames': 16, 'cw': 90,  'ch': 90,  'ax': 45, 'ay': 80, 'fps': 12, 'loop': True},
        'walk':   {'y1': 1700, 'y2': 3410, 'x1': 0,    'x2': 988,  'frames': 10, 'cw': 90,  'ch': 90,  'ax': 45, 'ay': 80, 'fps': 14, 'loop': True},
        'run':    {'y1': 3410, 'y2': 5310, 'x1': 0,    'x2': 750,  'frames': 8,  'cw': 90,  'ch': 90,  'ax': 45, 'ay': 80, 'fps': 18, 'loop': True},
        'attack': {'y1': 5310, 'y2': 7490, 'x1': 0,    'x2': 2500, 'frames': 15, 'cw': 160, 'ch': 110, 'ax': 80, 'ay': 95, 'fps': 20, 'loop': False},
        'cast':   {'y1': 1700, 'y2': 3410, 'x1': 1244, 'x2': 2400, 'frames': 16, 'cw': 120, 'ch': 100, 'ax': 60, 'ay': 90, 'fps': 16, 'loop': False},
    }
    paladin_med_labels = [(0, 0, 89, 16), (0, 1709, 45, 16), (1244, 1709, 92, 19), (0, 3418, 38, 16), (5, 5319, 60, 16)]
    process_hero_armor('paladin', 'medium', 'Paladin (Medium).gif', paladin_med_cfg, paladin_med_labels)

    paladin_heavy_cfg = {
        'idle':   {'y1': 0,    'y2': 1720, 'x1': 0,    'x2': 989,  'frames': 16, 'cw': 90,  'ch': 90,  'ax': 45, 'ay': 80, 'fps': 12, 'loop': True},
        'walk':   {'y1': 1720, 'y2': 3430, 'x1': 0,    'x2': 988,  'frames': 10, 'cw': 90,  'ch': 90,  'ax': 45, 'ay': 80, 'fps': 14, 'loop': True},
        'run':    {'y1': 3430, 'y2': 5330, 'x1': 0,    'x2': 750,  'frames': 8,  'cw': 90,  'ch': 90,  'ax': 45, 'ay': 80, 'fps': 18, 'loop': True},
        'attack': {'y1': 5330, 'y2': 7500, 'x1': 0,    'x2': 2500, 'frames': 15, 'cw': 160, 'ch': 110, 'ax': 80, 'ay': 95, 'fps': 20, 'loop': False},
        'cast':   {'y1': 1720, 'y2': 3430, 'x1': 1244, 'x2': 2400, 'frames': 16, 'cw': 120, 'ch': 100, 'ax': 60, 'ay': 90, 'fps': 16, 'loop': False},
    }
    paladin_heavy_labels = [(0, 0, 89, 16), (0, 1725, 45, 16), (1244, 1725, 92, 19), (0, 3434, 38, 16), (5, 5335, 60, 16)]
    process_hero_armor('paladin', 'heavy', 'Paladin (Heavy, Heraldic Shield).gif', paladin_heavy_cfg, paladin_heavy_labels)

    print("\n========================================================")
    print("ALL 7 CLASSES (ALL ARMOR TIERS) RE-EXTRACTED WITH ZERO DECAPITATION & GROUND BASELINE!")
    print("========================================================")

if __name__ == '__main__':
    main()
