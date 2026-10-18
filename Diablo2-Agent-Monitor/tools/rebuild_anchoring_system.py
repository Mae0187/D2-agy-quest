#!/usr/bin/env python3
"""
rebuild_anchoring_system.py
全面重構 Diablo II 錨定系統 (Ground Anchoring System)
1. 亞馬遜 (Amazon) 16 方向複合式標槍戳刺 (A11HT) 圖集生成 (Root, Light, Medium, Heavy)
2. 死靈法師 (Necromancer) 16 方向匕首刺擊 (A11HS) DCC 複合圖集生成 (修復南向浮空，Root, Light, Medium, Heavy)
3. 召喚物與夥伴 (Bear, Wolf, Clay Golem, Iron Golem, Fire Golem, Skeleton) 精確地表接地重建模組：
   - 修正 paste_y = anchor_y + y_offset - height + 1 (徹底根除 y_offset 反向導致的 23px 一跳一跳問題)
   - 統一 8 方向順序與 DCC_MAP 匹配
   - 自動同步 companions_manifest.js 與 companions_manifest.json
"""
import sys, os, json, glob
from pathlib import Path
from PIL import Image

SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
SYS_TOOLS = SCRIPT_DIR
sys.path.insert(0, str(SYS_TOOLS))

from dcc_to_png import DCCDecoder, load_palette

PALETTE_PATH = SCRIPT_DIR / "mpq_raw/d2data/data/global/palette/ACT1/pal.dat"
pal = load_palette(str(PALETTE_PATH), brightness_boost=1.35)

# 16 方向順序映射 (COF 0..15 -> DCC 方向索引)
# COF 順時針從正南 (0) ➔ 西南 (2) ➔ 正西 (4) ➔ 正北 (8) ➔ 正東 (12) ➔ 東南 (14)
DCC_16_DIR_MAP = [4, 8, 0, 9, 5, 10, 1, 11, 6, 12, 2, 13, 7, 14, 3, 15]

# 8 方向順序 (Blizzard 原廠 DCC 8 向順序: 0=SW, 1=NW, 2=NE, 3=SE, 4=S, 5=W, 6=N, 7=E)
# 搭配 runtime DCC_MAP = [7, 3, 4, 0, 5, 1, 6, 2]
DCC_8_NATURAL = [0, 1, 2, 3, 4, 5, 6, 7]

def find_file_ci(parent_dir, filename):
    p = Path(parent_dir)
    if not p.exists():
        return None
    fl = filename.lower()
    for child in p.iterdir():
        if child.name.lower() == fl:
            return child
    return None

def update_manifest(target_dir, var_name, actions_to_update):
    json_path = target_dir / "manifest.json"
    js_path = target_dir / "manifest.js"
    
    mdata = {}
    if json_path.exists():
        with open(json_path, 'r', encoding='utf-8') as f:
            mdata = json.load(f)
            
    actions = mdata.get('actions', {})
    for ak, av in actions_to_update.items():
        actions[ak] = av
    mdata['actions'] = actions
    
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(mdata, f, ensure_ascii=False, indent=2)
        
    if var_name:
        with open(js_path, 'w', encoding='utf-8') as f:
            f.write(f"window.{var_name} = {json.dumps(mdata, ensure_ascii=False, indent=2)};\n")

def build_single_dcc_sheet(dcc_path, out_png, dir_map=DCC_8_NATURAL, pad=8):
    dec = DCCDecoder(str(dcc_path))
    num_dirs_raw = dec.directions
    actual_dirs = [d for d in dir_map if d < num_dirs_raw]
    
    # 計算全局包圍盒
    min_left, max_right = 9999, -9999
    min_top, max_bottom = 9999, -9999
    
    decoded_dirs = {}
    for d in actual_dirs:
        dfs = dec.decode_direction(d)
        decoded_dirs[d] = dfs
        for fr in dfs:
            fw, fh = fr['width'], fr['height']
            if fw == 0 or fh == 0: continue
            xo = fr['x_offset']
            yo = fr['y_offset']
            top = yo - fh + 1
            bottom = yo
            min_left = min(min_left, xo)
            max_right = max(max_right, xo + fw)
            min_top = min(min_top, top)
            max_bottom = max(max_bottom, bottom)
            
    cell_w = max_right - min_left + pad
    cell_h = max_bottom - min_top + pad
    anchor_x = -min_left + pad // 2
    anchor_y = -min_top + pad // 2
    
    fpd = dec.frames_per_dir
    num_out_dirs = len(actual_dirs)
    sheet = Image.new('RGBA', (cell_w * fpd, cell_h * num_out_dirs), (0, 0, 0, 0))
    
    for row_idx, d in enumerate(actual_dirs):
        dfs = decoded_dirs[d]
        for f_idx, fr in enumerate(dfs):
            fw, fh = fr['width'], fr['height']
            if fw == 0 or fh == 0: continue
            frame_img = Image.new('RGBA', (fw, fh), (0, 0, 0, 0))
            pixels = fr['pixels']
            for y in range(fh):
                src_y = (fh - 1 - y) if fr['bottom_up'] else y
                for x in range(fw):
                    idx = pixels[src_y * fw + x]
                    if idx:
                        frame_img.putpixel((x, y), (*pal[idx][:3], 255))
            
            dx = f_idx * cell_w + anchor_x + fr['x_offset']
            dy = row_idx * cell_h + anchor_y + fr['y_offset'] - fh + 1
            sheet.paste(frame_img, (dx, dy), frame_img)
            
    os.makedirs(os.path.dirname(out_png), exist_ok=True)
    sheet.save(out_png)
    return {
        "directions": num_out_dirs,
        "frames": fpd,
        "cell_width": cell_w,
        "cell_height": cell_h,
        "anchor_x": anchor_x,
        "anchor_y": anchor_y
    }

def composite_character_action(char_code, cof_path, parts_dict, out_png, dir_map=DCC_16_DIR_MAP, pad=8):
    with open(cof_path, 'rb') as f:
        cof_data = f.read()
    
    layers_cnt = cof_data[0]
    frames_cnt = cof_data[1]
    dirs_cnt = cof_data[2]
    fps = cof_data[3]
    total_priority_bytes = layers_cnt * frames_cnt * dirs_cnt
    priority_data = cof_data[-total_priority_bytes:]
    
    decoders = {}
    for code, dcc_path in parts_dict.items():
        if os.path.exists(dcc_path):
            decoders[code] = DCCDecoder(dcc_path)
            
    min_left, max_right = 9999, -9999
    min_top, max_bottom = 9999, -9999
    
    for cof_dir in range(dirs_cnt):
        dcc_dir = dir_map[cof_dir]
        for f in range(frames_cnt):
            for dec in decoders.values():
                dfs = dec.decode_direction(dcc_dir)
                if not dfs: continue
                fr = dfs[min(f, len(dfs) - 1)]
                fw, fh = fr['width'], fr['height']
                if fw == 0 or fh == 0: continue
                min_left = min(min_left, fr['x_offset'])
                max_right = max(max_right, fr['x_offset'] + fw)
                min_top = min(min_top, fr['y_offset'] - fh + 1)
                max_bottom = max(max_bottom, fr['y_offset'])
                
    cell_w = max_right - min_left + pad
    cell_h = max_bottom - min_top + pad
    anchor_x = -min_left + pad // 2
    anchor_y = -min_top + pad // 2
    
    sheet = Image.new('RGBA', (cell_w * frames_cnt, cell_h * dirs_cnt), (0, 0, 0, 0))
    
    for cof_dir in range(dirs_cnt):
        dcc_dir = dir_map[cof_dir]
        for frame in range(frames_cnt):
            dst_cell_x = frame * cell_w
            dst_cell_y = cof_dir * cell_h
            p_offset = (cof_dir * frames_cnt + frame) * layers_cnt
            p_layers = priority_data[p_offset : p_offset + layers_cnt]
            
            for code in p_layers:
                dec = decoders.get(code)
                if not dec: continue
                dfs = dec.decode_direction(dcc_dir)
                if not dfs: continue
                fr = dfs[min(frame, len(dfs) - 1)]
                fw, fh = fr['width'], fr['height']
                if fw == 0 or fh == 0: continue
                
                fimg = Image.new('RGBA', (fw, fh), (0, 0, 0, 0))
                for y in range(fh):
                    src_y = (fh - 1 - y) if fr['bottom_up'] else y
                    for x in range(fw):
                        idx = fr['pixels'][src_y * fw + x]
                        if idx:
                            fimg.putpixel((x, y), (*pal[idx][:3], 255))
                            
                dx = dst_cell_x + anchor_x + fr['x_offset']
                dy = dst_cell_y + anchor_y + fr['y_offset'] - fh + 1
                sheet.paste(fimg, (dx, dy), fimg)
                
    os.makedirs(os.path.dirname(out_png), exist_ok=True)
    sheet.save(out_png)
    return {
        "directions": dirs_cnt,
        "frames": frames_cnt,
        "cell_width": cell_w,
        "cell_height": cell_h,
        "anchor_x": anchor_x,
        "anchor_y": anchor_y,
        "fps": fps
    }

def main():
    print("==================================================")
    print("  Diablo II 全面錨定重構系統 (Anchoring Overhaul)  ")
    print("==================================================")
    
    # ------------------------------------------------------------
    # 1. 亞馬遜 (Amazon) 標槍戳刺 (A11HT)
    # ------------------------------------------------------------
    print("\n[1/3] 生成亞馬遜標槍戳刺 (A11HT)...")
    am_base = PROJECT_DIR / "assets/characters/amazon"
    am_cof = am_base / "COF/ama11ht.cof"
    
    for tier, tr_code, hd_code in [
        ('light', 'AMLGLITA11HT.dcc', 'AMHDLITA11HT.dcc'),
        ('medium', 'AMLGLITA11HT.dcc', 'AMHDLITA11HT.dcc'),
        ('heavy', 'AMLGHVYA11HT.dcc', 'AMHDLITA11HT.dcc')
    ]:
        tier_suffix = 'LIT' if tier == 'light' else ('HVY' if tier == 'heavy' else 'LIT')
        parts = {
            0: str(am_base / f"HD/{hd_code}"),
            1: str(am_base / f"TR/AMTR{tier_suffix}A11HT.dcc"),
            2: str(am_base / f"LG/AMLG{tier_suffix}A11HT.dcc"),
            3: str(am_base / f"RA/AMRA{tier_suffix}A11HT.dcc"),
            4: str(am_base / f"LA/AMLA{tier_suffix}A11HT.dcc"),
            5: str(am_base / "RH/AMRHJAVA11HT.dcc"),
            7: str(am_base / "SH/AMSHKITA11HT.dcc"),
            8: str(am_base / f"S1/AMS1{tier_suffix}A11HT.dcc"),
            9: str(am_base / f"S2/AMS2{tier_suffix}A11HT.dcc"),
        }
        
        target_dir = PROJECT_DIR / f"web/assets/characters/amazon/{tier}"
        out_spear = target_dir / "amazon_spear.png"
        out_attack = target_dir / "amazon_attack.png"
        meta = composite_character_action('AM', am_cof, parts, str(out_spear))
        
        # 複製至 amazon_attack.png (使近戰攻擊直接使用標槍動作)
        im = Image.open(out_spear)
        im.save(out_attack)
        
        if tier == 'light':
            # 同步更新根目錄 amazon
            root_dir = PROJECT_DIR / "web/assets/characters/amazon"
            im.save(root_dir / "amazon_spear.png")
            im.save(root_dir / "amazon_attack.png")
            
        print(f"  Amazon [{tier}]: cw={meta['cell_width']}, ch={meta['cell_height']}, ax={meta['anchor_x']}, ay={meta['anchor_y']}")
        
        # 更新 manifest
        actions_dict = {
            "attack_spear": {
                "name": "attack_spear", "file": "amazon_spear.png",
                "directions": 16, "frames": meta['frames'],
                "cell_width": meta['cell_width'], "cell_height": meta['cell_height'],
                "anchor_x": meta['anchor_x'], "anchor_y": meta['anchor_y'],
                "fps": 20, "loop": False
            },
            "attack": {
                "name": "attack", "file": "amazon_attack.png",
                "directions": 16, "frames": meta['frames'],
                "cell_width": meta['cell_width'], "cell_height": meta['cell_height'],
                "anchor_x": meta['anchor_x'], "anchor_y": meta['anchor_y'],
                "fps": 20, "loop": False
            }
        }
        var_name = f"AMAZON_{tier.upper()}_MANIFEST"
        update_manifest(target_dir, var_name, actions_dict)

    # 根目錄 manifest 同步
    root_dir = PROJECT_DIR / "web/assets/characters/amazon"
    update_manifest(root_dir, "AMAZON_MANIFEST", actions_dict)

    # ------------------------------------------------------------
    # 2. 死靈法師 (Necromancer) 匕首刺擊 (A11HS) 修復浮空
    # ------------------------------------------------------------
    print("\n[2/3] 生成死靈法師正統匕首刺擊 (A11HS)...")
    ne_base = SCRIPT_DIR / "mpq_raw/d2char/data/global/CHARS/NE"
    ne_cof = ne_base / "COF/NEA11HS.COF"
    
    for tier in ['light', 'medium', 'heavy']:
        tier_suffix = 'LIT' if tier == 'light' else ('MED' if tier == 'medium' else 'HVY')
        parts = {
            0: str(ne_base / f"HD/NEHD{tier_suffix}A11HS.dcc"),
            1: str(ne_base / f"TR/NETR{tier_suffix}A11HS.dcc"),
            2: str(ne_base / f"LG/NELG{tier_suffix}A11HS.dcc"),
            3: str(ne_base / f"RA/NERA{tier_suffix}A11HS.dcc"),
            4: str(ne_base / f"LA/NELA{tier_suffix}A11HS.dcc"),
            5: str(ne_base / "RH/NERHSSDA11HS.dcc"),
            7: str(ne_base / "SH/NESHKITA11HS.dcc"),
            8: str(ne_base / f"S1/NES1{tier_suffix}A11HS.dcc"),
            9: str(ne_base / f"S2/NES2{tier_suffix}A11HS.dcc"),
        }
        
        target_dir = PROJECT_DIR / f"web/assets/characters/necromancer/{tier}"
        out_attack = target_dir / "necromancer_attack.png"
        meta = composite_character_action('NE', ne_cof, parts, str(out_attack))
        
        if tier == 'light':
            root_dir = PROJECT_DIR / "web/assets/characters/necromancer"
            Image.open(out_attack).save(root_dir / "necromancer_attack.png")
            
        print(f"  Necromancer [{tier}]: cw={meta['cell_width']}, ch={meta['cell_height']}, ax={meta['anchor_x']}, ay={meta['anchor_y']}")
        
        actions_dict = {
            "attack": {
                "name": "attack", "file": "necromancer_attack.png",
                "directions": 16, "frames": meta['frames'],
                "cell_width": meta['cell_width'], "cell_height": meta['cell_height'],
                "anchor_x": meta['anchor_x'], "anchor_y": meta['anchor_y'],
                "fps": 20, "loop": False
            }
        }
        var_name = f"NECROMANCER_{tier.upper()}_MANIFEST"
        update_manifest(target_dir, var_name, actions_dict)

    root_dir = PROJECT_DIR / "web/assets/characters/necromancer"
    update_manifest(root_dir, "NECROMANCER_MANIFEST", actions_dict)

    # ------------------------------------------------------------
    # 3. 召喚物 (Companions) 地表無抖動全面重建
    # ------------------------------------------------------------
    print("\n[3/3] 重建所有召喚物圖集 (消除抖動與反向跳躍)...")
    comp_web_dir = PROJECT_DIR / "web/assets/companions"
    comp_manifest_path = comp_web_dir / "companions_manifest.json"
    with open(comp_manifest_path, 'r', encoding='utf-8') as f:
        comp_manifest = json.load(f)

    # A. 灰熊 (Bear)
    b7_dir = SCRIPT_DIR / "mpq_raw/d2exp/data/global/monsters/B7/TR"
    bear_actions = [
        ("idle", "B7TRLITNUHTH.dcc", 12),
        ("walk", "B7TRLITWLHTH.dcc", 14),
        ("attack", "B7TRLITA1HTH.dcc", 16),
        ("death", "B7TRLITDTHTH.dcc", 14)
    ]
    for act, dcc_name, fps in bear_actions:
        dcc_file = find_file_ci(b7_dir, dcc_name)
        if dcc_file:
            out_png = comp_web_dir / f"bear/bear_{act}.png"
            meta = build_single_dcc_sheet(dcc_file, str(out_png), dir_map=DCC_8_NATURAL)
            meta['fps'] = fps
            comp_manifest['bear']['actions'][act] = {
                "file": f"assets/companions/bear/bear_{act}.png",
                **meta
            }
    print("  Bear rebuild complete.")

    # B. 狂狼 (Wolf)
    wf_dir = SCRIPT_DIR / "mpq_raw/d2exp/data/global/monsters/WF/TR"
    wolf_actions = [
        ("idle", "WFTRLITNUHTH.dcc", 12),
        ("walk", "WFTRLITWLHTH.dcc", 14),
        ("run", "WFTRLITRNHTH.dcc", 16),
        ("attack", "WFTRLITA1HTH.dcc", 16),
        ("death", "WFTRLITDTHTH.dcc", 14)
    ]
    for act, dcc_name, fps in wolf_actions:
        dcc_file = find_file_ci(wf_dir, dcc_name)
        if dcc_file:
            out_png = comp_web_dir / f"wolf/wolf_{act}.png"
            meta = build_single_dcc_sheet(dcc_file, str(out_png), dir_map=DCC_8_NATURAL)
            meta['fps'] = fps
            comp_manifest['wolf']['actions'][act] = {
                "file": f"assets/companions/wolf/wolf_{act}.png",
                **meta
            }
    print("  Wolf rebuild complete.")

    # C. 黏土魔像 (Clay Golem - G1)
    g1_dir = SCRIPT_DIR / "mpq_raw/d2data/data/global/monsters/G1/TR"
    golem_actions = [
        ("idle", "G1TRLITNUHTH.dcc", 12),
        ("walk", "G1TRLITWLHTH.dcc", 14),
        ("run", "G1TRLITWLHTH.dcc", 16),
        ("attack", "G1TRLITA1HTH.dcc", 16),
        ("death", "G1TRLITDTHTH.dcc", 14)
    ]
    for act, dcc_name, fps in golem_actions:
        dcc_file = find_file_ci(g1_dir, dcc_name)
        if dcc_file:
            out_png = comp_web_dir / f"golem/golem_{act}.png"
            d_map = [0] if act == 'death' else DCC_8_NATURAL
            meta = build_single_dcc_sheet(dcc_file, str(out_png), dir_map=d_map)
            meta['fps'] = fps
            comp_manifest['golem']['actions'][act] = {
                "file": f"assets/companions/golem/golem_{act}.png",
                **meta
            }
    print("  Clay Golem rebuild complete.")

    # D. 鋼鐵魔像 (Iron Golem - G4)
    g4_dir = SCRIPT_DIR / "mpq_raw/d2data/data/global/monsters/G4/TR"
    iron_actions = [
        ("idle", "G4TRLITNUHTH.dcc", 12),
        ("walk", "G4TRLITWLHTH.dcc", 14),
        ("run", "G4TRLITWLHTH.dcc", 16),
        ("attack", "G4TRLITA1HTH.dcc", 16),
        ("death", "G4TRLITDTHTH.dcc", 14)
    ]
    for act, dcc_name, fps in iron_actions:
        dcc_file = find_file_ci(g4_dir, dcc_name)
        if dcc_file:
            out_png = comp_web_dir / f"golem/iron_golem_{act}.png"
            d_map = [0] if act == 'death' else DCC_8_NATURAL
            meta = build_single_dcc_sheet(dcc_file, str(out_png), dir_map=d_map)
            meta['fps'] = fps
            comp_manifest['iron_golem']['actions'][act] = {
                "file": f"assets/companions/golem/iron_golem_{act}.png",
                **meta
            }
    print("  Iron Golem rebuild complete.")

    # E. 火焰魔像 (Fire Golem - G3)
    g3_dir = SCRIPT_DIR / "mpq_raw/d2data/data/global/monsters/G3/TR"
    fire_actions = [
        ("idle", "G3TRLITNUHTH.dcc", 12),
        ("walk", "G3TRLITWLHTH.dcc", 14),
        ("run", "G3TRLITWLHTH.dcc", 16),
        ("attack", "G3TRLITA1HTH.dcc", 16),
        ("death", "G3TRLITDTHTH.dcc", 14)
    ]
    for act, dcc_name, fps in fire_actions:
        dcc_file = find_file_ci(g3_dir, dcc_name)
        if dcc_file:
            out_png = comp_web_dir / f"golem/fire_golem_{act}.png"
            d_map = [0] if act == 'death' else DCC_8_NATURAL
            meta = build_single_dcc_sheet(dcc_file, str(out_png), dir_map=d_map)
            meta['fps'] = fps
            comp_manifest['fire_golem']['actions'][act] = {
                "file": f"assets/companions/golem/fire_golem_{act}.png",
                **meta
            }
    print("  Fire Golem rebuild complete.")

    # 寫入 companions_manifest.json 與 companions_manifest.js
    with open(comp_manifest_path, 'w', encoding='utf-8') as f:
        json.dump(comp_manifest, f, ensure_ascii=False, indent=2)
        
    comp_manifest_js = comp_web_dir / "companions_manifest.js"
    with open(comp_manifest_js, 'w', encoding='utf-8') as f:
        f.write(f"window.D2_COMPANIONS_MANIFEST = {json.dumps(comp_manifest, ensure_ascii=False, indent=2)};\n")
        
    print("\n所有圖集與 Manifest 錨定同步完成！")

if __name__ == '__main__':
    main()
