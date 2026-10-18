#!/usr/bin/env python3
"""
build_paladin_authentic_walk.py
為聖騎士輕裝 (Paladin Light) 以暴雪原廠 PAWL1HS.COF + 9 層原生 DCC 合成完全平滑連續之走路動畫
徹底根除先前固定水平置中與底部硬對齊導致的「步伐斷裂、跳動不連續」問題！
"""
import sys, os, json, shutil
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
TOOLS_DIR = PROJECT_DIR / 'tools'
sys.path.insert(0, str(TOOLS_DIR))

from rebuild_anchoring_system import composite_character_action

pa_base = TOOLS_DIR / 'mpq_raw/d2char/data/global/CHARS/PA'
cof_path = pa_base / 'COF/PAWL1HS.COF'

parts = {
    0: str(pa_base / 'HD/PAHDLITWL1HS.dcc'),
    1: str(pa_base / 'TR/PATRLITWL1HS.dcc'),
    2: str(pa_base / 'LG/PALGLITWL1HS.dcc'),
    3: str(pa_base / 'RA/PARALITWL1HS.dcc'),
    4: str(pa_base / 'LA/PALALITWL1HS.dcc'),
    5: str(pa_base / 'RH/PARHSSDWL1HS.dcc'),
    7: str(pa_base / 'SH/PASHLRGWL1HS.dcc'),
    8: str(pa_base / 'S1/PAS1LITWL1HS.dcc'),
    9: str(pa_base / 'S2/PAS2LITWL1HS.dcc'),
}

target_light = PROJECT_DIR / 'web/assets/characters/paladin/light'
target_root = PROJECT_DIR / 'web/assets/characters/paladin'
out_png = target_light / 'paladin_walk.png'

print("Synthesizing Paladin Light Walk from authentic Blizzard DCCs...")
meta = composite_character_action('PA', str(cof_path), parts, str(out_png))
print("Result meta:", meta)

# 同步至根目錄
shutil.copy2(out_png, target_root / 'paladin_walk.png')

# 更新 manifests
for target_dir, var_name in [(target_light, "PALADIN_LIGHT_MANIFEST"), (target_root, "PALADIN_MANIFEST")]:
    json_path = target_dir / "manifest.json"
    js_path = target_dir / "manifest.js"
    with open(json_path, 'r', encoding='utf-8') as f:
        mf = json.load(f)
    
    mf['actions']['walk'] = {
        'name': 'walk',
        'file': 'paladin_walk.png',
        'directions': meta['directions'],
        'frames': meta['frames'],
        'cell_width': meta['cell_width'],
        'cell_height': meta['cell_height'],
        'anchor_x': meta['anchor_x'],
        'anchor_y': meta['anchor_y'],
        'fps': 14,
        'loop': True
    }
    
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(mf, f, indent=2, ensure_ascii=False)
    with open(js_path, 'w', encoding='utf-8') as f:
        f.write(f"window.{var_name} = " + json.dumps(mf, indent=2, ensure_ascii=False) + ";\n")
    print(f"Updated {json_path} and {js_path}")

print("Paladin authentic walk synthesis completed successfully!")
