"""
fix_novas_boss_death_and_skills.py
1. 嚴格按 0°~360° 連續方位排序重新導出 poison_nova.png, fire_nova.png, frost_nova.png
2. 導出 Diablo 伸手施法動畫 diablo_cast.png (S2)
3. 導出 Diablo 完整 142 幀靈魂爆裂死亡動畫 diablo_death.png
4. 重製 Baal 死亡動畫 baal_death.png (300x360 完整保留下半身與觸手，絕不被地板切除吃掉)
5. 重製 Mephisto 死亡動畫 mephisto_death.png (300x360 完整保留骷髏與靈魂飄逸)
6. 更新 monsters_manifest.json / .js 與 fx_manifest.json / .js
"""
import os
import sys
import struct
import json
from PIL import Image

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEB_DIR = os.path.join(BASE_DIR, 'web')
MONSTERS_DIR = os.path.join(WEB_DIR, 'assets', 'monsters')
FX_DIR = os.path.join(WEB_DIR, 'assets', 'fx')
TOOLS_DIR = os.path.join(BASE_DIR, 'tools')
RAW_DIR = os.path.join(TOOLS_DIR, 'mpq_raw')

if TOOLS_DIR not in sys.path:
    sys.path.insert(0, TOOLS_DIR)

from fix_boss_cast_and_skills import DCCDecoder, PAL1, PAL2, PAL3, PAL4, PAL5
from build_all_acts_and_monsters import decode_dc6_frame

# ==========================================
# 1. 導出精準連續方位 Nova 投射物
# ==========================================
def export_clean_skill_reordered(dcc_rel, out_fn, cell_w, cell_h, anchor_x, anchor_y, pal, order, min_lum=25):
    fp = os.path.join(RAW_DIR, dcc_rel)
    if not os.path.exists(fp):
        print(f"[ERR] File not found: {fp}")
        return
    dec = DCCDecoder(fp)
    out_dirs = len(order)
    fpd = dec.frames_per_dir
    sheet_w = cell_w * fpd
    sheet_h = cell_h * out_dirs
    sheet = Image.new('RGBA', (sheet_w, sheet_h), (0, 0, 0, 0))
    
    for row_idx, src_d in enumerate(order):
        frames = dec.decode_direction(src_d)
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
                    r, g, b, _ = pal[idx]
                    lum = max(r, g, b)
                    if lum < min_lum:
                        continue
                    frame_img.putpixel((x, y), (r, g, b, 255))
            dest_x = (f_idx * cell_w) + (cell_w - fw) // 2
            dest_y = (row_idx * cell_h) + (cell_h - fh) // 2
            sheet.paste(frame_img, (dest_x, dest_y), frame_img)
            
    out_path = os.path.join(FX_DIR, out_fn)
    sheet.save(out_path)
    print(f"  [OK] {out_fn} saved ({sheet_w}x{sheet_h}, {out_dirs} dirs x {fpd} frames)")

# ==========================================
# 2. 導出 Diablo 伸手施法動畫 (S2: LG + TR + RA + LA)
# ==========================================
def export_diablo_reach_cast():
    di_base = os.path.join(RAW_DIR, 'd2data', 'data', 'global', 'monsters', 'DI')
    parts = ['LG', 'TR', 'RA', 'LA']
    decoders = [DCCDecoder(os.path.join(di_base, p, f'DI{p}LITS2HTH.dcc')) for p in parts]
    dirs = 8
    fpd = 16
    cw, ch = 350, 280
    anchor_x, anchor_y = 175, 175
    sheet = Image.new('RGBA', (cw * fpd, ch * dirs), (0, 0, 0, 0))
    
    for d in range(dirs):
        decoded_layers = [dec.decode_direction(d) for dec in decoders]
        for f in range(fpd):
            dst_cell_x = f * cw
            dst_cell_y = d * ch
            for layer in decoded_layers:
                fr = layer[f]
                fw, fh = fr['width'], fr['height']
                if fw == 0 or fh == 0: continue
                f_img = Image.new('RGBA', (fw, fh), (0, 0, 0, 0))
                for y in range(fh):
                    sy = (fh - 1 - y) if fr['bottom_up'] else y
                    for x in range(fw):
                        idx = fr['pixels'][sy * fw + x]
                        if idx != 0:
                            r, g, b, _ = PAL4[idx]
                            f_img.putpixel((x, y), (r, g, b, 255))
                dst_x = dst_cell_x + anchor_x + fr['x_offset']
                dst_y = dst_cell_y + anchor_y + fr['y_offset'] - fh + 1
                sheet.paste(f_img, (dst_x, dst_y), f_img)
                
    out_p = os.path.join(MONSTERS_DIR, 'diablo_cast.png')
    sheet.save(out_p)
    print(f"  [OK] diablo_cast.png (S2 Reach Out Hand) saved ({sheet.size}, 8 dirs x {fpd} frames)")

# ==========================================
# 3. 導出 Diablo 完整 142 幀靈魂爆裂死亡 (diablo_death.png)
# ==========================================
def export_diablo_death():
    di_base = os.path.join(RAW_DIR, 'd2data', 'data', 'global', 'monsters', 'DI')
    base_parts = ['LG', 'TR', 'RA', 'LA', 'S2']
    base_datas = [open(os.path.join(di_base, p, f'DI{p}LITDTHTH.DC6'), 'rb').read() for p in base_parts]
    s1_data = open(os.path.join(di_base, 'S1', 'DIS1LITDTHTH.DC6'), 'rb').read()

    fpd = 25
    sample_indices = [int(i * 141 / (fpd - 1)) for i in range(fpd)]
    cell_w, cell_h = 360, 360
    anchor_x, anchor_y = 180, 250

    sheet = Image.new('RGBA', (cell_w * fpd, cell_h * 8), (0, 0, 0, 0))
    dir0_frames = []

    for f_idx, orig_f in enumerate(sample_indices):
        frame_canvas = Image.new('RGBA', (cell_w, cell_h), (0, 0, 0, 0))
        # 繪製基底部件
        for data in base_datas:
            off = struct.unpack_from('<I', data, 24 + orig_f * 4)[0]
            info, pixels = decode_dc6_frame(data, off)
            if not info or not pixels: continue
            w, h = info['width'], info['height']
            ox, oy = info['offset_x'], info['offset_y']
            for y in range(h):
                for x in range(w):
                    idx = pixels[y * w + x]
                    if idx != 0:
                        r, g, b, _ = PAL4[idx]
                        frame_canvas.putpixel((anchor_x + ox + x, anchor_y + oy - h + 1 + y), (r, g, b, 255))
        # 疊加 S1 靈魂爆裂電弧 (加法疊加無黑邊)
        off_s1 = struct.unpack_from('<I', s1_data, 24 + orig_f * 4)[0]
        info_s1, pixels_s1 = decode_dc6_frame(s1_data, off_s1)
        if info_s1 and pixels_s1:
            w, h = info_s1['width'], info_s1['height']
            ox, oy = info_s1['offset_x'], info_s1['offset_y']
            for y in range(h):
                for x in range(w):
                    idx = pixels_s1[y * w + x]
                    if idx != 0:
                        r, g, b, _ = PAL4[idx]
                        lum = max(r, g, b)
                        if lum > 25:
                            px, py = anchor_x + ox + x, anchor_y + oy - h + 1 + y
                            if 0 <= px < cell_w and 0 <= py < cell_h:
                                cr, cg, cb, ca = frame_canvas.getpixel((px, py))
                                frame_canvas.putpixel((px, py), (min(255, cr + r), min(255, cg + g), min(255, cb + b), 255))
        dir0_frames.append(frame_canvas)

    for d in range(8):
        for f in range(fpd):
            sheet.paste(dir0_frames[f], (f * cell_w, d * cell_h), dir0_frames[f])

    out_p = os.path.join(MONSTERS_DIR, 'diablo_death.png')
    sheet.save(out_p)
    print(f"  [OK] diablo_death.png saved ({sheet.size}, 8 dirs x {fpd} frames, no clipping)")

# ==========================================
# 4. 重製 Baal 死亡動畫 (絕不被地板切除)
# ==========================================
def export_clean_baal_death():
    baal_dir = os.path.join(RAW_DIR, 'd2exp', 'data', 'global', 'monsters', '42')
    death_parts = ['tr', 'hd', 's6']
    death_datas = []
    for p in death_parts:
        fn = f"42{p.upper()}LITDTHTH.DC6" if p != 'hd' else "42HDLitDTHTH.DC6"
        fp = os.path.join(baal_dir, p, fn)
        with open(fp, 'rb') as f: death_datas.append(f.read())

    cell_w, cell_h = 300, 360
    anchor_x, anchor_y = 150, 210
    fpd = 25
    sample_indices = [int(i * 199 / (fpd - 1)) for i in range(fpd)]
    sheet = Image.new('RGBA', (cell_w * fpd, cell_h * 8), (0, 0, 0, 0))
    dir0_frames = []

    for orig_f in sample_indices:
        canvas = Image.new('RGBA', (cell_w, cell_h), (0, 0, 0, 0))
        for data in death_datas:
            off = struct.unpack_from('<I', data, 24 + orig_f * 4)[0]
            info, pixels = decode_dc6_frame(data, off)
            if not info or not pixels: continue
            w, h = info['width'], info['height']
            ox, oy = info['offset_x'], info['offset_y']
            for y in range(h):
                for x in range(w):
                    idx = pixels[y * w + x]
                    if idx != 0:
                        r, g, b, _ = PAL5[idx]
                        px, py = anchor_x + ox + x, anchor_y + oy - h + 1 + y
                        if 0 <= px < cell_w and 0 <= py < cell_h:
                            canvas.putpixel((px, py), (r, g, b, 255))
        dir0_frames.append(canvas)

    for d in range(8):
        for f in range(fpd):
            sheet.paste(dir0_frames[f], (f * cell_w, d * cell_h), dir0_frames[f])

    out_p = os.path.join(MONSTERS_DIR, 'baal_death.png')
    sheet.save(out_p)
    print(f"  [OK] baal_death.png saved ({sheet.size}, 8 dirs x {fpd} frames, no clipping)")

# ==========================================
# 5. 重製 Mephisto 死亡動畫 (絕不被地板切除)
# ==========================================
def export_clean_mephisto_death():
    mp_base = os.path.join(RAW_DIR, 'd2data', 'data', 'global', 'monsters', 'MP')
    mp_parts = ['TR', 'LA', 'RA', 'S1', 'S2', 'S3', 's5', 's6']
    mp_datas = []
    for p in mp_parts:
        fp = os.path.join(mp_base, p, f'MP{p}LITDTHTH.DC6')
        if os.path.exists(fp):
            with open(fp, 'rb') as f: mp_datas.append(f.read())

    cell_w, cell_h = 300, 360
    anchor_x, anchor_y = 150, 230
    fpd = 25
    sample_indices = [int(i * 199 / (fpd - 1)) for i in range(fpd)]
    sheet = Image.new('RGBA', (cell_w * fpd, cell_h * 8), (0, 0, 0, 0))
    dir0_frames = []

    for orig_f in sample_indices:
        canvas = Image.new('RGBA', (cell_w, cell_h), (0, 0, 0, 0))
        for data in mp_datas:
            dirs, frames = struct.unpack_from('<II', data, 16)
            f_idx = min(orig_f, frames - 1)
            off = struct.unpack_from('<I', data, 24 + f_idx * 4)[0]
            info, pixels = decode_dc6_frame(data, off)
            if not info or not pixels: continue
            w, h = info['width'], info['height']
            ox, oy = info['offset_x'], info['offset_y']
            for y in range(h):
                for x in range(w):
                    idx = pixels[y * w + x]
                    if idx != 0:
                        r, g, b, _ = PAL3[idx]
                        lum = max(r, g, b)
                        if lum > 20:
                            px, py = anchor_x + ox + x, anchor_y + oy - h + 1 + y
                            if 0 <= px < cell_w and 0 <= py < cell_h:
                                canvas.putpixel((px, py), (r, g, b, 255))
        dir0_frames.append(canvas)

    for d in range(8):
        for f in range(fpd):
            sheet.paste(dir0_frames[f], (f * cell_w, d * cell_h), dir0_frames[f])

    out_p = os.path.join(MONSTERS_DIR, 'mephisto_death.png')
    sheet.save(out_p)
    print(f"  [OK] mephisto_death.png saved ({sheet.size}, 8 dirs x {fpd} frames, no clipping)")

def main():
    print("=== [1/3] Exporting Perfect Monotonic Novae ===")
    order_32 = [7, 28, 14, 29, 3, 30, 15, 31, 4, 16, 8, 17, 0, 18, 9, 19, 5, 20, 10, 21, 1, 22, 11, 23, 6, 24, 12, 25, 2, 26, 13, 27]
    export_clean_skill_reordered(r'd2data\data\global\missiles\poisonNova.dcc', 'poison_nova.png', 120, 80, 60, 40, PAL1, order_32, min_lum=25)

    order_16_fire = [7, 14, 3, 4, 8, 0, 15, 9, 5, 1, 10, 11, 12, 6, 2, 13]
    export_clean_skill_reordered(r'd2exp\data\global\missiles\Expansion\firenova.dcc', 'fire_nova.png', 100, 80, 50, 40, PAL4, order_16_fire, min_lum=26)

    order_16_frost = [14, 7, 6, 11, 0, 10, 12, 2, 1, 15, 3, 5, 13, 9, 8, 4]
    export_clean_skill_reordered(r'd2data\data\global\missiles\FrostNova.dcc', 'frost_nova.png', 100, 70, 50, 35, PAL3, order_16_frost, min_lum=25)

    print("=== [2/3] Exporting Boss Cast & Unclipped Death Animations ===")
    export_diablo_reach_cast()
    export_diablo_death()
    export_clean_baal_death()
    export_clean_mephisto_death()

    print("=== [3/3] Updating Manifests ===")
    p_m_json = os.path.join(MONSTERS_DIR, 'monsters_manifest.json')
    p_m_js = os.path.join(MONSTERS_DIR, 'monsters_manifest.js')
    with open(p_m_json, 'r', encoding='utf-8') as f:
        monsters = json.load(f)

    # Diablo
    monsters['diablo']['actions']['cast'] = {
        "file": "assets/monsters/diablo_cast.png",
        "directions": 8, "frames": 16, "cell_width": 350, "cell_height": 280, "anchor_x": 175, "anchor_y": 175
    }
    monsters['diablo']['actions']['death'] = {
        "file": "assets/monsters/diablo_death.png",
        "directions": 8, "frames": 25, "cell_width": 360, "cell_height": 360, "anchor_x": 180, "anchor_y": 250
    }
    # Baal death
    monsters['baal']['actions']['death'] = {
        "file": "assets/monsters/baal_death.png",
        "directions": 8, "frames": 25, "cell_width": 300, "cell_height": 360, "anchor_x": 150, "anchor_y": 210
    }
    # Mephisto death
    monsters['mephisto']['actions']['death'] = {
        "file": "assets/monsters/mephisto_death.png",
        "directions": 8, "frames": 25, "cell_width": 300, "cell_height": 360, "anchor_x": 150, "anchor_y": 230
    }

    with open(p_m_json, 'w', encoding='utf-8') as f:
        json.dump(monsters, f, ensure_ascii=False, indent=2)
    with open(p_m_js, 'w', encoding='utf-8') as f:
        f.write("window.D2_MONSTERS_MANIFEST = ")
        json.dump(monsters, f, ensure_ascii=False, indent=2)
        f.write(";\n")

    print("[SUCCESS] All assets exported and manifests updated successfully!")

if __name__ == '__main__':
    main()
