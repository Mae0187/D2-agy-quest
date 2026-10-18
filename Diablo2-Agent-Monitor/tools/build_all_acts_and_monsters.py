"""
Build All Authentic Act Monsters, Bosses (Act 1 ~ Act 5) and Tiles
Generates:
1. Reassembled Composite Skeleton Warrior (SK: LG, TR, HD, LA, RA, SH, RH)
2. Assembled Composite Mephisto Boss (MP: TR, LA, RA) - Act 3 Final Boss
3. Assembled Composite Baal Boss (42: LG, TR, HD, LA, RA, S1 + DTHTH) - Act 5 Final Boss
4. Assembled Composite Minion of Destruction (43: LG, TR, HD, LA, RA, S1) - Act 5 Minion
5. Act 5 Throne of Destruction Dungeon Tile (throne_bg.png)
6. Updates monsters_manifest.js & monsters_manifest.json with all 15 authentic entities
"""
import os
import sys
import json
import struct
import random
from PIL import Image
import numpy as np

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.normpath(os.path.join(SCRIPT_DIR, '..'))
TOOLS_DIR = SCRIPT_DIR
OUT_MONSTERS_DIR = os.path.join(PROJECT_DIR, 'web', 'assets', 'monsters')
OUT_DUNGEON_DIR = os.path.join(PROJECT_DIR, 'web', 'assets', 'dungeon')
os.makedirs(OUT_MONSTERS_DIR, exist_ok=True)
os.makedirs(OUT_DUNGEON_DIR, exist_ok=True)

sys.path.append(TOOLS_DIR)
from dcc_to_png import DCCDecoder, load_palette
from dc6_to_png import decode_dc6_frame

PAL1 = load_palette(os.path.join(PROJECT_DIR, 'tools', 'mpq_raw', 'd2data', 'data', 'global', 'palette', 'ACT1', 'pal.dat'), brightness_boost=1.35)
PAL3 = load_palette(os.path.join(PROJECT_DIR, 'tools', 'mpq_raw', 'd2data', 'data', 'global', 'palette', 'ACT3', 'pal.dat'), brightness_boost=1.35)
PAL5 = load_palette(os.path.join(PROJECT_DIR, 'tools', 'mpq_raw', 'd2exp', 'data', 'global', 'palette', 'ACT5', 'pal.dat'), brightness_boost=1.35)

# ==========================================
# 1. 骷髏戰士 (SKELETON) 完整 7 部件複合裝配
# ==========================================
def export_composite_skeleton():
    print("\n--- [1/5] Reassembling Complete Skeleton Warrior (SK) ---")
    sk_dir = os.path.join(PROJECT_DIR, 'tools', 'mpq_raw', 'd2data', 'data', 'global', 'monsters', 'SK')
    
    actions = {
        'idle': {
            'parts': {
                'LG': 'SKLGLITNU1HS.dcc',
                'TR': 'SKTRLITNU1HS.dcc',
                'HD': 'SKHDLITNU1HS.dcc',
                'LA': 'SKLALITNU1HS.dcc',
                'RA': 'SKRALITNU1HS.dcc',
                'SH': 'SKSHBUCNU1HS.dcc',
                'RH': 'SKRHSCMNU1HS.dcc'
            },
            'file': 'skeleton_idle.png'
        },
        'walk': {
            'parts': {
                'LG': 'SKLGLITWL1HS.dcc',
                'TR': 'SKTRLITWL1HS.dcc',
                'HD': 'SKHDLITWL1HS.dcc',
                'LA': 'SKLALITWL1HS.dcc',
                'RA': 'SKRALITWL1HS.dcc',
                'SH': 'SKSHBUCWL1HS.dcc',
                'RH': 'SKRHAXEWL1HS.dcc'
            },
            'file': 'skeleton_walk.png'
        },
        'attack': {
            'parts': {
                'LG': 'SKLGLITA11HS.dcc',
                'TR': 'SKTRLITA11HS.dcc',
                'HD': 'SKHDLITA11HS.dcc',
                'LA': 'SKLALITA11HS.dcc',
                'RA': 'SKRALITA11HS.dcc',
                'SH': 'SKSHBUCA11HS.dcc',
                'RH': 'SKRHAXEA11HS.dcc'
            },
            'file': 'skeleton_attack.png'
        },
        'hit': {
            'parts': {
                'LG': 'SKLGLITGH1HS.dcc',
                'TR': 'SKTRLITGH1HS.dcc',
                'HD': 'SKHDLITGH1HS.dcc',
                'LA': 'SKLALITGH1HS.dcc',
                'RA': 'SKRALITGH1HS.dcc',
                'SH': 'SKSHBUCGH1HS.dcc',
                'RH': 'SKRHAXEGH1HS.dcc'
            },
            'file': 'skeleton_hit.png'
        },
        'death': {
            'parts': {
                'LG': 'SKLGLITDT1HS.dcc',
                'TR': 'SKTRLITDT1HS.dcc',
                'HD': 'SKHDLITDT1HS.dcc',
                'LA': 'SKLALITDT1HS.dcc',
                'RA': 'SKRALITDT1HS.dcc',
                'SH': 'SKSHLRGDT1HS.dcc',
                'RH': 'SKRHAXEDT1HS.dcc'
            },
            'file': 'skeleton_death.png'
        }
    }
    
    cell_w, cell_h = 140, 120
    anchor_x, anchor_y = 70, 95
    results = {}
    
    order = ['LG', 'TR', 'HD', 'LA', 'RA', 'SH', 'RH']
    for act_name, cfg in actions.items():
        decoders = []
        for p in order:
            fn = cfg['parts'].get(p)
            if fn:
                fp = os.path.join(sk_dir, p, fn)
                if os.path.exists(fp):
                    decoders.append((p, DCCDecoder(fp)))
        
        dirs = decoders[0][1].directions
        fpd = max(d[1].frames_per_dir for d in decoders)
        
        sheet_w = cell_w * fpd
        sheet_h = cell_h * dirs
        sheet = Image.new('RGBA', (sheet_w, sheet_h), (0, 0, 0, 0))
        
        for d in range(dirs):
            for f_idx in range(fpd):
                dst_cell_x = f_idx * cell_w
                dst_cell_y = d * cell_h
                
                for p_name, dec in decoders:
                    dir_frames = dec.decode_direction(d)
                    if not dir_frames:
                        continue
                    fr = dir_frames[min(f_idx, len(dir_frames) - 1)]
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
                                r, g, b, _ = PAL1[idx]
                                frame_img.putpixel((x, y), (r, g, b, 255))
                    dst_x = dst_cell_x + anchor_x + fr['x_offset']
                    dst_y = dst_cell_y + anchor_y + fr['y_offset'] - fh + 1
                    sheet.paste(frame_img, (dst_x, dst_y), frame_img)
                    
        out_path = os.path.join(OUT_MONSTERS_DIR, cfg['file'])
        sheet.save(out_path)
        print(f"  [SKELETON] {cfg['file']} saved ({sheet_w}x{sheet_h}, {dirs} dirs x {fpd} frames)")
        results[act_name] = {
            "file": f"assets/monsters/{cfg['file']}",
            "directions": dirs,
            "frames": fpd,
            "cell_width": cell_w,
            "cell_height": cell_h,
            "anchor_x": anchor_x,
            "anchor_y": anchor_y
        }
    return results

# ==========================================
# 2. 墨菲斯托 (MEPHISTO) 複合裝配 (TR + LA + RA)
# ==========================================
def export_composite_mephisto():
    print("\n--- [2/5] Exporting Mephisto Boss (MP: TR+LA+RA) ---")
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
        print(f"  [MEPHISTO] {out_fn} saved ({sheet_w}x{sheet_h}, {dirs} dirs x {fpd} frames)")
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

# ==========================================
# 3. 巴爾 (BAAL) 6 部件複合裝配 (TR+HD+LG+RA+LA+S1)
# ==========================================
def export_composite_baal():
    print("\n--- [3/5] Exporting Baal Boss (42: TR+HD+LG+RA+LA+S1) ---")
    baal_dir = os.path.join(PROJECT_DIR, 'tools', 'mpq_raw', 'd2exp', 'data', 'global', 'monsters', '42')
    
    actions_dcc = {
        'idle': ('NUHTH', 'baal_idle.png'),
        'walk': ('WLHTH', 'baal_walk.png'),
        'attack': ('A1HTH', 'baal_attack.png'),
        'hit': ('GHHTH', 'baal_hit.png')
    }
    
    cell_w, cell_h = 240, 240
    anchor_x, anchor_y = 120, 190
    results = {}
    
    parts = ['lg', 'tr', 'hd', 'la', 'ra', 's1']
    for act_name, (suffix, out_fn) in actions_dcc.items():
        decoders = []
        for p in parts:
            fn = f"42{p.upper()}LIT{suffix}.dcc" if p != 'hd' else f"42HDLit{suffix}.dcc"
            fp = os.path.join(baal_dir, p, fn)
            if os.path.exists(fp):
                decoders.append((p, DCCDecoder(fp)))
        
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
                                r, g, b, _ = PAL5[idx]
                                frame_img.putpixel((x, y), (r, g, b, 255))
                    dst_x = dst_cell_x + anchor_x + fr['x_offset']
                    dst_y = dst_cell_y + anchor_y + fr['y_offset'] - fh + 1
                    sheet.paste(frame_img, (dst_x, dst_y), frame_img)
                    
        out_path = os.path.join(OUT_MONSTERS_DIR, out_fn)
        sheet.save(out_path)
        print(f"  [BAAL] {out_fn} saved ({sheet_w}x{sheet_h}, {dirs} dirs x {fpd} frames)")
        results[act_name] = {
            "file": f"assets/monsters/{out_fn}",
            "directions": dirs,
            "frames": fpd,
            "cell_width": cell_w,
            "cell_height": cell_h,
            "anchor_x": anchor_x,
            "anchor_y": anchor_y
        }
        
    # Baal Death: 42TRLITDTHTH.DC6 + 42HDLitDTHTH.DC6 + 42S6LITDTHTH.DC6 (sample 25 frames, broadcast to 8 dirs)
    death_parts = ['tr', 'hd', 's6']
    death_datas = []
    for p in death_parts:
        fn = f"42{p.upper()}LITDTHTH.DC6" if p != 'hd' else "42HDLitDTHTH.DC6"
        fp = os.path.join(baal_dir, p, fn)
        with open(fp, 'rb') as f:
            death_datas.append(f.read())
            
    fpd_death = 25
    sample_indices = [int(i * 199 / (fpd_death - 1)) for i in range(fpd_death)]
    sheet_w = cell_w * fpd_death
    sheet_h = cell_h * 8
    death_sheet = Image.new('RGBA', (sheet_w, sheet_h), (0, 0, 0, 0))
    
    # First build direction 0 (the original Blizzard 1-dir death sequence)
    dir0_frames = []
    for f_idx, orig_frame in enumerate(sample_indices):
        frame_canvas = Image.new('RGBA', (cell_w, cell_h), (0, 0, 0, 0))
        for data in death_datas:
            off = struct.unpack_from('<I', data, 24 + orig_frame * 4)[0]
            info, pixels = decode_dc6_frame(data, off)
            if not info or not pixels:
                continue
            w, h = info['width'], info['height']
            ox, oy = info['offset_x'], info['offset_y']
            if w == 0 or h == 0:
                continue
            f_img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
            for y in range(h):
                for x in range(w):
                    idx = pixels[y * w + x]
                    if idx != 0:
                        r, g, b, _ = PAL5[idx]
                        f_img.putpixel((x, y), (r, g, b, 255))
            dst_x = anchor_x + ox
            dst_y = anchor_y + oy - h + 1
            frame_canvas.paste(f_img, (dst_x, dst_y), f_img)
        dir0_frames.append(frame_canvas)
        
    # Broadcast to all 8 directions so direction indexing is 100% crash-free
    for d in range(8):
        for f in range(fpd_death):
            death_sheet.paste(dir0_frames[f], (f * cell_w, d * cell_h), dir0_frames[f])
            
    death_out_path = os.path.join(OUT_MONSTERS_DIR, 'baal_death.png')
    death_sheet.save(death_out_path)
    print(f"  [BAAL] baal_death.png saved ({sheet_w}x{sheet_h}, 8 dirs x {fpd_death} frames)")
    results['death'] = {
        "file": "assets/monsters/baal_death.png",
        "directions": 8,
        "frames": fpd_death,
        "cell_width": cell_w,
        "cell_height": cell_h,
        "anchor_x": anchor_x,
        "anchor_y": anchor_y
    }
    return results

# ==========================================
# 4. 毀滅之僕 (MINION OF DESTRUCTION - 43)
# ==========================================
def export_composite_baal_minion():
    print("\n--- [4/5] Exporting Minion of Destruction (43: TR+HD+LG+RA+LA+S1) ---")
    m43_dir = os.path.join(PROJECT_DIR, 'tools', 'mpq_raw', 'd2exp', 'data', 'global', 'monsters', '43')
    
    actions = {
        'idle': ('NUHTH', 'baal_minion_idle.png'),
        'walk': ('WLHTH', 'baal_minion_walk.png'),
        'attack': ('A1HTH', 'baal_minion_attack.png'),
        'hit': ('GHHTH', 'baal_minion_hit.png'),
        'death': ('DTHTH', 'baal_minion_death.png')
    }
    
    cell_w, cell_h = 180, 180
    anchor_x, anchor_y = 90, 135
    results = {}
    
    parts = ['lg', 'tr', 'hd', 'la', 'ra', 's1']
    for act_name, (suffix, out_fn) in actions.items():
        decoders = []
        for p in parts:
            fn = f"43{p.upper()}LIT{suffix}.dcc" if p != 'hd' else f"43HDLit{suffix}.dcc"
            fp = os.path.join(m43_dir, p, fn)
            if os.path.exists(fp):
                decoders.append((p, DCCDecoder(fp)))
                
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
                                r, g, b, _ = PAL5[idx]
                                frame_img.putpixel((x, y), (r, g, b, 255))
                    dst_x = dst_cell_x + anchor_x + fr['x_offset']
                    dst_y = dst_cell_y + anchor_y + fr['y_offset'] - fh + 1
                    sheet.paste(frame_img, (dst_x, dst_y), frame_img)
                    
        out_path = os.path.join(OUT_MONSTERS_DIR, out_fn)
        sheet.save(out_path)
        print(f"  [MINION 43] {out_fn} saved ({sheet_w}x{sheet_h}, {dirs} dirs x {fpd} frames)")
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

# ==========================================
# 5. 第 5 幕 毀滅王座 (THRONE_BG.PNG) 無縫地磚生成
# ==========================================
def build_throne_dungeon_bg():
    print("\n--- [5/5] Building Act 5 Throne of Destruction Dungeon Background ---")
    tile_source = os.path.join(PROJECT_DIR, 'assets', 'acts', 'act5', 'tiles_sprites', "Baal's Temple Floor.png")
    im = Image.open(tile_source).convert('RGBA')
    arr = np.array(im)
    rows = im.size[1] // 80
    cols = im.size[0] // 160
    
    clean_tiles = []
    for r in range(rows):
        for c in range(cols):
            patch = arr[r*80:(r+1)*80, c*160:(c+1)*160].copy()
            is_mag = (patch[:, :, 0] > 180) & (patch[:, :, 1] < 60) & (patch[:, :, 2] > 180)
            is_white = (patch[:, :, 0] > 230) & (patch[:, :, 1] > 230) & (patch[:, :, 2] > 230)
            if is_white.sum() > 6:
                continue
            non_bg = patch[(~is_mag) & (~is_white)]
            if len(non_bg) < 5600:
                continue
            patch[is_mag] = [0, 0, 0, 0]
            patch[is_white] = [0, 0, 0, 0]
            clean_tiles.append(Image.fromarray(patch, 'RGBA'))
            
    print(f"  Extracted {len(clean_tiles)} pure 160x80 Baal Throne diamond tiles.")
    
    # 2.5D Isometric Diamond Tessellation (800x600 canvas)
    random.seed(42)
    canvas = Image.new('RGBA', (800, 600), (12, 10, 16, 255))
    tile_map = {}
    for ry in range(-2, 20):
        for rx in range(-3, 10):
            used_neighbors = set()
            for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                n_key = (rx + dx, ry + dy)
                if n_key in tile_map:
                    used_neighbors.add(tile_map[n_key])
            avail = [i for i in range(len(clean_tiles)) if i not in used_neighbors]
            chosen = random.choice(avail) if avail else random.randint(0, len(clean_tiles) - 1)
            tile_map[(rx, ry)] = chosen
            
            x = (rx - ry) * 80 + 320
            y = (rx + ry) * 40 - 40
            if -160 <= x <= 800 and -80 <= y <= 600:
                tile = clean_tiles[chosen]
                canvas.paste(tile, (x, y), tile)
                
    out_path = os.path.join(OUT_DUNGEON_DIR, 'throne_bg.png')
    canvas.save(out_path)
    print(f"  [THRONE] Saved {out_path} (800x600)")

# ==========================================
# 6. 主程式：執行導出並構建全量 Manifest
# ==========================================
def main():
    print("==================================================================")
    print(" Diablo II Multi-Act Complete Monsters & Prime Evils Exporter    ")
    print("==================================================================")
    
    # 載入現有 manifest
    manifest_path = os.path.join(PROJECT_DIR, 'web', 'assets', 'monsters', 'monsters_manifest.json')
    with open(manifest_path, 'r', encoding='utf-8') as f:
        manifest = json.load(f)
        
    # 1. 替換 Skeleton 為 7 部件完全體
    sk_actions = export_composite_skeleton()
    manifest["skeleton"]["actions"] = sk_actions
    
    # 2. 導出 Mephisto
    mp_actions = export_composite_mephisto()
    manifest["mephisto"] = {
        "name": "Mephisto (墨菲斯托)",
        "title": "MEPHISTO — THE LORD OF HATRED",
        "type": "boss",
        "act": 3,
        "max_hp": 500,
        "actions": mp_actions
    }
    
    # 3. 導出 Baal
    baal_actions = export_composite_baal()
    manifest["baal"] = {
        "name": "Baal (巴爾)",
        "title": "BAAL — THE LORD OF DESTRUCTION",
        "type": "boss",
        "act": 5,
        "max_hp": 700,
        "actions": baal_actions
    }
    
    # 4. 導出 Minion of Destruction
    m43_actions = export_composite_baal_minion()
    manifest["baal_minion"] = {
        "name": "Minion of Destruction (毀滅之僕)",
        "type": "minion",
        "act": 5,
        "max_hp": 85,
        "actions": m43_actions
    }
    
    # 5. 生成 Act 5 毀滅王座地磚
    build_throne_dungeon_bg()
    
    # 6. 寫回 JSON 與 JS Manifest
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
        
    manifest_js_path = os.path.join(PROJECT_DIR, 'web', 'assets', 'monsters', 'monsters_manifest.js')
    with open(manifest_js_path, 'w', encoding='utf-8') as f:
        f.write("window.D2_MONSTERS_MANIFEST = ")
        json.dump(manifest, f, indent=2, ensure_ascii=False)
        f.write(";\n")
        
    print("\n[SUCCESS] monsters_manifest.json and monsters_manifest.js updated successfully!")
    print(f"Total authentic monsters/bosses in roster: {len(manifest)}")
    for k, v in manifest.items():
        print(f"  - {k}: {v['name']} ({v['type']}, Act {v['act']})")

if __name__ == '__main__':
    main()
