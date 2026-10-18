#!/usr/bin/env python3
"""
clean_barbarian_all_tiers.py
使用 8 連通分量分析 (Connected Component Analysis) 精確過濾野蠻人各裝甲形態 (light, medium, heavy)
中由 Spriters Resource Contact Sheet 切片造成的底層浮動大劍殘影 (Rogue Blade Fragments)。
嚴格保護主角本體，只抹除位於 cell 底部且與主角肉身完全分離的孤立碎片。
"""
import os, sys, json, shutil
from pathlib import Path
from PIL import Image
import numpy as np
from scipy.ndimage import label

SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
WEB_CHAR_DIR = PROJECT_DIR / 'web/assets/characters/barbarian'

def clean_action_file(img_path, cw, ch, dirs, frames):
    img = Image.open(img_path).convert('RGBA')
    arr = np.array(img)
    removed_total = 0
    
    for d in range(dirs):
        for fr in range(frames):
            cell = arr[d*ch:(d+1)*ch, fr*cw:(fr+1)*cw]
            alpha = cell[:, :, 3] > 0
            if not np.any(alpha): continue
            
            lbl, num = label(alpha, structure=np.ones((3,3)))
            if num <= 1: continue
            
            sizes = [(lbl == i).sum() for i in range(1, num+1)]
            max_comp = np.argmax(sizes) + 1
            
            for i in range(1, num+1):
                if i != max_comp:
                    ys, xs = np.where(lbl == i)
                    # 判斷標準：位於 cell 下半部 (ys.mean() > ch * 0.55) 且為孤立組件 (size < 250)
                    if ys.mean() > ch * 0.55 and len(ys) < 250:
                        cell[ys, xs, :] = 0 # 抹除為純透明
                        removed_total += len(ys)
                        
    if removed_total > 0:
        cleaned_img = Image.fromarray(arr, 'RGBA')
        cleaned_img.save(img_path, 'PNG', optimize=True)
    return removed_total

def main():
    print("=== Cleaning Rogue Blade Fragments from Barbarian Sheets ===")
    for tier in ['light', 'medium', 'heavy']:
        tier_dir = WEB_CHAR_DIR / tier
        mf_path = tier_dir / 'manifest.json'
        if not mf_path.exists(): continue
        
        with open(mf_path, 'r', encoding='utf-8') as f:
            mf = json.load(f)
            
        print(f"\n--- Processing Barbarian [{tier}] ---")
        for act_name, act_data in mf['actions'].items():
            img_file = tier_dir / act_data['file']
            if not img_file.exists(): continue
            
            cw = act_data['cell_width']
            ch = act_data['cell_height']
            dirs = act_data['directions']
            frames = act_data['frames']
            
            removed = clean_action_file(img_file, cw, ch, dirs, frames)
            print(f"  {act_name:<8}: removed {removed} rogue blade pixels from {img_file.name}")
            
            # 若為 light，同步至根目錄
            if tier == 'light':
                root_file = WEB_CHAR_DIR / act_data['file']
                shutil.copy2(img_file, root_file)

    print("\nBarbarian rogue blade fragment cleaning completed successfully!")

if __name__ == '__main__':
    main()
