"""
Diablo 2 角色動作精靈圖提取與標準化工具 (Paladin Action Exporter)
將社群 Sprite Sheet (paladin_light.gif) 自動解析、去背、錨點對齊，
並導出為 16 方向乾淨的透明 PNG 網格圖及 manifest.json。
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

print("Loading paladin_light.gif...")
src_im = Image.open(PALADIN_SRC)
rgb_im = src_im.convert('RGB')
src_arr = np.array(src_im)
rgb_arr = np.array(rgb_im)

# Palette index 9 = (170, 170, 170), index 0 = (244, 244, 244)
is_bg = (src_arr == 9) | (src_arr == 0)
# Also check light border colors
is_bg = is_bg | ((rgb_arr[:, :, 0] > 240) & (rgb_arr[:, :, 1] > 240) & (rgb_arr[:, :, 2] > 240))

# Create RGBA
rgba_full = np.dstack((rgb_arr, np.where(is_bg, 0, 255).astype(np.uint8)))

def extract_action_sheet(name, band_y1, band_y2, band_x1, band_x2,
                         num_dirs, num_frames, cell_w, cell_h, anchor_x, anchor_y,
                         grid_step_x, row_height_approx, fps=12, loop=True):
    print(f"Extracting action: {name} (dirs={num_dirs}, frames={num_frames}, cell={cell_w}x{cell_h})...")
    
    sub_rgba = rgba_full[band_y1:band_y2, band_x1:band_x2]
    sub_src = src_arr[band_y1:band_y2, band_x1:band_x2]
    
    # Identify non-transparent rows
    has_px = (sub_src != 9) & (sub_src != 0)
    counts = has_px.sum(axis=1)
    
    # Find row chunks
    chunks = []
    start = None
    for y, c in enumerate(counts):
        if c > 15 and start is None:
            start = y
        elif c <= 15 and start is not None:
            if y - start >= 30:
                chunks.append((start, y - 1))
            start = None
    if start is not None and len(counts) - start >= 30:
        chunks.append((start, len(counts) - 1))
        
    # If chunks count is less than num_dirs due to merged row, split the biggest
    while len(chunks) < num_dirs:
        # find the chunk with largest height
        max_idx = max(range(len(chunks)), key=lambda i: chunks[i][1] - chunks[i][0])
        cs, ce = chunks[max_idx]
        mid = (cs + ce) // 2
        chunks = chunks[:max_idx] + [(cs, mid), (mid + 1, ce)] + chunks[max_idx+1:]
        
    # Limit to num_dirs
    chunks = chunks[:num_dirs]
    
    # Create output sheet image
    out_w = cell_w * num_frames
    out_h = cell_h * num_dirs
    out_img = Image.new('RGBA', (out_w, out_h), (0, 0, 0, 0))
    
    for d_idx, (ry1, ry2) in enumerate(chunks):
        row_rgba = sub_rgba[ry1:ry2+1, :]
        row_src = sub_src[ry1:ry2+1, :]
        
        for f_idx in range(num_frames):
            # approximate x bounding box
            fx1 = f_idx * grid_step_x
            fx2 = min((f_idx + 1) * grid_step_x, sub_rgba.shape[1])
            
            frame_patch = row_rgba[:, fx1:fx2]
            alpha_patch = frame_patch[:, :, 3]
            
            # find actual pixel bounds in this frame patch
            ys, xs = np.where(alpha_patch > 0)
            if len(ys) == 0 or len(xs) == 0:
                continue
                
            min_x, max_x = xs.min(), xs.max()
            min_y, max_y = ys.min(), ys.max()
            
            char_crop = frame_patch[min_y:max_y+1, min_x:max_x+1]
            char_w = max_x - min_x + 1
            char_h = max_y - min_y + 1
            
            # Anchor foot: bottom center of the bounding box
            foot_local_x = char_w // 2
            foot_local_y = char_h - 1
            
            dest_x = d_idx * 0 + (f_idx * cell_w) + (anchor_x - foot_local_x)
            dest_y = (d_idx * cell_h) + (anchor_y - foot_local_y)
            
            # Paste into out_img
            patch_pil = Image.fromarray(char_crop, 'RGBA')
            out_img.paste(patch_pil, (int(dest_x), int(dest_y)), patch_pil)
            
    out_path = os.path.join(OUT_DIR, f"paladin_{name}.png")
    out_img.save(out_path, 'PNG', optimize=True)
    print(f"Saved {out_path} ({out_w}x{out_h})")
    
    return {
        "name": name,
        "file": f"paladin_{name}.png",
        "directions": num_dirs,
        "frames": num_frames,
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
        "description": "Diablo II Paladin 16-direction action sprite set",
        "directions_order": [
            "South", "South-Southeast", "Southeast", "East-Southeast",
            "East", "East-Northeast", "Northeast", "North-Northeast",
            "North", "North-Northwest", "Northwest", "West-Northwest",
            "West", "West-Southwest", "Southwest", "South-Southwest"
        ],
        "actions": {}
    }
    
    # 1. Idle (Town Neutral)
    manifest["actions"]["idle"] = extract_action_sheet(
        name="idle",
        band_y1=15, band_y2=1260, band_x1=0, band_x2=736,
        num_dirs=16, num_frames=16, cell_w=64, cell_h=80,
        anchor_x=32, anchor_y=72, grid_step_x=46, row_height_approx=74,
        fps=12, loop=True
    )
    
    # 2. Walk
    manifest["actions"]["walk"] = extract_action_sheet(
        name="walk",
        band_y1=1516+20, band_y2=3145, band_x1=0, band_x2=840,
        num_dirs=16, num_frames=10, cell_w=64, cell_h=80,
        anchor_x=32, anchor_y=72, grid_step_x=84, row_height_approx=88,
        fps=14, loop=True
    )
    
    # 3. Run
    manifest["actions"]["run"] = extract_action_sheet(
        name="run",
        band_y1=3145+20, band_y2=4886, band_x1=0, band_x2=624,
        num_dirs=16, num_frames=8, cell_w=64, cell_h=80,
        anchor_x=32, anchor_y=72, grid_step_x=78, row_height_approx=90,
        fps=18, loop=True
    )
    
    # 4. Attack (Attack 1)
    manifest["actions"]["attack"] = extract_action_sheet(
        name="attack",
        band_y1=4899+20, band_y2=6723, band_x1=0, band_x2=2370,
        num_dirs=16, num_frames=16, cell_w=128, cell_h=96,
        anchor_x=64, anchor_y=84, grid_step_x=148, row_height_approx=100,
        fps=20, loop=False
    )
    
    # 5. Cast (Special Cast)
    manifest["actions"]["cast"] = extract_action_sheet(
        name="cast",
        band_y1=1516+20, band_y2=3145, band_x1=1057, band_x2=2290,
        num_dirs=16, num_frames=16, cell_w=96, cell_h=96,
        anchor_x=48, anchor_y=84, grid_step_x=77, row_height_approx=88,
        fps=16, loop=False
    )
    
    manifest_path = os.path.join(OUT_DIR, "manifest.json")
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
    print(f"Manifest written to {manifest_path}")

if __name__ == '__main__':
    main()
