"""
Diablo II Boss Cast Animations & Skill FX Clean Pipeline
1. 修復督瑞爾 (Duriel) 死亡動畫缺少左下角腹部 (補上 S1 部件 DUS1LITDTHTH.dcc)
2. 導出五大 Boss 正統施法動畫 (Andariel SC, Duriel A2, Mephisto A2, Diablo SC, Baal SC)
3. 重新導出所有法術與靈氣精靈圖集，嚴格過濾 lum < 26 噪點，根除顆粒黑邊與雜色方框
4. 將 Poison Nova (32向)、Fire Nova (16向)、Frost Nova (16向) 按 0°~360° 順時針連續方位精準排序
"""
import os
import sys
import json
import struct
from PIL import Image

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.normpath(os.path.join(SCRIPT_DIR, '..'))
WEB_DIR = os.path.join(PROJECT_DIR, 'web')
MONSTERS_DIR = os.path.join(WEB_DIR, 'assets', 'monsters')
FX_DIR = os.path.join(WEB_DIR, 'assets', 'fx')
RAW_DIR = os.path.join(SCRIPT_DIR, 'mpq_raw')

sys.path.append(SCRIPT_DIR)
from dcc_to_png import DCCDecoder, load_palette

PAL1 = load_palette(os.path.join(RAW_DIR, 'd2data', 'data', 'global', 'palette', 'ACT1', 'pal.dat'), brightness_boost=1.35)
PAL2 = load_palette(os.path.join(RAW_DIR, 'd2data', 'data', 'global', 'palette', 'ACT2', 'pal.dat'), brightness_boost=1.35)
PAL3 = load_palette(os.path.join(RAW_DIR, 'd2data', 'data', 'global', 'palette', 'ACT3', 'pal.dat'), brightness_boost=1.35)
PAL4 = load_palette(os.path.join(RAW_DIR, 'd2data', 'data', 'global', 'palette', 'ACT4', 'pal.dat'), brightness_boost=1.35)
PAL5 = load_palette(os.path.join(RAW_DIR, 'd2exp', 'data', 'global', 'palette', 'ACT5', 'pal.dat'), brightness_boost=1.35)

def decode_dc6_frame(data, offset):
    flip = struct.unpack_from('<I', data, offset)[0]
    w = struct.unpack_from('<I', data, offset + 4)[0]
    h = struct.unpack_from('<I', data, offset + 8)[0]
    off_x = struct.unpack_from('<i', data, offset + 12)[0]
    off_y = struct.unpack_from('<i', data, offset + 16)[0]
    length = struct.unpack_from('<I', data, offset + 28)[0]
    
    pixels = bytearray(w * h)
    curr_x = 0
    curr_y = 0
    ptr = offset + 32
    end_ptr = offset + 32 + length
    
    while ptr < end_ptr and curr_y < h:
        b = data[ptr]
        ptr += 1
        if b == 0x80:
            curr_x = 0
            curr_y += 1
        elif b & 0x80:
            skip = b & 0x7F
            curr_x += skip
        else:
            cnt = b
            for _ in range(cnt):
                if ptr < end_ptr and curr_x < w and curr_y < h:
                    pixels[curr_y * w + curr_x] = data[ptr]
                    curr_x += 1
                    ptr += 1
                else:
                    ptr += 1
    return {'width': w, 'height': h, 'offset_x': off_x, 'offset_y': off_y}, pixels

# ==========================================
# 1. 導出五大 Boss 施法與修正督瑞爾死亡
# ==========================================
def export_boss_animations():
    print("=== [1/4] Exporting Boss Cast Animations & Fixing Duriel Death ===")
    
    # 1.1 Andariel Cast (SC: TR + S1)
    an_base = os.path.join(RAW_DIR, 'd2data', 'data', 'global', 'monsters', 'AN')
    an_parts = [
        os.path.join(an_base, 'TR', 'ANTRLITSCHTH.dcc'),
        os.path.join(an_base, 'S1', 'ANS1LITSCHTH.dcc')
    ]
    export_composite_dcc(an_parts, 'andariel_cast.png', 220, 240, 110, 190, PAL1, 'ANDARIEL CAST')
    
    # 1.2 Duriel Cast (A2: TR + LG + RA + LA)
    du_base = os.path.join(RAW_DIR, 'd2data', 'data', 'global', 'monsters', 'DU')
    du_cast_parts = [
        os.path.join(du_base, 'LG', 'DULGLITA2HTH.dcc'),
        os.path.join(du_base, 'TR', 'DUTRLITA2HTH.dcc'),
        os.path.join(du_base, 'RA', 'DURALITA2HTH.dcc'),
        os.path.join(du_base, 'LA', 'DULALITA2HTH.dcc')
    ]
    export_composite_dcc(du_cast_parts, 'duriel_cast.png', 340, 280, 170, 180, PAL2, 'DURIEL CAST')
    
    # 1.3 Duriel Death FIX (S1 + LG + TR + RA + LA) -> 補上左下角 S1 腹部
    du_death_parts = [
        os.path.join(du_base, 'S1', 'DUS1LITDTHTH.dcc'),
        os.path.join(du_base, 'LG', 'DULGLITDTHTH.dcc'),
        os.path.join(du_base, 'TR', 'DUTRLITDTHTH.dcc'),
        os.path.join(du_base, 'RA', 'DURALITDTHTH.dcc'),
        os.path.join(du_base, 'LA', 'DULALITDTHTH.dcc')
    ]
    export_composite_dcc(du_death_parts, 'duriel_death.png', 340, 280, 170, 180, PAL2, 'DURIEL DEATH (FIXED S1 ABDOMEN)')
    
    # 1.4 Mephisto Cast (A2: TR + LA + RA in DC6)
    mp_base = os.path.join(RAW_DIR, 'd2data', 'data', 'global', 'monsters', 'MP')
    export_mephisto_cast(mp_base)
    
    # 1.5 Diablo Cast (SC: TR + LG + RA + LA + S1)
    di_base = os.path.join(RAW_DIR, 'd2data', 'data', 'global', 'monsters', 'DI')
    di_cast_parts = [
        os.path.join(di_base, 'LG', 'DILGLITSCHTH.dcc'),
        os.path.join(di_base, 'TR', 'DITRLITSCHTH.dcc'),
        os.path.join(di_base, 'RA', 'DIRALITSCHTH.dcc'),
        os.path.join(di_base, 'LA', 'DILALITSCHTH.dcc'),
        os.path.join(di_base, 'S1', 'DIS1LITSCHTH.dcc')
    ]
    export_composite_dcc(di_cast_parts, 'diablo_cast.png', 350, 280, 175, 175, PAL4, 'DIABLO CAST')
    
    # 1.6 Baal Cast (SC: TR + HD + LA + RA + LG + S1)
    baal_base = os.path.join(RAW_DIR, 'd2exp', 'data', 'global', 'monsters', '42')
    baal_cast_parts = [
        os.path.join(baal_base, 'lg', '42LGLITSCHTH.dcc'),
        os.path.join(baal_base, 'tr', '42TRLITSCHTH.dcc'),
        os.path.join(baal_base, 'hd', '42HDLITSCHTH.dcc'),
        os.path.join(baal_base, 'la', '42LALITSCHTH.dcc'),
        os.path.join(baal_base, 'ra', '42RALITSCHTH.dcc'),
        os.path.join(baal_base, 's1', '42S1LITSCHTH.dcc')
    ]
    export_composite_dcc(baal_cast_parts, 'baal_cast.png', 240, 240, 120, 190, PAL5, 'BAAL CAST')

def export_composite_dcc(file_list, out_fn, cell_w, cell_h, anchor_x, anchor_y, pal, label):
    decoders = []
    for fp in file_list:
        if os.path.exists(fp):
            decoders.append(DCCDecoder(fp))
        else:
            print(f"[WARN] Part not found: {fp}")
            
    if not decoders:
        return
        
    dirs = decoders[0].directions
    fpd = max(d.frames_per_dir for d in decoders)
    sheet_w = cell_w * fpd
    sheet_h = cell_h * dirs
    sheet = Image.new('RGBA', (sheet_w, sheet_h), (0, 0, 0, 0))
    
    for d in range(dirs):
        decoded_layers = [dec.decode_direction(d) for dec in decoders]
        for f in range(fpd):
            dst_cell_x = f * cell_w
            dst_cell_y = d * cell_h
            
            for layer_frames in decoded_layers:
                if not layer_frames:
                    continue
                fr = layer_frames[min(f, len(layer_frames) - 1)]
                fw, fh = fr['width'], fr['height']
                if fw == 0 or fh == 0:
                    continue
                frame_img = Image.new('RGBA', (fw, fh), (0, 0, 0, 0))
                pixels = fr['pixels']
                for y in range(fh):
                    src_y = (fh - 1 - y) if fr['bottom_up'] else y
                    for x in range(fw):
                        idx = pixels[src_y * fw + x]
                        if idx != 0:
                            r, g, b, _ = pal[idx]
                            frame_img.putpixel((x, y), (r, g, b, 255))
                dst_x = dst_cell_x + anchor_x + fr['x_offset']
                dst_y = dst_cell_y + anchor_y + fr['y_offset'] - fh + 1
                sheet.paste(frame_img, (dst_x, dst_y), frame_img)
                
    out_path = os.path.join(MONSTERS_DIR, out_fn)
    sheet.save(out_path)
    print(f"  [OK] {label}: {out_fn} saved ({sheet_w}x{sheet_h}, {dirs} dirs x {fpd} frames)")

def export_mephisto_cast(mp_base):
    parts = ['TR', 'LA', 'RA']
    dc6_datas = []
    for p in parts:
        fn = f"MP{p}LITA2HTH.DC6"
        fp = os.path.join(mp_base, p, fn)
        with open(fp, 'rb') as f:
            data = f.read()
        dirs = struct.unpack_from('<I', data, 16)[0]
        fpd = struct.unpack_from('<I', data, 20)[0]
        dc6_datas.append((p, data, dirs, fpd))
        
    dirs = dc6_datas[0][2]
    fpd = dc6_datas[0][3]
    cell_w, cell_h = 220, 240
    anchor_x, anchor_y = 110, 190
    sheet_w = cell_w * fpd
    sheet_h = cell_h * dirs
    sheet = Image.new('RGBA', (sheet_w, sheet_h), (0, 0, 0, 0))
    
    for d in range(dirs):
        for f in range(fpd):
            dst_cell_x = f * cell_w
            dst_cell_y = d * cell_h
            
            for p_name, data, _, _ in dc6_datas:
                off = struct.unpack_from('<I', data, 24 + (d * fpd + f) * 4)[0]
                info, pixels = decode_dc6_frame(data, off)
                if not info or not pixels:
                    continue
                w, h = info['width'], info['height']
                ox, oy = info['offset_x'], info['offset_y']
                if w == 0 or h == 0:
                    continue
                frame_img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
                for y in range(h):
                    for x in range(w):
                        idx = pixels[y * w + x]
                        if idx != 0:
                            r, g, b, _ = PAL3[idx]
                            frame_img.putpixel((x, y), (r, g, b, 255))
                dst_x = dst_cell_x + anchor_x + ox
                dst_y = dst_cell_y + anchor_y + oy - h + 1
                sheet.paste(frame_img, (dst_x, dst_y), frame_img)
                
    out_path = os.path.join(MONSTERS_DIR, 'mephisto_cast.png')
    sheet.save(out_path)
    print(f"  [OK] MEPHISTO CAST: mephisto_cast.png saved ({sheet_w}x{sheet_h}, {dirs} dirs x {fpd} frames)")

# ==========================================
# 2. 導出法術精靈圖並徹底清除噪點濾鏡
# ==========================================
def export_clean_skill(dcc_rel, out_fn, cell_w, cell_h, pivot_x, pivot_y, pal, order=None, min_lum=26):
    fp = os.path.join(RAW_DIR, dcc_rel)
    if not os.path.exists(fp):
        print(f"[ERROR] Missing skill DCC: {fp}")
        return
        
    dec = DCCDecoder(fp)
    dirs = dec.directions
    fpd = dec.frames_per_dir
    
    dir_indices = order if order is not None else list(range(dirs))
    out_dirs = len(dir_indices)
    
    sheet_w = cell_w * fpd
    sheet_h = cell_h * out_dirs
    sheet = Image.new('RGBA', (sheet_w, sheet_h), (0, 0, 0, 0))
    
    for row_idx, src_d in enumerate(dir_indices):
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
                        continue # 徹底過濾暗黑噪點，杜絕黑框與顆粒感
                    frame_img.putpixel((x, y), (r, g, b, 255))
                    
            dest_x = (f_idx * cell_w) + (cell_w - fw) // 2
            dest_y = (row_idx * cell_h) + (cell_h - fh) // 2
            sheet.paste(frame_img, (dest_x, dest_y), frame_img)
            
    out_path = os.path.join(FX_DIR, out_fn)
    sheet.save(out_path)
    print(f"  [SKILL OK] {out_fn} saved ({sheet_w}x{sheet_h}, {out_dirs} dirs x {fpd} frames, min_lum={min_lum})")

def export_clean_holy_freeze():
    fp = os.path.join(RAW_DIR, 'd2data', 'data', 'global', 'overlays', 'HolyFreeze.dcc')
    dec = DCCDecoder(fp)
    pal = PAL2
    frs = dec.decode_direction(0)
    cw, ch = 160, 120
    px, py = 80, 60
    sheet = Image.new('RGBA', (cw * len(frs), ch), (0, 0, 0, 0))
    for f_idx, fr in enumerate(frs):
        fw, fh = fr['width'], fr['height']
        f_img = Image.new('RGBA', (fw, fh), (0, 0, 0, 0))
        for y in range(fh):
            sy = (fh - 1 - y) if fr['bottom_up'] else y
            for x in range(fw):
                idx = fr['pixels'][sy * fw + x]
                if idx == 0: continue
                r, g, b, _ = pal[idx]
                lum = max(r, g, b)
                if lum < 28: continue # 拔除灰色噪點
                f_img.putpixel((x, y), (r, g, b, 255))
        dest_x = (f_idx * cw) + (px + fr['x_offset'])
        dest_y = (py + (fr['y_offset'] - fh + 1))
        sheet.paste(f_img, (dest_x, dest_y), f_img)
    out_path = os.path.join(FX_DIR, 'aura_freeze_sheet.png')
    sheet.save(out_path)
    print(f"  [AURA OK] aura_freeze_sheet.png saved ({sheet.size}, {len(frs)} frames, 100% clean emission)")

def export_all_clean_skills():
    print("=== [2/4] Exporting Clean Skill FX & Circular Sequential Novae ===")
    
    # 2.1 Holy Freeze Aura (Duriel)
    export_clean_holy_freeze()
    
    # 2.2 Poison Nova (32 方向按 0°~360° 順時針連續方位排序)
    order_32 = [7, 26, 27, 13, 14, 2, 28, 3, 25, 29, 12, 15, 30, 6, 24, 31, 4, 8, 16, 11, 23, 22, 17, 0, 18, 9, 1, 19, 5, 10, 21, 20]
    export_clean_skill(r'd2data\data\global\missiles\poisonNova.dcc', 'poison_nova.png', 120, 80, 60, 40, PAL1, order=order_32, min_lum=25)
    
    # 2.3 Fire Nova (16 方向按 0°~360° 順時針排序)
    order_16_fire = [1, 11, 6, 12, 2, 13, 7, 14, 3, 15, 8, 4, 0, 9, 5, 10]
    export_clean_skill(r'd2exp\data\global\missiles\Expansion\firenova.dcc', 'fire_nova.png', 100, 80, 50, 40, PAL4, order=order_16_fire, min_lum=26)
    
    # 2.4 Frost Nova (16 方向按 0°~360° 順時針排序)
    order_16_frost = [1, 11, 6, 12, 2, 13, 7, 14, 3, 15, 4, 8, 0, 9, 5, 10]
    export_clean_skill(r'd2data\data\global\missiles\FrostNova.dcc', 'frost_nova.png', 100, 70, 50, 35, PAL3, order=order_16_frost, min_lum=25)
    
    # 2.5 Diablo Lightning (8 方向)
    export_clean_skill(r'd2data\data\global\missiles\DiabloLightning.dcc', 'diablo_lightning.png', 220, 160, 110, 80, PAL4, min_lum=26)
    
    # 2.6 Baal Cold Wave (8 方向)
    export_clean_skill(r'd2exp\data\global\missiles\Expansion\baalmissile.dcc', 'baal_cold_wave.png', 220, 160, 110, 80, PAL5, min_lum=25)
    
    # 2.7 Charged Bolt (16 方向)
    export_clean_skill(r'd2data\data\global\missiles\ChargedBolt.dcc', 'charged_bolt.png', 80, 80, 40, 40, PAL3, min_lum=26)
    
    # 2.8 Shaman Fireball
    export_clean_skill(r'd2data\data\global\missiles\shamanfireball.dcc', 'shaman_fireball.png', 70, 50, 35, 25, PAL1, min_lum=25)
    
    # 2.9 Unholy Bolt (魅魔血之星)
    export_clean_skill(r'd2data\data\global\missiles\UnholyBolt.dcc', 'unholy_bolt.png', 80, 50, 40, 25, PAL4, min_lum=25)
    
    # 2.10 Bone Spirit
    export_clean_skill(r'd2data\data\global\missiles\BoneSpirit.dcc', 'bone_spirit.png', 130, 130, 65, 65, PAL4, min_lum=26)
    
    # 2.11 Maggot Spit
    export_clean_skill(r'd2data\data\global\missiles\SandMaggotGooSpit.dcc', 'maggot_spit.png', 70, 60, 35, 30, PAL2, min_lum=25)

# ==========================================
# 3. 更新 Monsters Manifest 與 FX Manifest
# ==========================================
def update_manifests():
    print("=== [3/4] Updating Manifests ===")
    
    # Monsters Manifest
    p_m_json = os.path.join(MONSTERS_DIR, 'monsters_manifest.json')
    p_m_js = os.path.join(MONSTERS_DIR, 'monsters_manifest.js')
    with open(p_m_json, 'r', encoding='utf-8') as f:
        monsters = json.load(f)
        
    # Andariel cast
    monsters['andariel']['actions']['cast'] = {
        "file": "assets/monsters/andariel_cast.png",
        "directions": 8, "frames": 18, "cell_width": 220, "cell_height": 240, "anchor_x": 110, "anchor_y": 190
    }
    # Duriel cast & update death
    monsters['duriel']['actions']['cast'] = {
        "file": "assets/monsters/duriel_cast.png",
        "directions": 8, "frames": 15, "cell_width": 340, "cell_height": 280, "anchor_x": 170, "anchor_y": 180
    }
    monsters['duriel']['actions']['death'] = {
        "file": "assets/monsters/duriel_death.png",
        "directions": 8, "frames": 25, "cell_width": 340, "cell_height": 280, "anchor_x": 170, "anchor_y": 180
    }
    # Mephisto cast
    monsters['mephisto']['actions']['cast'] = {
        "file": "assets/monsters/mephisto_cast.png",
        "directions": 8, "frames": 15, "cell_width": 220, "cell_height": 240, "anchor_x": 110, "anchor_y": 190
    }
    # Diablo cast
    monsters['diablo']['actions']['cast'] = {
        "file": "assets/monsters/diablo_cast.png",
        "directions": 8, "frames": 17, "cell_width": 350, "cell_height": 280, "anchor_x": 175, "anchor_y": 175
    }
    # Baal cast
    monsters['baal']['actions']['cast'] = {
        "file": "assets/monsters/baal_cast.png",
        "directions": 8, "frames": 19, "cell_width": 240, "cell_height": 240, "anchor_x": 120, "anchor_y": 190
    }
    
    with open(p_m_json, 'w', encoding='utf-8') as f:
        json.dump(monsters, f, indent=2, ensure_ascii=False)
    with open(p_m_js, 'w', encoding='utf-8') as f:
        f.write("window.D2_MONSTERS_MANIFEST = " + json.dumps(monsters, indent=2, ensure_ascii=False) + ";\n")
    print("  [OK] monsters_manifest updated with 5 Act Boss cast actions & fixed Duriel death!")
    
    # FX Manifest
    p_fx_json = os.path.join(FX_DIR, 'fx_manifest.json')
    p_fx_js = os.path.join(FX_DIR, 'fx_manifest.js')
    with open(p_fx_json, 'r', encoding='utf-8') as f:
        fx_data = json.load(f)
        
    fx_data['skills']['aura_freeze'] = {
        "name": "aura_freeze_sheet",
        "file": "assets/fx/aura_freeze_sheet.png",
        "directions": 1,
        "frames": 15,
        "cell_width": 160,
        "cell_height": 120,
        "pivot_x": 80,
        "pivot_y": 60
    }
    
    with open(p_fx_json, 'w', encoding='utf-8') as f:
        json.dump(fx_data, f, indent=2, ensure_ascii=False)
    with open(p_fx_js, 'w', encoding='utf-8') as f:
        f.write("window.D2_FX_MANIFEST = " + json.dumps(fx_data, indent=2, ensure_ascii=False) + ";\n")
    print("  [OK] fx_manifest updated with clean aura_freeze!")

if __name__ == '__main__':
    export_boss_animations()
    export_all_clean_skills()
    update_manifests()
    print("\n[FINISHED] All Boss animations, clean skills, and manifest updates completed successfully!")
