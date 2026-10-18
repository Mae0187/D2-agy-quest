"""
Diablo II 正統技能與靈氣精靈圖集生成器
提取 MPQ 中的原始 DCC 檔案，透過 ACT1 pal.dat 調色盤輸出為統一規格的精靈圖集 (Spritesheet)。
支援雙層 (Back / Front) 地表環狀靈氣精確對齊 (腳底接觸點為 pivot)。
"""
import os
import sys
import json
from PIL import Image

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.normpath(os.path.join(SCRIPT_DIR, '..'))
PAL_PATH = os.path.join(PROJECT_DIR, 'tools', 'mpq_raw', 'd2data', 'data', 'global', 'palette', 'ACT1', 'pal.dat')
FX_OUT_DIR = os.path.join(PROJECT_DIR, 'web', 'assets', 'fx')
os.makedirs(FX_OUT_DIR, exist_ok=True)

sys.path.append(SCRIPT_DIR)
from dcc_to_png import DCCDecoder, load_palette

palette = load_palette(PAL_PATH, brightness_boost=1.4)

def build_dcc_spritesheet(dcc_rel_path, out_name, cell_w, cell_h, pivot_x, pivot_y, mode='center'):
    dcc_full = os.path.join(PROJECT_DIR, 'tools', 'mpq_raw', dcc_rel_path)
    if not os.path.exists(dcc_full):
        print(f"Warning: file not found: {dcc_full}")
        return None

    print(f"\nProcessing DCC: {dcc_rel_path} -> {out_name}")
    dec = DCCDecoder(dcc_full)

    sheet_w = cell_w * dec.frames_per_dir
    sheet_h = cell_h * dec.directions
    sheet = Image.new('RGBA', (sheet_w, sheet_h), (0, 0, 0, 0))

    for d in range(dec.directions):
        frames = dec.decode_direction(d)
        for f_idx, fr in enumerate(frames):
            fw = fr['width']
            fh = fr['height']
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
                    if mode in ('aura', 'additive', 'foh'):
                        lum = max(r, g, b)
                        if lum < 5:
                            continue
                        frame_img.putpixel((x, y), (r, g, b, 255))
                    else:
                        frame_img.putpixel((x, y), (r, g, b, 255))

            if mode == 'center':
                dest_x = (f_idx * cell_w) + (cell_w - fw) // 2
                dest_y = (d * cell_h) + (cell_h - fh) // 2
            elif mode == 'foh':
                dest_x = (f_idx * cell_w) + (cell_w - fw) // 2
                dest_y = (d * cell_h) + (pivot_y + fr['y_offset'] - fh)
            elif mode == 'aura':
                # 暴雪原生 DCC 偏移：x_offset 為相對單位原點水平位移；(y_offset - fh + 1) 為頂部相對於單位原點之垂直位移
                dest_x = (f_idx * cell_w) + (pivot_x + fr['x_offset'])
                dest_y = (d * cell_h) + (pivot_y + (fr['y_offset'] - fh + 1))
            else:
                dest_x = (f_idx * cell_w) + (pivot_x + fr['x_offset'])
                dest_y = (d * cell_h) + (pivot_y + fr['y_offset'])

            sheet.paste(frame_img, (int(dest_x), int(dest_y)), frame_img)

    out_png = os.path.join(FX_OUT_DIR, f"{out_name}.png")
    sheet.save(out_png)
    print(f"Saved: {out_png} ({sheet_w}x{sheet_h}, dirs={dec.directions}, frames={dec.frames_per_dir}) bbox={sheet.getbbox()}")

    meta = {
        "name": out_name,
        "file": f"assets/fx/{out_name}.png",
        "directions": dec.directions,
        "frames": dec.frames_per_dir,
        "cell_width": cell_w,
        "cell_height": cell_h,
        "pivot_x": pivot_x,
        "pivot_y": pivot_y
    }
    return meta

def main():
    manifest = {
        "skills": {},
        "auras": {}
    }

    # 1. 祝聖之槌 (Blessed Hammer) - 16 方向 x 6 旋轉幀
    manifest["skills"]["hammer"] = build_dcc_spritesheet(
        r"d2data\data\global\missiles\blessedhammer.dcc",
        "blessed_hammer_sheet",
        cell_w=64, cell_h=64, pivot_x=32, pivot_y=32, mode='center'
    )

    # 2. 聖光彈 (Holy Bolt) - 1 方向 x 16 幀 (中心對齊旋轉飛行)
    manifest["skills"]["holybolt"] = build_dcc_spritesheet(
        r"d2data\data\global\missiles\HolyBoltMissile.dcc",
        "holy_bolt_sheet",
        cell_w=100, cell_h=100, pivot_x=50, pivot_y=50, mode='center'
    )

    # 3. 天堂之拳 (Fist of the Heavens) - 1 方向 x 21 幀
    manifest["skills"]["foh"] = build_dcc_spritesheet(
        r"d2data\data\global\missiles\HandOfGod.dcc",
        "foh_sheet",
        cell_w=120, cell_h=300, pivot_x=60, pivot_y=260, mode='foh'
    )

    # 4. 神聖命中震盪 (Shock Hit) - 1 方向 x 20 幀
    manifest["skills"]["hit_shock"] = build_dcc_spritesheet(
        r"d2data\data\global\overlays\ShockHitSm.dcc",
        "hit_shock_sheet",
        cell_w=100, cell_h=100, pivot_x=50, pivot_y=50, mode='center'
    )

    # 5. 原版經典正統地表環狀靈氣 (Back + Front 雙層結構，以腳底原點為中心)
    aura_configs = [
        ("fanatic", "狂熱靈氣 (Fanaticism)", "AuraFanaticBack", "AuraFanaticFront",
         r"d2data\data\global\overlays\Fanatacism_Back.dcc",
         r"d2data\data\global\overlays\Fanatacism_Front.dcc"),
        ("holyfire", "神聖之火 (Holy Fire)", "AuraHolyFireBack", "AuraHolyFireFront",
         r"d2data\data\global\overlays\AuraHolyFireBack.dcc",
         r"d2data\data\global\overlays\AuraHolyFireFront.dcc"),
        ("might", "力量靈氣 (Might)", "AuraMightBack", "AuraMightFront",
         r"d2data\data\global\overlays\AuraMightBack.dcc",
         r"d2data\data\global\overlays\AuraMightFront.dcc"),
        ("concentration", "專注靈氣 (Concentration)", "Concentration_back", "Concentration_front",
         r"d2data\data\global\overlays\Concentration_back.dcc",
         r"d2data\data\global\overlays\Concentration_front.dcc"),
        ("holyshock", "神聖衝擊 (Holy Shock)", "HolyShock_Back", "HolyShock_Front",
         r"d2data\data\global\overlays\HolyShock_Back.dcc",
         r"d2data\data\global\overlays\HolyShock_Front.dcc"),
        ("defiance", "反抗靈氣 (Defiance)", "AuraDefianceBack", "AuraDefianceFront",
         r"d2data\data\global\overlays\AuraDefianceBack.dcc",
         r"d2data\data\global\overlays\AuraDefianceFront.dcc"),
        ("sanctuary", "庇護所靈氣 (Sanctuary)", "SanctuaryAura_Back", "SanctuaryAura_Front",
         r"d2data\data\global\overlays\SanctuaryAura_Back.dcc",
         r"d2data\data\global\overlays\SanctuaryAura_Front.dcc"),
        ("cleansing", "淨化靈氣 (Cleansing)", "cleansing_back", "cleansing_Front",
         r"d2data\data\global\overlays\cleansing_back.dcc",
         r"d2data\data\global\overlays\cleansing_Front.dcc"),
    ]

    cell_w, cell_h = 160, 100
    pivot_x, pivot_y = 80, 50

    for aura_key, aura_title, back_name, front_name, back_dcc, front_dcc in aura_configs:
        meta_back = build_dcc_spritesheet(back_dcc, f"aura_{aura_key}_back", cell_w, cell_h, pivot_x, pivot_y, mode='aura')
        meta_front = build_dcc_spritesheet(front_dcc, f"aura_{aura_key}_front", cell_w, cell_h, pivot_x, pivot_y, mode='aura')
        if meta_back and meta_front:
            manifest["auras"][aura_key] = {
                "key": aura_key,
                "title": aura_title,
                "frames": meta_back["frames"],
                "back_file": meta_back["file"],
                "front_file": meta_front["file"],
                "cell_width": cell_w,
                "cell_height": cell_h,
                "pivot_x": pivot_x,
                "pivot_y": pivot_y
            }

    # 寫入 FX Manifest
    json_path = os.path.join(FX_OUT_DIR, "fx_manifest.json")
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
    print(f"\nSaved FX Manifest to: {json_path}")

    js_path = os.path.join(FX_OUT_DIR, "fx_manifest.js")
    with open(js_path, 'w', encoding='utf-8') as f:
        f.write("window.D2_FX_MANIFEST = " + json.dumps(manifest, indent=2, ensure_ascii=False) + ";\n")
    print(f"Saved FX Manifest JS to: {js_path}")

if __name__ == '__main__':
    main()

