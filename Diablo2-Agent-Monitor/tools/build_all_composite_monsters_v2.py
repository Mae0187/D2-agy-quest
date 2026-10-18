import os
import sys
import json
import struct
from PIL import Image

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.normpath(os.path.join(SCRIPT_DIR, '..'))
TOOLS_DIR = SCRIPT_DIR
OUT_MONSTERS_DIR = os.path.join(PROJECT_DIR, 'web', 'assets', 'monsters')
os.makedirs(OUT_MONSTERS_DIR, exist_ok=True)

sys.path.append(TOOLS_DIR)
from dcc_to_png import DCCDecoder, load_palette
from dc6_to_png import decode_dc6_frame

PAL1 = load_palette(os.path.join(PROJECT_DIR, 'tools', 'mpq_raw', 'd2data', 'data', 'global', 'palette', 'ACT1', 'pal.dat'), brightness_boost=1.35)
PAL2 = load_palette(os.path.join(PROJECT_DIR, 'tools', 'mpq_raw', 'd2data', 'data', 'global', 'palette', 'ACT2', 'pal.dat'), brightness_boost=1.35)
PAL3 = load_palette(os.path.join(PROJECT_DIR, 'tools', 'mpq_raw', 'd2data', 'data', 'global', 'palette', 'ACT3', 'pal.dat'), brightness_boost=1.35)
PAL4 = load_palette(os.path.join(PROJECT_DIR, 'tools', 'mpq_raw', 'd2data', 'data', 'global', 'palette', 'ACT4', 'pal.dat'), brightness_boost=1.35)
PAL5 = load_palette(os.path.join(PROJECT_DIR, 'tools', 'mpq_raw', 'd2exp', 'data', 'global', 'palette', 'ACT5', 'pal.dat'), brightness_boost=1.35)

def export_dcc_composite(base_dir, parts_cfg, actions, palette, out_prefix, cell_w, cell_h, anchor_x, anchor_y):
    """
    通用多部件 DCC 複合組裝渲染器
    parts_cfg: list of (part_name, fn_template)
    actions: dict of action_name -> suffix
    """
    results = {}
    for act_name, suffix in actions.items():
        decoders = []
        for p_name, fn_template in parts_cfg:
            fn = fn_template.format(suffix=suffix)
            fp = os.path.join(base_dir, p_name, fn)
            if os.path.exists(fp):
                decoders.append((p_name, DCCDecoder(fp)))
        
        if not decoders:
            print(f"[WARN] No decoders found for {out_prefix} {act_name}")
            continue
            
        dirs = decoders[0][1].directions
        fpd = max(d[1].frames_per_dir for d in decoders)
        sheet_w = cell_w * fpd
        sheet_h = cell_h * dirs
        sheet = Image.new('RGBA', (sheet_w, sheet_h), (0, 0, 0, 0))
        
        for d in range(dirs):
            for f in range(fpd):
                dst_cell_x = f * cell_w
                dst_cell_y = d * cell_h
                
                for p_name, dec in decoders:
                    dir_frames = dec.decode_direction(d)
                    if not dir_frames:
                        continue
                    fr = dir_frames[min(f, len(dir_frames) - 1)]
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
                                r, g, b, _ = palette[idx]
                                frame_img.putpixel((x, y), (r, g, b, 255))
                    dst_x = dst_cell_x + anchor_x + fr['x_offset']
                    dst_y = dst_cell_y + anchor_y + fr['y_offset'] - fh + 1
                    sheet.paste(frame_img, (dst_x, dst_y), frame_img)
                    
        out_fn = f"{out_prefix}_{act_name}.png"
        out_path = os.path.join(OUT_MONSTERS_DIR, out_fn)
        sheet.save(out_path)
        print(f"  [{out_prefix.upper()}] {out_fn} saved ({sheet_w}x{sheet_h}, {dirs} dirs x {fpd} frames)")
        results[act_name] = {
            "file": f"assets/monsters/{out_fn}",
            "directions": dirs,
            "frames": fpd,
            "cell_width": cell_w,
            "cell_height": cell_h,
            "anchor_x": anchor_x,
            "anchor_y": anchor_y
        }
    return results

def export_composite_mephisto_fixed():
    """重新導出墨菲斯托 (修復 DC6 垂直翻轉)"""
    print("\n--- [1/7] Re-exporting Mephisto Boss (MP: TR+LA+RA - Upright Orientation) ---")
    mp_dir = os.path.join(PROJECT_DIR, 'tools', 'mpq_raw', 'd2data', 'data', 'global', 'monsters', 'MP')
    
    actions = {
        'idle': ('NUHTH', 'mephisto_idle.png'),
        'walk': ('WLHTH', 'mephisto_walk.png'),
        'attack': ('A1HTH', 'mephisto_attack.png'),
        'hit': ('GHHTH', 'mephisto_hit.png'),
        'death': ('DTHTH', 'mephisto_death.png')
    }
    
    cell_w, cell_h = 220, 240
    anchor_x, anchor_y = 110, 190
    results = {}
    
    parts = ['TR', 'LA', 'RA']
    for act_name, (suffix, out_fn) in actions.items():
        dc6_datas = []
        for p in parts:
            fn = f"MP{p}LIT{suffix}.DC6"
            fp = os.path.join(mp_dir, p, fn)
            with open(fp, 'rb') as f:
                data = f.read()
            dirs = struct.unpack_from('<I', data, 16)[0]
            fpd = struct.unpack_from('<I', data, 20)[0]
            dc6_datas.append((p, data, dirs, fpd))
            
        dirs = dc6_datas[0][2]
        fpd = dc6_datas[0][3]
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
                    
        out_path = os.path.join(OUT_MONSTERS_DIR, out_fn)
        sheet.save(out_path)
        print(f"  [MEPHISTO FIXED] {out_fn} saved ({sheet_w}x{sheet_h}, {dirs} dirs x {fpd} frames)")
        results[act_name] = {
            "file": f"assets/monsters/{out_fn}",
            "directions": dirs,
            "frames": fpd,
            "cell_width": cell_w,
            "cell_height": cell_h,
            "anchor_x": anchor_x,
            "anchor_y": anchor_y
        }
    return results

def main():
    print("==================================================================")
    print(" Diablo II Full Multi-Component Monsters Exporter V2            ")
    print("==================================================================")
    base_m = os.path.join(PROJECT_DIR, 'tools', 'mpq_raw', 'd2data', 'data', 'global', 'monsters')
    
    # 載入現有 manifest
    manifest_path = os.path.join(PROJECT_DIR, 'web', 'assets', 'monsters', 'monsters_manifest.json')
    with open(manifest_path, 'r', encoding='utf-8') as f:
        manifest = json.load(f)
        
    # 1. 墨菲斯托 (修正上下顛倒)
    manifest["mephisto"]["actions"] = export_composite_mephisto_fixed()
    
    # 2. 殭屍 (Zombie - ZM) 5 部件完全體 (LG, TR, HD, LA, RA)
    print("\n--- [2/7] Reassembling Complete Zombie (ZM: LG+TR+HD+LA+RA) ---")
    zm_dir = os.path.join(base_m, 'ZM')
    zm_parts = [
        ('LG', 'ZMLGHVY{suffix}.dcc'),
        ('TR', 'ZMTRLIT{suffix}.dcc'),
        ('HD', 'ZMHDHVY{suffix}.dcc'),
        ('LA', 'ZMLAHVY{suffix}.dcc'),
        ('RA', 'ZMRAHVY{suffix}.dcc'),
    ]
    zm_actions = {
        'idle': 'NUHTH',
        'walk': 'WLHTH',
        'attack': 'A1HTH',
        'hit': 'GHHTH',
        'death': 'DTHTH'
    }
    manifest["zombie"]["actions"] = export_dcc_composite(zm_dir, zm_parts, zm_actions, PAL1, 'zombie', 140, 130, 70, 95)
    
    # 3. 沉淪魔 (Fallen - FA) 3 部件完全體 (TR, SH, RH)
    print("\n--- [3/7] Reassembling Complete Fallen (FA: TR+SH+RH) ---")
    fa_dir = os.path.join(base_m, 'FA')
    fa_parts = [
        ('TR', 'FATRLIT{suffix}.dcc'),
        ('SH', 'FASHBUC{suffix}.dcc'),
        ('RH', 'FARHAXE{suffix}.dcc'),
    ]
    fa_actions = {
        'idle': 'NUHTH',
        'walk': 'WLHTH',
        'attack': 'A1HTH',
        'hit': 'GHHTH',
        'death': 'DTHTH'
    }
    manifest["fallen"]["actions"] = export_dcc_composite(fa_dir, fa_parts, fa_actions, PAL1, 'fallen', 110, 110, 55, 80)
    
    # 4. 末日騎士 (Doom Knight - DM) 2 部件完全體 (TR, RH 雙手焰形巨劍)
    print("\n--- [4/7] Reassembling Complete Doom Knight (DM: TR+RH Flamberge) ---")
    dm_dir = os.path.join(base_m, 'DM')
    dm_parts = [
        ('TR', 'DMTRLIT{suffix}.dcc'),
        ('RH', 'DMRHFLB{suffix}.dcc'),
    ]
    dm_actions = {
        'idle': 'NUHTH',
        'walk': 'WLHTH',
        'attack': 'A1HTH',
        'hit': 'GHHTH',
        'death': 'DTHTH'
    }
    manifest["doom_knight"]["actions"] = export_dcc_composite(dm_dir, dm_parts, dm_actions, PAL4, 'doom_knight', 240, 220, 120, 145)
    
    # 5. 崔凡克小矮人 (Fetish - FE) 2 部件 (TR, Rh 吹箭/匕首)
    print("\n--- [5/7] Exporting Fetish (FE: TR+Rh Dagger) ---")
    fe_dir = os.path.join(base_m, 'FE')
    fe_parts = [
        ('TR', 'FETRLIT{suffix}.dcc'),
        ('Rh', 'FERHFBL{suffix}.dcc')
    ]
    fe_actions = {
        'idle': 'NU1HS',
        'walk': 'WL1HS',
        'attack': 'A11HS',
        'hit': 'GH1HS',
        'death': 'DTHTH' # FE 死亡時直接散落
    }
    fe_exported = export_dcc_composite(fe_dir, fe_parts, fe_actions, PAL3, 'fetish', 110, 110, 55, 75)
    manifest["fetish"] = {
        "name": "Fetish (崔凡克小矮人)",
        "type": "minion",
        "act": 3,
        "max_hp": 30,
        "actions": fe_exported
    }
    
    # 6. 巨型沙蟲 (Sand Maggot - SM)
    print("\n--- [6/7] Exporting Sand Maggot (SM: TR) ---")
    sm_dir = os.path.join(base_m, 'SM')
    sm_parts = [
        ('TR', 'SMTRLIT{suffix}.dcc')
    ]
    sm_actions = {
        'idle': 'NUHTH',
        'walk': 'WLHTH',
        'attack': 'A1HTH',
        'hit': 'GHHTH',
        'death': 'DTHTH'
    }
    sm_exported = export_dcc_composite(sm_dir, sm_parts, sm_actions, PAL2, 'sand_maggot', 200, 180, 100, 110)
    manifest["sand_maggot"] = {
        "name": "Sand Maggot (巨型沙蟲)",
        "type": "minion",
        "act": 2,
        "max_hp": 70,
        "actions": sm_exported
    }
    
    # 7. 血之王 / 月亮之王 (Blood Lord - MO: TR + S1 雙斧牛頭魔)
    print("\n--- [7/7] Exporting Blood Lord (MO: TR+S1 Axes) ---")
    mo_dir = os.path.join(base_m, 'MO')
    mo_parts = [
        ('TR', 'MOTRLIT{suffix}.dcc'),
        ('s1', 'MOS1LIT{suffix}.dcc')
    ]
    mo_actions = {
        'idle': 'NUHTH',
        'walk': 'WLHTH',
        'attack': 'A1HTH',
        'hit': 'GHHTH',
        'death': 'DTHTH'
    }
    mo_exported = export_dcc_composite(mo_dir, mo_parts, mo_actions, PAL5, 'blood_lord', 220, 200, 110, 130)
    manifest["blood_lord"] = {
        "name": "Blood Lord (血之王)",
        "type": "minion",
        "act": 5,
        "max_hp": 90,
        "actions": mo_exported
    }
    
    # 儲存 manifest
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
        
    manifest_js_path = os.path.join(PROJECT_DIR, 'web', 'assets', 'monsters', 'monsters_manifest.js')
    with open(manifest_js_path, 'w', encoding='utf-8') as f:
        f.write("window.D2_MONSTERS_MANIFEST = ")
        json.dump(manifest, f, indent=2, ensure_ascii=False)
        f.write(";\n")
        
    print("\n[SUCCESS] All composite monsters & new act roster generated successfully!")
    print(f"Total authentic monsters/bosses in roster: {len(manifest)}")
    for k, v in manifest.items():
        print(f"  - {k:15s}: {v['name']} ({v['type']}, Act {v.get('act', 1)})")

if __name__ == '__main__':
    main()
