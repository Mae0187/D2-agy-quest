"""
Build Authentic D2 Monster Spritesheets from Genuine DCC Files
使用原版 MPQ DCC 與 ACT1 pal.dat 色盤輸出標準化怪物圖集與 manifest.js
"""
import os
import sys
import json
from PIL import Image

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.normpath(os.path.join(SCRIPT_DIR, '..'))
PAL_PATH = os.path.join(PROJECT_DIR, 'tools', 'mpq_raw', 'd2data', 'data', 'global', 'palette', 'ACT1', 'pal.dat')
OUT_DIR = os.path.join(PROJECT_DIR, 'web', 'assets', 'monsters')
os.makedirs(OUT_DIR, exist_ok=True)

sys.path.append(SCRIPT_DIR)
from dcc_to_png import DCCDecoder, load_palette

palette = load_palette(PAL_PATH, brightness_boost=1.35)

def export_monster_dcc(dcc_rel, out_filename, cell_w, cell_h, anchor_x, anchor_y):
    dcc_path = os.path.join(PROJECT_DIR, 'tools', 'mpq_raw', dcc_rel)
    if not os.path.exists(dcc_path):
        print(f"[ERROR] DCC not found: {dcc_path}")
        return None

    dec = DCCDecoder(dcc_path)
    sheet_w = cell_w * dec.frames_per_dir
    sheet_h = cell_h * dec.directions
    sheet = Image.new('RGBA', (sheet_w, sheet_h), (0, 0, 0, 0))

    for d in range(dec.directions):
        frames = dec.decode_direction(d)
        for f_idx, fr in enumerate(frames):
            fw, fh = fr['width'], fr['height']
            if fw == 0 or fh == 0:
                continue

            frame_img = Image.new('RGBA', (fw, fh), (0, 0, 0, 0))
            pixels = fr['pixels']
            for y in range(fh):
                src_y = (fh - 1 - y) if fr['bottom_up'] else y
                for x in range(fw):
                    idx = pixels[src_y * fw + x]
                    if idx == 0:
                        continue
                    r, g, b, _ = palette[idx]
                    frame_img.putpixel((x, y), (r, g, b, 255))

            # 依據 Blizzard 原版錨點精確對齊
            dst_x = f_idx * cell_w + anchor_x + fr['x_offset']
            dst_y = d * cell_h + anchor_y + fr['y_offset'] - fh + 1
            sheet.paste(frame_img, (dst_x, dst_y), frame_img)

    out_path = os.path.join(OUT_DIR, out_filename)
    sheet.save(out_path)
    print(f"[EXPORT] {out_filename} ({sheet_w}x{sheet_h}, {dec.directions} dirs x {dec.frames_per_dir} frames)")
    return {
        "file": f"assets/monsters/{out_filename}",
        "directions": dec.directions,
        "frames": dec.frames_per_dir,
        "cell_width": cell_w,
        "cell_height": cell_h,
        "anchor_x": anchor_x,
        "anchor_y": anchor_y
    }

def main():
    print("=== Generating Authentic Monster Spritesheets from MPQ DCC ===")
    manifest = {
        "fallen": {
            "name": "Fallen (沉淪魔)",
            "type": "minion",
            "max_hp": 30,
            "actions": {}
        },
        "skeleton": {
            "name": "Skeleton (骷髏戰士)",
            "type": "minion",
            "max_hp": 45,
            "actions": {}
        },
        "zombie": {
            "name": "Zombie (飢餓殭屍)",
            "type": "minion",
            "max_hp": 60,
            "actions": {}
        },
        "andariel": {
            "name": "Andariel (安達利爾)",
            "type": "boss",
            "max_hp": 300,
            "actions": {}
        }
    }

    # 1. 沉淪魔 (FA)
    fa_base = "d2data/data/global/monsters/FA/TR"
    manifest["fallen"]["actions"]["idle"] = export_monster_dcc(
        f"{fa_base}/FATRLITNUHTH.dcc", "fallen_idle.png", 100, 100, 50, 75
    )
    manifest["fallen"]["actions"]["walk"] = export_monster_dcc(
        f"{fa_base}/FATRLITWLHTH.dcc", "fallen_walk.png", 100, 100, 50, 75
    )
    manifest["fallen"]["actions"]["attack"] = export_monster_dcc(
        f"{fa_base}/FATRLITA1HTH.dcc", "fallen_attack.png", 100, 100, 50, 75
    )
    manifest["fallen"]["actions"]["hit"] = export_monster_dcc(
        f"{fa_base}/FATRLITGHHTH.dcc", "fallen_hit.png", 100, 100, 50, 75
    )
    manifest["fallen"]["actions"]["death"] = export_monster_dcc(
        f"{fa_base}/FATRLITDTHTH.dcc", "fallen_death.png", 100, 100, 50, 75
    )

    # 2. 骷髏戰士 (SK)
    sk_base = "d2data/data/global/monsters/SK/TR"
    manifest["skeleton"]["actions"]["idle"] = export_monster_dcc(
        f"{sk_base}/SKTRLITNU1HS.dcc", "skeleton_idle.png", 130, 110, 65, 75
    )
    manifest["skeleton"]["actions"]["walk"] = export_monster_dcc(
        f"{sk_base}/SKTRLITWL1HS.dcc", "skeleton_walk.png", 130, 110, 65, 75
    )
    manifest["skeleton"]["actions"]["attack"] = export_monster_dcc(
        f"{sk_base}/SKTRLITA11HS.dcc", "skeleton_attack.png", 130, 110, 65, 75
    )
    manifest["skeleton"]["actions"]["hit"] = export_monster_dcc(
        f"{sk_base}/SKTRLITGH1HS.dcc", "skeleton_hit.png", 130, 110, 65, 75
    )
    manifest["skeleton"]["actions"]["death"] = export_monster_dcc(
        f"{sk_base}/SKTRLITDT1HS.dcc", "skeleton_death.png", 130, 110, 65, 75
    )

    # 3. 飢餓殭屍 (ZM)
    zm_base = "d2data/data/global/monsters/ZM/TR"
    manifest["zombie"]["actions"]["idle"] = export_monster_dcc(
        f"{zm_base}/ZMTRLITNUHTH.dcc", "zombie_idle.png", 130, 110, 65, 75
    )
    manifest["zombie"]["actions"]["walk"] = export_monster_dcc(
        f"{zm_base}/ZMTRLITWLHTH.dcc", "zombie_walk.png", 130, 110, 65, 75
    )
    manifest["zombie"]["actions"]["attack"] = export_monster_dcc(
        f"{zm_base}/ZMTRLITA1HTH.dcc", "zombie_attack.png", 130, 110, 65, 75
    )
    manifest["zombie"]["actions"]["hit"] = export_monster_dcc(
        f"{zm_base}/ZMTRLITGHHTH.dcc", "zombie_hit.png", 130, 110, 65, 75
    )
    manifest["zombie"]["actions"]["death"] = export_monster_dcc(
        f"{zm_base}/ZMTRLITDTHTH.dcc", "zombie_death.png", 130, 110, 65, 75
    )

    # 4. 劇毒蜘蛛 (SP - Giant Spider)
    sp_base = "d2data/data/global/monsters/SP/TR"
    manifest["spider"] = {
        "name": "Giant Spider (劇毒蜘蛛)",
        "type": "minion",
        "max_hp": 40,
        "actions": {}
    }
    manifest["spider"]["actions"]["idle"] = export_monster_dcc(
        f"{sp_base}/SPTRLITNUHTH.dcc", "spider_idle.png", 230, 200, 115, 130
    )
    manifest["spider"]["actions"]["walk"] = export_monster_dcc(
        f"{sp_base}/SPTRLITWLHTH.dcc", "spider_walk.png", 230, 200, 115, 130
    )
    manifest["spider"]["actions"]["attack"] = export_monster_dcc(
        f"{sp_base}/SPTRLITA1HTH.dcc", "spider_attack.png", 230, 200, 115, 130
    )
    manifest["spider"]["actions"]["hit"] = export_monster_dcc(
        f"{sp_base}/SPTRLITGHHTH.dcc", "spider_hit.png", 230, 200, 115, 130
    )
    manifest["spider"]["actions"]["death"] = export_monster_dcc(
        f"{sp_base}/SPTRLITDTHTH.dcc", "spider_death.png", 230, 200, 115, 130
    )

    # 5. 幽靈鬼魂 (WR - Wraith)
    wr_base = "d2data/data/global/monsters/WR/TR"
    manifest["wraith"] = {
        "name": "Wraith (幽靈鬼魂)",
        "type": "minion",
        "max_hp": 35,
        "actions": {}
    }
    manifest["wraith"]["actions"]["idle"] = export_monster_dcc(
        f"{wr_base}/WRTRLITNUHTH.dcc", "wraith_idle.png", 180, 170, 90, 130
    )
    manifest["wraith"]["actions"]["walk"] = export_monster_dcc(
        f"{wr_base}/WRTRLITWLHTH.dcc", "wraith_walk.png", 180, 170, 90, 130
    )
    manifest["wraith"]["actions"]["attack"] = export_monster_dcc(
        f"{wr_base}/WRTRLITA1HTH.dcc", "wraith_attack.png", 180, 170, 90, 130
    )
    manifest["wraith"]["actions"]["hit"] = export_monster_dcc(
        f"{wr_base}/WRTRLITGHHTH.dcc", "wraith_hit.png", 180, 170, 90, 130
    )
    manifest["wraith"]["actions"]["death"] = export_monster_dcc(
        f"{wr_base}/WRTRLITDTHTH.dcc", "wraith_death.png", 180, 170, 90, 130
    )

    # 6. 聖甲蟲 (BT - Death Beetle)
    bt_base = "d2data/data/global/monsters/BT/TR"
    manifest["beetle"] = {
        "name": "Death Beetle (聖甲蟲)",
        "type": "minion",
        "max_hp": 55,
        "actions": {}
    }
    manifest["beetle"]["actions"]["idle"] = export_monster_dcc(
        f"{bt_base}/BTTRLITNUHTH.dcc", "beetle_idle.png", 180, 160, 90, 105
    )
    manifest["beetle"]["actions"]["walk"] = export_monster_dcc(
        f"{bt_base}/BTTRLITWLHTH.dcc", "beetle_walk.png", 180, 160, 90, 105
    )
    manifest["beetle"]["actions"]["attack"] = export_monster_dcc(
        f"{bt_base}/BTTRLITA1HTH.dcc", "beetle_attack.png", 180, 160, 90, 105
    )
    manifest["beetle"]["actions"]["hit"] = export_monster_dcc(
        f"{bt_base}/BTTRLITGHHTH.dcc", "beetle_hit.png", 180, 160, 90, 105
    )
    manifest["beetle"]["actions"]["death"] = export_monster_dcc(
        f"{bt_base}/BTTRLITDTHTH.dcc", "beetle_death.png", 180, 160, 90, 105
    )

    # 7. 安達利爾 (AN - Act 1 Boss)
    an_base = "d2data/data/global/monsters/AN/TR"
    manifest["andariel"]["actions"]["idle"] = export_monster_dcc(
        f"{an_base}/ANTRLITNUHTH.dcc", "andariel_idle.png", 220, 240, 110, 190
    )
    manifest["andariel"]["actions"]["walk"] = export_monster_dcc(
        f"{an_base}/ANTRLITWLHTH.dcc", "andariel_walk.png", 220, 240, 110, 190
    )
    manifest["andariel"]["actions"]["attack"] = export_monster_dcc(
        f"{an_base}/ANTRLITA1HTH.dcc", "andariel_attack.png", 220, 240, 110, 190
    )
    manifest["andariel"]["actions"]["hit"] = export_monster_dcc(
        f"{an_base}/ANTRLITGHHTH.dcc", "andariel_hit.png", 220, 240, 110, 190
    )
    manifest["andariel"]["actions"]["death"] = export_monster_dcc(
        f"{an_base}/ANTRLITDTHTH.dcc", "andariel_death.png", 220, 240, 110, 190
    )

    # 輸出 manifest.js 與 manifest.json
    js_content = "window.D2_MONSTERS_MANIFEST = " + json.dumps(manifest, indent=2, ensure_ascii=False) + ";\n"
    with open(os.path.join(OUT_DIR, "monsters_manifest.js"), "w", encoding="utf-8") as f:
        f.write(js_content)
    with open(os.path.join(OUT_DIR, "monsters_manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)

    print("\n[SUCCESS] Monster manifests & spritesheets generated successfully!")

if __name__ == "__main__":
    main()
