#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_authentic_fire_atlases.py
從 DCC 原始切片自動解碼並調用 d2_proj_toolkit.py 封裝成官方 Union-Box 圖集
"""
import os
import sys
import json
import subprocess
from pathlib import Path
from PIL import Image

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT_DIR = SCRIPT_DIR.parent
TOOLS_DIR = ROOT_DIR / "Diablo2-Agent-Monitor" / "tools"
sys.path.append(str(TOOLS_DIR))

from dcc_to_png import DCCDecoder, load_palette

PAL_PATH = TOOLS_DIR / "mpq_raw" / "d2data" / "data" / "global" / "palette" / "ACT1" / "pal.dat"
DCC_BASE = TOOLS_DIR / "mpq_raw" / "d2data" / "data" / "global" / "missiles"
MON_BASE = TOOLS_DIR / "mpq_raw" / "d2data" / "data" / "global" / "monsters"
OUT_ATLAS_DIR = ROOT_DIR / "Diablo2-Agent-Monitor" / "web" / "assets" / "atlases"
TEMP_FRAME_DIR = ROOT_DIR / "scratch" / "fire_build_frames"

palette = load_palette(str(PAL_PATH))

TARGETS = [
    {
        "name": "firebolt",
        "dcc": DCC_BASE / "Firebolt.dcc",
        "y_mode": "bottom",
        "skip_pca": False,
        "extra_args": ["--slot-tol", "10.0", "--intra-tol", "12.0"],
    },
    {
        "name": "flamethrower",
        "dcc": DCC_BASE / "Flamethrower.dcc",
        "y_mode": "bottom",
        "skip_pca": True,
    },
    {
        "name": "groundfire_big",
        "dcc": DCC_BASE / "groundFireBig.dcc",
        "y_mode": "bottom",
        "skip_pca": True,
    },
    {
        "name": "groundfire_med",
        "dcc": DCC_BASE / "groundFireMedium.dcc",
        "y_mode": "bottom",
        "skip_pca": True,
    },
    {
        "name": "meteor",
        "dcc": DCC_BASE / "Meteor.dcc",
        "y_mode": "bottom",
        "skip_pca": True,
    },
    {
        "name": "meteor_indicator",
        "dcc": DCC_BASE / "MeteorTargetIndicator.dcc",
        "y_mode": "bottom",
        "skip_pca": True,
    },
    {
        "name": "meteor_explode",
        "dcc": DCC_BASE / "ExpArrowExplode.dcc",
        "y_mode": "bottom",
        "skip_pca": True,
    },
    {
        "name": "hydra_nu",
        "dcc": MON_BASE / "HX" / "Tr" / "HXTRLITNUHTH.dcc",
        "y_mode": "bottom",
        "skip_pca": True,
    },
    {
        "name": "hydra_a1",
        "dcc": MON_BASE / "HX" / "Tr" / "HXTRLITA1HTH.dcc",
        "y_mode": "bottom",
        "skip_pca": True,
    },
]

def build_single_dcc(target):
    name = target["name"]
    dcc_path = Path(target["dcc"])
    if not dcc_path.exists():
        print(f"[SKIP] {dcc_path} does not exist.")
        return False
    
    item_tmp = TEMP_FRAME_DIR / name
    item_tmp.mkdir(parents=True, exist_ok=True)
    
    decoder = DCCDecoder(str(dcc_path))
    manifest = {
        "y_mode": target.get("y_mode", "bottom"),
        "name": name,
        "frames": []
    }
    
    print(f"Decoding {name} ({decoder.directions} dirs, {decoder.frames_per_dir} frames/dir)...")
    for d in range(decoder.directions):
        frames = decoder.decode_direction(d)
        for f_idx, fr in enumerate(frames):
            fw, fh = fr["width"], fr["height"]
            img = Image.new("RGBA", (max(1, fw), max(1, fh)), (0, 0, 0, 0))
            if fw > 0 and fh > 0:
                pixels = fr["pixels"]
                for y in range(fh):
                    src_y = (fh - 1 - y) if fr["bottom_up"] else y
                    for x in range(fw):
                        idx = pixels[src_y * fw + x]
                        if idx != 0:
                            img.putpixel((x, y), palette[idx])
            
            fn = f"d{d}_f{f_idx}.png"
            img.save(item_tmp / fn)
            manifest["frames"].append({
                "dir": d,
                "frame": f_idx,
                "file": fn,
                "offset_x": fr["x_offset"],
                "offset_y": fr["y_offset"]
            })
            
    manifest_file = item_tmp / "manifest.json"
    with open(manifest_file, "w", encoding="utf-8") as mf:
        json.dump(manifest, mf, indent=2)
        
    # Call d2_proj_toolkit.py
    cmd = [
        sys.executable,
        str(ROOT_DIR / "tools" / "d2_proj_toolkit.py"),
        "build",
        "--manifest", str(manifest_file),
        "--out-dir", str(OUT_ATLAS_DIR),
        "--name", name,
        "--y-mode", target.get("y_mode", "bottom"),
    ]
    if target.get("skip_pca", False):
        cmd.append("--skip-pca")
    if "extra_args" in target:
        cmd.extend(target["extra_args"])
        
    print(f"Running d2_proj_toolkit.py for {name}...")
    res = subprocess.run(cmd, capture_output=True, text=True, cwd=str(ROOT_DIR))
    if res.returncode != 0:
        print(f"  [ERROR] {res.stderr}\n{res.stdout}")
        return False
    print(f"  [OK] Successfully built {name} atlas into {OUT_ATLAS_DIR}")
    return True

def main():
    print("=== Building Authentic Sorceress Fire Atlases ===")
    OUT_ATLAS_DIR.mkdir(parents=True, exist_ok=True)
    success_count = 0
    for t in TARGETS:
        if build_single_dcc(t):
            success_count += 1
    print(f"=== Finished: {success_count}/{len(TARGETS)} atlases built successfully ===")

if __name__ == "__main__":
    main()
