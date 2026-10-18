"""
Diablo 2 角色動作精靈圖精確島嶼提取器 (Paladin Action Island Exporter v2)
以連通像素島嶼 (Connected Islands) 自動辨識每一幀真實邊界，徹底解決生硬網格導致的揮砍破圖與截肢問題。
"""
import os
import json
from PIL import Image
import numpy as np

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.normpath(os.path.join(SCRIPT_DIR, '..'))
PALADIN_SRC = os.path.join(PROJECT_DIR, 'assets', 'characters', 'paladin', 'spriters', 'paladin_light.gif')
OUT_DIR = os.path.join(PROJECT_DIR, 'web', 'assets', 'characters', 'paladin')
os.makedirs(OUT_DIR, exist_ok=True)

print("Loading paladin_light.gif for pixel-perfect island extraction...")
src_im = Image.open(PALADIN_SRC)
rgb_im = src_im.convert('RGB')
src_arr = np.array(src_im)
rgb_arr = np.array(rgb_im)

# 背景色與透明判定 (index 9, index 0, 白邊)
is_bg = (src_arr == 9) | (src_arr == 0)
is_bg = is_bg | ((rgb_arr[:, :, 0] > 240) & (rgb_arr[:, :, 1] > 240) & (rgb_arr[:, :, 2] > 240))
rgba_full = np.dstack((rgb_arr, np.where(is_bg, 0, 255).astype(np.uint8)))

def extract_action_islands(name, band_y1, band_y2, band_x1, band_x2,
                           num_dirs, expected_frames, cell_w, cell_h, anchor_x, anchor_y,
                           fps=12, loop=True, min_row_h=35):
    print(f"\n--- Extracting action: {name} (expected dirs={num_dirs}, frames={expected_frames}) ---")
    sub_rgba = rgba_full[band_y1:band_y2, band_x1:band_x2]
    mask = (sub_rgba[:, :, 3] > 0)
    row_counts = mask.sum(axis=1)
    
    # 1. 自動檢測 16 方向行
    chunks = []
    start = None
    for y, c in enumerate(row_counts):
        if c > 20 and start is None:
            start = y
        elif c <= 20 and start is not None:
            if y - start >= min_row_h:
                chunks.append((start, y - 1))
            start = None
    if start is not None and len(row_counts) - start >= min_row_h:
        chunks.append((start, len(row_counts) - 1))
        
    # 若有行沾黏，切分最大者
    while len(chunks) < num_dirs:
        max_idx = max(range(len(chunks)), key=lambda i: chunks[i][1] - chunks[i][0])
        cs, ce = chunks[max_idx]
        mid = (cs + ce) // 2
        chunks = chunks[:max_idx] + [(cs, mid), (mid + 1, ce)] + chunks[max_idx+1:]
        
    chunks = chunks[:num_dirs]
    print(f"Detected {len(chunks)} direction rows.")
    
    # 2. 檢測每一行中的島嶼幀
    all_dirs_islands = []
    max_frames_found = 0
    for d_idx, (ry1, ry2) in enumerate(chunks):
        row_mask = mask[ry1:ry2+1, :]
        col_counts = row_mask.sum(axis=0)
        
        islands = []
        s = None
        for x, c in enumerate(col_counts):
            if c > 0 and s is None:
                s = x
            elif c == 0 and s is not None:
                if x - s >= 4: # 排除雜訊
                    islands.append((s, x - 1))
                s = None
        if s is not None and row_mask.shape[1] - s >= 4:
            islands.append((s, row_mask.shape[1] - 1))
            
        all_dirs_islands.append((ry1, ry2, islands))
        if len(islands) > max_frames_found:
            max_frames_found = len(islands)
            
    actual_frames = min(expected_frames, max_frames_found)
    print(f"Action {name}: using {actual_frames} frames per direction (cell size: {cell_w}x{cell_h})")
    
    # 3. 繪製標準網格輸出圖 (無損包含整座島嶼與武器)
    out_w = cell_w * actual_frames
    out_h = cell_h * num_dirs
    out_img = Image.new('RGBA', (out_w, out_h), (0, 0, 0, 0))
    
    for d_idx, (ry1, ry2, islands) in enumerate(all_dirs_islands):
        row_rgba = sub_rgba[ry1:ry2+1, :]
        
        for f_idx in range(min(actual_frames, len(islands))):
            ix1, ix2 = islands[f_idx]
            island_patch = row_rgba[:, ix1:ix2+1]
            alpha = island_patch[:, :, 3]
            
            ys, xs = np.where(alpha > 0)
            if len(ys) == 0:
                continue
                
            char_min_y, char_max_y = ys.min(), ys.max()
            char_min_x, char_max_x = xs.min(), xs.max()
            
            char_crop = island_patch[char_min_y:char_max_y+1, char_min_x:char_max_x+1]
            char_w = char_max_x - char_min_x + 1
            char_h = char_max_y - char_min_y + 1
            
            # 對齊邏輯：腳底接觸點 (最底非透明像素) 對齊 anchor_y
            # 軀幹中心 (或島嶼中心) 對齊 anchor_x
            foot_offset_y = char_h - 1
            body_center_x = char_w // 2
            
            dest_x = (f_idx * cell_w) + (anchor_x - body_center_x)
            dest_y = (d_idx * cell_h) + (anchor_y - foot_offset_y)
            
            patch_pil = Image.fromarray(char_crop, 'RGBA')
            out_img.paste(patch_pil, (int(dest_x), int(dest_y)), patch_pil)
            
    out_path = os.path.join(OUT_DIR, f"paladin_{name}.png")
    out_img.save(out_path, 'PNG', optimize=True)
    print(f"Saved {out_path} ({out_w}x{out_h})")
    
    return {
        "name": name,
        "file": f"paladin_{name}.png",
        "directions": num_dirs,
        "frames": actual_frames,
        "cell_width": cell_w,
        "cell_height": cell_h,
        "anchor_x": anchor_x,
        "anchor_y": anchor_y,
        "fps": fps,
        "loop": loop
    }

def main():
    manifest = {
        "character": "paladin",
        "description": "Diablo II Paladin 16-direction action sprite set (Island Perfect Extraction)",
        "directions_order": [
            "South", "South-Southeast", "Southeast", "East-Southeast",
            "East", "East-Northeast", "Northeast", "North-Northeast",
            "North", "North-Northwest", "Northwest", "West-Northwest",
            "West", "West-Southwest", "Southwest", "South-Southwest"
        ],
        "actions": {}
    }
    
    # 1. Idle (Town Neutral)
    manifest["actions"]["idle"] = extract_action_islands(
        name="idle",
        band_y1=15, band_y2=1260, band_x1=0, band_x2=736,
        num_dirs=16, expected_frames=16,
        cell_w=80, cell_h=90, anchor_x=40, anchor_y=80,
        fps=12, loop=True, min_row_h=35
    )
    
    # 2. Walk
    manifest["actions"]["walk"] = extract_action_islands(
        name="walk",
        band_y1=1516+20, band_y2=3145, band_x1=0, band_x2=840,
        num_dirs=16, expected_frames=10,
        cell_w=80, cell_h=90, anchor_x=40, anchor_y=80,
        fps=14, loop=True, min_row_h=40
    )
    
    # 3. Run
    manifest["actions"]["run"] = extract_action_islands(
        name="run",
        band_y1=3145+20, band_y2=4886, band_x1=0, band_x2=624,
        num_dirs=16, expected_frames=8,
        cell_w=80, cell_h=90, anchor_x=40, anchor_y=80,
        fps=18, loop=True, min_row_h=40
    )
    
    # 4. Attack (揮砍 - 加大單元格至 160x110，給予長劍伸展充分空間，徹底杜絕破圖)
    manifest["actions"]["attack"] = extract_action_islands(
        name="attack",
        band_y1=4899+20, band_y2=6723, band_x1=0, band_x2=2370,
        num_dirs=16, expected_frames=15,
        cell_w=160, cell_h=110, anchor_x=80, anchor_y=95,
        fps=20, loop=False, min_row_h=40
    )
    
    # 5. Cast (施法靈氣)
    manifest["actions"]["cast"] = extract_action_islands(
        name="cast",
        band_y1=1516+20, band_y2=3145, band_x1=1057, band_x2=2290,
        num_dirs=16, expected_frames=16,
        cell_w=110, cell_h=100, anchor_x=55, anchor_y=90,
        fps=16, loop=False, min_row_h=40
    )
    
    # 寫入 JSON
    manifest_path = os.path.join(OUT_DIR, "manifest.json")
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
    print(f"\nManifest written to {manifest_path}")

    # 同步寫入 JS 供 file:// 零跨域載入
    manifest_js_path = os.path.join(OUT_DIR, "manifest.js")
    with open(manifest_js_path, 'w', encoding='utf-8') as f:
        f.write("window.PALADIN_MANIFEST = " + json.dumps(manifest, indent=2, ensure_ascii=False) + ";\n")
    print(f"Manifest JS written to {manifest_js_path}")

if __name__ == '__main__':
    main()
