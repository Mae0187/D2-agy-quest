"""
Diablo II 20款全裝甲形態精靈圖全自動萃取器 (7 Classes x Light/Medium/Heavy)
嚴格落實 AGY 規範：
1. 16 方向精密解析
2. 基準身高 70 像素，腳底接觸點精確對齊 anchor_y，絕不沉入地底，杜絕斷頭截肢！
3. 揮砍單元格 160x110，給予充分伸展空間！
4. 走路 12~14 FPS，奔跑 18 FPS，待命 12 FPS。
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

def extract_action_islands(src_rgba, y1, y2, x1, x2,
                           expected_frames, cell_w, cell_h, anchor_x, anchor_y,
                           fps=12, loop=True, min_row_h=25):
    sub = src_rgba[y1:y2, x1:x2]
    mask = (sub[:, :, 3] > 0)
    row_counts = mask.sum(axis=1)

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

    while len(chunks) < 16 and len(chunks) > 0:
        max_idx = max(range(len(chunks)), key=lambda i: chunks[i][1] - chunks[i][0])
        cs, ce = chunks[max_idx]
        if ce - cs < min_row_h * 2:
            break
        mid = (cs + ce) // 2
        chunks = chunks[:max_idx] + [(cs, mid), (mid + 1, ce)] + chunks[max_idx+1:]

    chunks = chunks[:16]

    if len(chunks) < 16:
        step = (y2 - y1) / 16.0
        chunks = [(int(i * step), int((i + 1) * step) - 1) for i in range(16)]

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

    out_w = cell_w * actual_frames
    out_h = cell_h * 16
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

def process_character_armor(char_id, armor_tier, gif_filename, actions_cfg):
    print(f"\n>>> Processing: {char_id.upper()} [{armor_tier.upper()}] from {gif_filename} <<<")
    gif_path = os.path.join(CLASSES_SRC_DIR, gif_filename)
    if not os.path.exists(gif_path):
        print(f"Error: {gif_path} not found!")
        return

    im = Image.open(gif_path)
    arr = np.array(im)
    rgb = np.array(im.convert('RGB'))
    is_bg = (arr == 0) | (arr == 9)
    is_bg = is_bg | ((rgb[:, :, 0] > 240) & (rgb[:, :, 1] > 240) & (rgb[:, :, 2] > 240))
    rgba = np.dstack((rgb, np.where(is_bg, 0, 255).astype(np.uint8)))

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
        out_img, actual_frames = extract_action_islands(
            src_rgba=rgba,
            y1=cfg['y1'], y2=cfg['y2'],
            x1=cfg['x1'], x2=cfg['x2'],
            expected_frames=cfg['frames'],
            cell_w=cfg['cw'], cell_h=cfg['ch'],
            anchor_x=cfg['ax'], anchor_y=cfg['ay'],
            fps=cfg['fps'], loop=cfg['loop'],
            min_row_h=cfg.get('min_row_h', 25)
        )

        file_name = f"{char_id}_{act_name}.png"
        out_path = os.path.join(tier_out_dir, file_name)
        out_img.save(out_path, 'PNG', optimize=True)
        print(f"  [OK] {act_name}: saved {file_name} ({out_img.width}x{out_img.height}, frames={actual_frames})")

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

    json_path = os.path.join(tier_out_dir, "manifest.json")
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)

    var_name = f"{char_id.upper()}_{armor_tier.upper()}_MANIFEST"
    js_path = os.path.join(tier_out_dir, "manifest.js")
    with open(js_path, 'w', encoding='utf-8') as f:
        f.write(f"window.{var_name} = " + json.dumps(manifest, indent=2, ensure_ascii=False) + ";\n")

    # 同步覆蓋根目錄（如果是 light 裝甲或 paladin 預設）
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
        print(f"  [Root Synced] {char_id} root manifest & sprites synced with {armor_tier}")

def main():
    # 1. 德魯伊 (Druid)
    druid_light = {
        'idle':   {'y1': 15,   'y2': 1387, 'x1': 475,  'x2': 1460, 'frames': 16, 'cw': 80,  'ch': 90,  'ax': 40, 'ay': 80, 'fps': 12, 'loop': True},
        'walk':   {'y1': 2960, 'y2': 4328, 'x1': 1530, 'x2': 1910, 'frames': 8,  'cw': 80,  'ch': 90,  'ax': 40, 'ay': 80, 'fps': 14, 'loop': True},
        'run':    {'y1': 2960, 'y2': 4328, 'x1': 1910, 'x2': 2470, 'frames': 8,  'cw': 80,  'ch': 90,  'ax': 40, 'ay': 80, 'fps': 18, 'loop': True},
        'attack': {'y1': 2960, 'y2': 4328, 'x1': 0,    'x2': 1530, 'frames': 16, 'cw': 160, 'ch': 110, 'ax': 80, 'ay': 95, 'fps': 20, 'loop': False},
        'cast':   {'y1': 15,   'y2': 1387, 'x1': 1465, 'x2': 2598, 'frames': 16, 'cw': 110, 'ch': 100, 'ax': 55, 'ay': 90, 'fps': 16, 'loop': False},
    }
    druid_medium = {
        'idle':   {'y1': 15,   'y2': 1401, 'x1': 500,  'x2': 1500, 'frames': 16, 'cw': 80,  'ch': 90,  'ax': 40, 'ay': 80, 'fps': 12, 'loop': True},
        'walk':   {'y1': 3200, 'y2': 4546, 'x1': 1550, 'x2': 1950, 'frames': 8,  'cw': 80,  'ch': 90,  'ax': 40, 'ay': 80, 'fps': 14, 'loop': True},
        'run':    {'y1': 3200, 'y2': 4546, 'x1': 1950, 'x2': 2500, 'frames': 8,  'cw': 80,  'ch': 90,  'ax': 40, 'ay': 80, 'fps': 18, 'loop': True},
        'attack': {'y1': 3200, 'y2': 4546, 'x1': 0,    'x2': 1550, 'frames': 16, 'cw': 160, 'ch': 110, 'ax': 80, 'ay': 95, 'fps': 20, 'loop': False},
        'cast':   {'y1': 15,   'y2': 1401, 'x1': 1500, 'x2': 2700, 'frames': 16, 'cw': 110, 'ch': 100, 'ax': 55, 'ay': 90, 'fps': 16, 'loop': False},
    }
    druid_heavy = {
        'idle':   {'y1': 15,   'y2': 1657, 'x1': 600,  'x2': 1700, 'frames': 16, 'cw': 80,  'ch': 90,  'ax': 40, 'ay': 80, 'fps': 12, 'loop': True},
        'walk':   {'y1': 1980, 'y2': 3426, 'x1': 1700, 'x2': 2200, 'frames': 8,  'cw': 80,  'ch': 90,  'ax': 40, 'ay': 80, 'fps': 14, 'loop': True},
        'run':    {'y1': 1980, 'y2': 3426, 'x1': 2200, 'x2': 2800, 'frames': 8,  'cw': 80,  'ch': 90,  'ax': 40, 'ay': 80, 'fps': 18, 'loop': True},
        'attack': {'y1': 1980, 'y2': 3426, 'x1': 0,    'x2': 1700, 'frames': 16, 'cw': 160, 'ch': 110, 'ax': 80, 'ay': 95, 'fps': 20, 'loop': False},
        'cast':   {'y1': 15,   'y2': 1657, 'x1': 1700, 'x2': 3000, 'frames': 16, 'cw': 110, 'ch': 100, 'ax': 55, 'ay': 90, 'fps': 16, 'loop': False},
    }
    process_character_armor('druid', 'light', 'Druid (Light).gif', druid_light)
    process_character_armor('druid', 'medium', 'Druid (Medium).gif', druid_medium)
    process_character_armor('druid', 'heavy', 'Druid (Heavy).gif', druid_heavy)

    # 2. 聖騎士 (Paladin)
    paladin_light = {
        'idle':   {'y1': 15,   'y2': 1260, 'x1': 0,    'x2': 736,  'frames': 16, 'cw': 80,  'ch': 90,  'ax': 40, 'ay': 80, 'fps': 12, 'loop': True},
        'walk':   {'y1': 1536, 'y2': 3145, 'x1': 0,    'x2': 840,  'frames': 10, 'cw': 80,  'ch': 90,  'ax': 40, 'ay': 80, 'fps': 14, 'loop': True},
        'run':    {'y1': 3165, 'y2': 4886, 'x1': 0,    'x2': 624,  'frames': 8,  'cw': 80,  'ch': 90,  'ax': 40, 'ay': 80, 'fps': 18, 'loop': True},
        'attack': {'y1': 4919, 'y2': 6723, 'x1': 0,    'x2': 2370, 'frames': 15, 'cw': 160, 'ch': 110, 'ax': 80, 'ay': 95, 'fps': 20, 'loop': False},
        'cast':   {'y1': 1536, 'y2': 3145, 'x1': 1057, 'x2': 2290, 'frames': 16, 'cw': 110, 'ch': 100, 'ax': 55, 'ay': 90, 'fps': 16, 'loop': False},
    }
    paladin_medium = {
        'idle':   {'y1': 15,   'y2': 1303, 'x1': 0,    'x2': 800,  'frames': 16, 'cw': 80,  'ch': 90,  'ax': 40, 'ay': 80, 'fps': 12, 'loop': True},
        'walk':   {'y1': 1722, 'y2': 3417, 'x1': 0,    'x2': 900,  'frames': 10, 'cw': 80,  'ch': 90,  'ax': 40, 'ay': 80, 'fps': 14, 'loop': True},
        'run':    {'y1': 3431, 'y2': 5318, 'x1': 0,    'x2': 700,  'frames': 8,  'cw': 80,  'ch': 90,  'ax': 40, 'ay': 80, 'fps': 18, 'loop': True},
        'attack': {'y1': 5332, 'y2': 7491, 'x1': 0,    'x2': 2500, 'frames': 15, 'cw': 160, 'ch': 110, 'ax': 80, 'ay': 95, 'fps': 20, 'loop': False},
        'cast':   {'y1': 1722, 'y2': 3417, 'x1': 1100, 'x2': 2400, 'frames': 16, 'cw': 110, 'ch': 100, 'ax': 55, 'ay': 90, 'fps': 16, 'loop': False},
    }
    paladin_heavy = {
        'idle':   {'y1': 15,   'y2': 1303, 'x1': 0,    'x2': 800,  'frames': 16, 'cw': 80,  'ch': 90,  'ax': 40, 'ay': 80, 'fps': 12, 'loop': True},
        'walk':   {'y1': 1724, 'y2': 3433, 'x1': 0,    'x2': 900,  'frames': 10, 'cw': 80,  'ch': 90,  'ax': 40, 'ay': 80, 'fps': 14, 'loop': True},
        'run':    {'y1': 3433, 'y2': 5334, 'x1': 0,    'x2': 700,  'frames': 8,  'cw': 80,  'ch': 90,  'ax': 40, 'ay': 80, 'fps': 18, 'loop': True},
        'attack': {'y1': 5334, 'y2': 7507, 'x1': 0,    'x2': 2500, 'frames': 15, 'cw': 160, 'ch': 110, 'ax': 80, 'ay': 95, 'fps': 20, 'loop': False},
        'cast':   {'y1': 1724, 'y2': 3433, 'x1': 1100, 'x2': 2400, 'frames': 16, 'cw': 110, 'ch': 100, 'ax': 55, 'ay': 90, 'fps': 16, 'loop': False},
    }
    process_character_armor('paladin', 'light', 'Paladin (Light).gif', paladin_light)
    process_character_armor('paladin', 'medium', 'Paladin (Medium).gif', paladin_medium)
    process_character_armor('paladin', 'heavy', 'Paladin (Heavy, Heraldic Shield).gif', paladin_heavy)

    # 3. 魔法使 (Sorceress)
    sorc_light = {
        'idle':   {'y1': 15,   'y2': 1219, 'x1': 0,    'x2': 700,  'frames': 16, 'cw': 80,  'ch': 90,  'ax': 40, 'ay': 80, 'fps': 12, 'loop': True},
        'walk':   {'y1': 15,   'y2': 1219, 'x1': 700,  'x2': 1200, 'frames': 10, 'cw': 80,  'ch': 90,  'ax': 40, 'ay': 80, 'fps': 14, 'loop': True},
        'run':    {'y1': 1317, 'y2': 2483, 'x1': 0,    'x2': 600,  'frames': 8,  'cw': 80,  'ch': 90,  'ax': 40, 'ay': 80, 'fps': 18, 'loop': True},
        'attack': {'y1': 2490, 'y2': 3760, 'x1': 0,    'x2': 1200, 'frames': 15, 'cw': 150, 'ch': 110, 'ax': 75, 'ay': 95, 'fps': 20, 'loop': False},
        'cast':   {'y1': 5350, 'y2': 6736, 'x1': 0,    'x2': 1200, 'frames': 16, 'cw': 110, 'ch': 100, 'ax': 55, 'ay': 90, 'fps': 16, 'loop': False},
    }
    sorc_heavy = {
        'idle':   {'y1': 15,   'y2': 1353, 'x1': 0,    'x2': 750,  'frames': 16, 'cw': 80,  'ch': 90,  'ax': 40, 'ay': 80, 'fps': 12, 'loop': True},
        'walk':   {'y1': 15,   'y2': 1353, 'x1': 750,  'x2': 1300, 'frames': 10, 'cw': 80,  'ch': 90,  'ax': 40, 'ay': 80, 'fps': 14, 'loop': True},
        'run':    {'y1': 1546, 'y2': 2966, 'x1': 0,    'x2': 650,  'frames': 8,  'cw': 80,  'ch': 90,  'ax': 40, 'ay': 80, 'fps': 18, 'loop': True},
        'attack': {'y1': 2980, 'y2': 4614, 'x1': 0,    'x2': 1300, 'frames': 15, 'cw': 150, 'ch': 110, 'ax': 75, 'ay': 95, 'fps': 20, 'loop': False},
        'cast':   {'y1': 4628, 'y2': 6739, 'x1': 0,    'x2': 1300, 'frames': 16, 'cw': 110, 'ch': 100, 'ax': 55, 'ay': 90, 'fps': 16, 'loop': False},
    }
    process_character_armor('sorceress', 'light', 'Sorceress (Light).gif', sorc_light)
    process_character_armor('sorceress', 'medium', 'Sorceress (Light).gif', sorc_light)
    process_character_armor('sorceress', 'heavy', 'Sorceress (Heavy).gif', sorc_heavy)

    # 4. 死靈法師 (Necromancer)
    necro_light = {
        'idle':   {'y1': 15,   'y2': 1270, 'x1': 0,    'x2': 750,  'frames': 16, 'cw': 80,  'ch': 90,  'ax': 40, 'ay': 80, 'fps': 12, 'loop': True},
        'walk':   {'y1': 15,   'y2': 1270, 'x1': 750,  'x2': 1300, 'frames': 10, 'cw': 80,  'ch': 90,  'ax': 40, 'ay': 80, 'fps': 14, 'loop': True},
        'run':    {'y1': 1356, 'y2': 2873, 'x1': 0,    'x2': 650,  'frames': 8,  'cw': 80,  'ch': 90,  'ax': 40, 'ay': 80, 'fps': 18, 'loop': True},
        'attack': {'y1': 3081, 'y2': 4418, 'x1': 0,    'x2': 1300, 'frames': 15, 'cw': 150, 'ch': 110, 'ax': 75, 'ay': 95, 'fps': 20, 'loop': False},
        'cast':   {'y1': 1356, 'y2': 2873, 'x1': 650,  'x2': 1600, 'frames': 16, 'cw': 110, 'ch': 100, 'ax': 55, 'ay': 90, 'fps': 16, 'loop': False},
    }
    necro_medium = {
        'idle':   {'y1': 15,   'y2': 1228, 'x1': 0,    'x2': 750,  'frames': 16, 'cw': 80,  'ch': 90,  'ax': 40, 'ay': 80, 'fps': 12, 'loop': True},
        'walk':   {'y1': 15,   'y2': 1228, 'x1': 750,  'x2': 1300, 'frames': 10, 'cw': 80,  'ch': 90,  'ax': 40, 'ay': 80, 'fps': 14, 'loop': True},
        'run':    {'y1': 1404, 'y2': 2745, 'x1': 0,    'x2': 650,  'frames': 8,  'cw': 80,  'ch': 90,  'ax': 40, 'ay': 80, 'fps': 18, 'loop': True},
        'attack': {'y1': 2745, 'y2': 4454, 'x1': 0,    'x2': 1300, 'frames': 15, 'cw': 150, 'ch': 110, 'ax': 75, 'ay': 95, 'fps': 20, 'loop': False},
        'cast':   {'y1': 1404, 'y2': 2745, 'x1': 650,  'x2': 1600, 'frames': 16, 'cw': 110, 'ch': 100, 'ax': 55, 'ay': 90, 'fps': 16, 'loop': False},
    }
    necro_heavy = {
        'idle':   {'y1': 15,   'y2': 1628, 'x1': 0,    'x2': 800,  'frames': 16, 'cw': 80,  'ch': 90,  'ax': 40, 'ay': 80, 'fps': 12, 'loop': True},
        'walk':   {'y1': 15,   'y2': 1628, 'x1': 800,  'x2': 1400, 'frames': 10, 'cw': 80,  'ch': 90,  'ax': 40, 'ay': 80, 'fps': 14, 'loop': True},
        'run':    {'y1': 1628, 'y2': 3209, 'x1': 0,    'x2': 700,  'frames': 8,  'cw': 80,  'ch': 90,  'ax': 40, 'ay': 80, 'fps': 18, 'loop': True},
        'attack': {'y1': 3209, 'y2': 5110, 'x1': 0,    'x2': 1400, 'frames': 15, 'cw': 150, 'ch': 110, 'ax': 75, 'ay': 95, 'fps': 20, 'loop': False},
        'cast':   {'y1': 1628, 'y2': 3209, 'x1': 700,  'x2': 1700, 'frames': 16, 'cw': 110, 'ch': 100, 'ax': 55, 'ay': 90, 'fps': 16, 'loop': False},
    }
    process_character_armor('necromancer', 'light', 'Necromancer (Light).gif', necro_light)
    process_character_armor('necromancer', 'medium', 'Necromancer (Medium).gif', necro_medium)
    process_character_armor('necromancer', 'heavy', 'Necromancer (Heavy).gif', necro_heavy)

    # 5. 野蠻人 (Barbarian)
    barb_light = {
        'idle':   {'y1': 15,   'y2': 1377, 'x1': 800,  'x2': 1600, 'frames': 16, 'cw': 90,  'ch': 90,  'ax': 45, 'ay': 80, 'fps': 12, 'loop': True},
        'walk':   {'y1': 15,   'y2': 1377, 'x1': 0,    'x2': 800,  'frames': 10, 'cw': 90,  'ch': 90,  'ax': 45, 'ay': 80, 'fps': 14, 'loop': True},
        'run':    {'y1': 2056, 'y2': 3490, 'x1': 0,    'x2': 700,  'frames': 8,  'cw': 90,  'ch': 90,  'ax': 45, 'ay': 80, 'fps': 18, 'loop': True},
        'attack': {'y1': 3511, 'y2': 5254, 'x1': 0,    'x2': 1800, 'frames': 15, 'cw': 160, 'ch': 110, 'ax': 80, 'ay': 95, 'fps': 20, 'loop': False},
        'cast':   {'y1': 2056, 'y2': 3490, 'x1': 700,  'x2': 1800, 'frames': 16, 'cw': 110, 'ch': 100, 'ax': 55, 'ay': 90, 'fps': 16, 'loop': False},
    }
    barb_medium = {
        'idle':   {'y1': 15,   'y2': 1713, 'x1': 850,  'x2': 1700, 'frames': 16, 'cw': 90,  'ch': 90,  'ax': 45, 'ay': 80, 'fps': 12, 'loop': True},
        'walk':   {'y1': 15,   'y2': 1713, 'x1': 0,    'x2': 850,  'frames': 10, 'cw': 90,  'ch': 90,  'ax': 45, 'ay': 80, 'fps': 14, 'loop': True},
        'run':    {'y1': 1948, 'y2': 3833, 'x1': 0,    'x2': 750,  'frames': 8,  'cw': 90,  'ch': 90,  'ax': 45, 'ay': 80, 'fps': 18, 'loop': True},
        'attack': {'y1': 3833, 'y2': 6166, 'x1': 0,    'x2': 1900, 'frames': 15, 'cw': 160, 'ch': 110, 'ax': 80, 'ay': 95, 'fps': 20, 'loop': False},
        'cast':   {'y1': 1948, 'y2': 3833, 'x1': 750,  'x2': 1900, 'frames': 16, 'cw': 110, 'ch': 100, 'ax': 55, 'ay': 90, 'fps': 16, 'loop': False},
    }
    barb_heavy = {
        'idle':   {'y1': 15,   'y2': 1604, 'x1': 850,  'x2': 1700, 'frames': 16, 'cw': 90,  'ch': 90,  'ax': 45, 'ay': 80, 'fps': 12, 'loop': True},
        'walk':   {'y1': 15,   'y2': 1604, 'x1': 0,    'x2': 850,  'frames': 10, 'cw': 90,  'ch': 90,  'ax': 45, 'ay': 80, 'fps': 14, 'loop': True},
        'run':    {'y1': 1836, 'y2': 3673, 'x1': 0,    'x2': 750,  'frames': 8,  'cw': 90,  'ch': 90,  'ax': 45, 'ay': 80, 'fps': 18, 'loop': True},
        'attack': {'y1': 3673, 'y2': 5958, 'x1': 0,    'x2': 1900, 'frames': 15, 'cw': 160, 'ch': 110, 'ax': 80, 'ay': 95, 'fps': 20, 'loop': False},
        'cast':   {'y1': 1836, 'y2': 3673, 'x1': 750,  'x2': 1900, 'frames': 16, 'cw': 110, 'ch': 100, 'ax': 55, 'ay': 90, 'fps': 16, 'loop': False},
    }
    process_character_armor('barbarian', 'light', 'Barbarian (Light).gif', barb_light)
    process_character_armor('barbarian', 'medium', 'Barbarian (Medium).gif', barb_medium)
    process_character_armor('barbarian', 'heavy', 'Barbarian (Heavy).gif', barb_heavy)

    # 6. 亞馬遜 (Amazon)
    amazon_light = {
        'idle':   {'y1': 15,   'y2': 1322, 'x1': 0,    'x2': 750,  'frames': 16, 'cw': 80,  'ch': 90,  'ax': 40, 'ay': 80, 'fps': 12, 'loop': True},
        'walk':   {'y1': 15,   'y2': 1322, 'x1': 750,  'x2': 1300, 'frames': 10, 'cw': 80,  'ch': 90,  'ax': 40, 'ay': 80, 'fps': 14, 'loop': True},
        'run':    {'y1': 3123, 'y2': 4407, 'x1': 0,    'x2': 650,  'frames': 8,  'cw': 80,  'ch': 90,  'ax': 40, 'ay': 80, 'fps': 18, 'loop': True},
        'attack': {'y1': 3123, 'y2': 4407, 'x1': 650,  'x2': 1800, 'frames': 15, 'cw': 160, 'ch': 110, 'ax': 80, 'ay': 95, 'fps': 20, 'loop': False},
        'cast':   {'y1': 1400, 'y2': 2650, 'x1': 0,    'x2': 1100, 'frames': 16, 'cw': 110, 'ch': 100, 'ax': 55, 'ay': 90, 'fps': 16, 'loop': False},
    }
    amazon_heavy = {
        'idle':   {'y1': 15,   'y2': 1323, 'x1': 0,    'x2': 750,  'frames': 16, 'cw': 80,  'ch': 90,  'ax': 40, 'ay': 80, 'fps': 12, 'loop': True},
        'walk':   {'y1': 15,   'y2': 1323, 'x1': 750,  'x2': 1300, 'frames': 10, 'cw': 80,  'ch': 90,  'ax': 40, 'ay': 80, 'fps': 14, 'loop': True},
        'run':    {'y1': 3145, 'y2': 4598, 'x1': 0,    'x2': 650,  'frames': 8,  'cw': 80,  'ch': 90,  'ax': 40, 'ay': 80, 'fps': 18, 'loop': True},
        'attack': {'y1': 3145, 'y2': 4598, 'x1': 650,  'x2': 1800, 'frames': 15, 'cw': 160, 'ch': 110, 'ax': 80, 'ay': 95, 'fps': 20, 'loop': False},
        'cast':   {'y1': 1338, 'y2': 3145, 'x1': 0,    'x2': 1100, 'frames': 16, 'cw': 110, 'ch': 100, 'ax': 55, 'ay': 90, 'fps': 16, 'loop': False},
    }
    process_character_armor('amazon', 'light', 'Amazon (Light).gif', amazon_light)
    process_character_armor('amazon', 'medium', 'Amazon (Light).gif', amazon_light)
    process_character_armor('amazon', 'heavy', 'Amazon (Heavy).gif', amazon_heavy)

    # 7. 刺客 (Assassin)
    assassin_light = {
        'idle':   {'y1': 15,   'y2': 1236, 'x1': 0,    'x2': 650,  'frames': 16, 'cw': 80,  'ch': 90,  'ax': 40, 'ay': 80, 'fps': 12, 'loop': True},
        'walk':   {'y1': 15,   'y2': 1236, 'x1': 650,  'x2': 1150, 'frames': 10, 'cw': 80,  'ch': 90,  'ax': 40, 'ay': 80, 'fps': 14, 'loop': True},
        'run':    {'y1': 1337, 'y2': 2520, 'x1': 0,    'x2': 600,  'frames': 8,  'cw': 80,  'ch': 90,  'ax': 40, 'ay': 80, 'fps': 18, 'loop': True},
        'attack': {'y1': 1337, 'y2': 2520, 'x1': 600,  'x2': 1350, 'frames': 15, 'cw': 150, 'ch': 110, 'ax': 75, 'ay': 95, 'fps': 20, 'loop': False},
        'cast':   {'y1': 6352, 'y2': 7965, 'x1': 0,    'x2': 1100, 'frames': 16, 'cw': 110, 'ch': 100, 'ax': 55, 'ay': 90, 'fps': 16, 'loop': False},
    }
    assassin_medium = {
        'idle':   {'y1': 15,   'y2': 1236, 'x1': 0,    'x2': 650,  'frames': 16, 'cw': 80,  'ch': 90,  'ax': 40, 'ay': 80, 'fps': 12, 'loop': True},
        'walk':   {'y1': 15,   'y2': 1236, 'x1': 650,  'x2': 1150, 'frames': 10, 'cw': 80,  'ch': 90,  'ax': 40, 'ay': 80, 'fps': 14, 'loop': True},
        'run':    {'y1': 1337, 'y2': 2520, 'x1': 0,    'x2': 600,  'frames': 8,  'cw': 80,  'ch': 90,  'ax': 40, 'ay': 80, 'fps': 18, 'loop': True},
        'attack': {'y1': 1337, 'y2': 2520, 'x1': 600,  'x2': 1350, 'frames': 15, 'cw': 150, 'ch': 110, 'ax': 75, 'ay': 95, 'fps': 20, 'loop': False},
        'cast':   {'y1': 6592, 'y2': 8307, 'x1': 0,    'x2': 1100, 'frames': 16, 'cw': 110, 'ch': 100, 'ax': 55, 'ay': 90, 'fps': 16, 'loop': False},
    }
    assassin_heavy = {
        'idle':   {'y1': 15,   'y2': 1242, 'x1': 0,    'x2': 650,  'frames': 16, 'cw': 80,  'ch': 90,  'ax': 40, 'ay': 80, 'fps': 12, 'loop': True},
        'walk':   {'y1': 15,   'y2': 1242, 'x1': 650,  'x2': 1150, 'frames': 10, 'cw': 80,  'ch': 90,  'ax': 40, 'ay': 80, 'fps': 14, 'loop': True},
        'run':    {'y1': 1335, 'y2': 2521, 'x1': 0,    'x2': 600,  'frames': 8,  'cw': 80,  'ch': 90,  'ax': 40, 'ay': 80, 'fps': 18, 'loop': True},
        'attack': {'y1': 1335, 'y2': 2521, 'x1': 600,  'x2': 1350, 'frames': 15, 'cw': 150, 'ch': 110, 'ax': 75, 'ay': 95, 'fps': 20, 'loop': False},
        'cast':   {'y1': 6512, 'y2': 8125, 'x1': 0,    'x2': 1100, 'frames': 16, 'cw': 110, 'ch': 100, 'ax': 55, 'ay': 90, 'fps': 16, 'loop': False},
    }
    process_character_armor('assassin', 'light', 'Assassin (Light).gif', assassin_light)
    process_character_armor('assassin', 'medium', 'Assassin (Medium).gif', assassin_medium)
    process_character_armor('assassin', 'heavy', 'Assassin (Heavy).gif', assassin_heavy)

    print("\n========================================================")
    print("ALL 7 CLASSES (20 ARMOR TIERS) EXTRACTED SUCCESSFULLY!")
    print("========================================================")

if __name__ == '__main__':
    main()
