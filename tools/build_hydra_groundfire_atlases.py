#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_hydra_groundfire_atlases.py
使用 d2_proj_toolkit.py 將 HydraGroundFire / Start / End 從原廠 DCC 封裝成標準 Union-Box 圖集
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
OVERLAY_BASE = TOOLS_DIR / "mpq_raw" / "d2data" / "data" / "global" / "overlays"
OUT_ATLAS_DIR = ROOT_DIR / "Diablo2-Agent-Monitor" / "web" / "assets" / "atlases"
SANDBOX_ATLAS_DIR = ROOT_DIR / "verification_sandbox" / "assets" / "atlases"
TEMP_FRAME_DIR = ROOT_DIR / "scratch" / "hydra_fire_frames"

palette = load_palette(str(PAL_PATH))

TARGETS = [
    {
        "name": "hydra_groundfire",
        "dcc": OVERLAY_BASE / "HydraGroundFire.dcc",
        "y_mode": "bottom",
        "skip_pca": True,
    },
    {
        "name": "hydra_groundfire_start",
        "dcc": OVERLAY_BASE / "HydraGroundFireStart.dcc",
        "y_mode": "bottom",
        "skip_pca": True,
    },
    {
        "name": "hydra_groundfire_end",
        "dcc": OVERLAY_BASE / "HydraGroundFireEnd.dcc",
        "y_mode": "bottom",
        "skip_pca": True,
    },
]

def build_target(target):
    name = target["name"]
    dcc_path = Path(target["dcc"])
    if not dcc_path.exists():
        print(f"[ERROR] {dcc_path} does not exist.")
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

    cmd = [
        sys.executable,
        str(ROOT_DIR / "tools" / "d2_proj_toolkit.py"),
        "build",
        "--manifest", str(manifest_file),
        "--out-dir", str(OUT_ATLAS_DIR),
        "--name", name,
        "--y-mode", target.get("y_mode", "bottom"),
        "--skip-pca",
    ]

    print(f"Running d2_proj_toolkit.py for {name}...")
    res = subprocess.run(cmd, capture_output=True, text=True, cwd=str(ROOT_DIR))
    if res.returncode != 0:
        print(f"  [ERROR] {res.stderr}\n{res.stdout}")
        return False
    print(f"  [OK] Successfully built {name} atlas into {OUT_ATLAS_DIR}")

    # 同步複製到 sandbox 目錄
    if SANDBOX_ATLAS_DIR.exists():
        import shutil
        png_src = OUT_ATLAS_DIR / f"{name}.png"
        json_src = OUT_ATLAS_DIR / f"{name}.json"
        if png_src.exists():
            shutil.copy2(png_src, SANDBOX_ATLAS_DIR / f"{name}.png")
        if json_src.exists():
            shutil.copy2(json_src, SANDBOX_ATLAS_DIR / f"{name}.json")

    return True

if __name__ == "__main__":
    for t in TARGETS:
        build_target(t)
    print("Done!")
