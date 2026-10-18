import os
import sys
import json
from PIL import Image

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.normpath(os.path.join(SCRIPT_DIR, '..'))
TOOLS_DIR = SCRIPT_DIR
OUT_MONSTERS_DIR = os.path.join(PROJECT_DIR, 'web', 'assets', 'monsters')
os.makedirs(OUT_MONSTERS_DIR, exist_ok=True)

sys.path.append(TOOLS_DIR)
from dcc_to_png import DCCDecoder, load_palette

PAL1 = load_palette(os.path.join(PROJECT_DIR, 'tools', 'mpq_raw', 'd2data', 'data', 'global', 'palette', 'ACT1', 'pal.dat'), brightness_boost=1.35)
PAL2 = load_palette(os.path.join(PROJECT_DIR, 'tools', 'mpq_raw', 'd2data', 'data', 'global', 'palette', 'ACT2', 'pal.dat'), brightness_boost=1.35)
PAL3 = load_palette(os.path.join(PROJECT_DIR, 'tools', 'mpq_raw', 'd2data', 'data', 'global', 'palette', 'ACT3', 'pal.dat'), brightness_boost=1.35)
PAL4 = load_palette(os.path.join(PROJECT_DIR, 'tools', 'mpq_raw', 'd2data', 'data', 'global', 'palette', 'ACT4', 'pal.dat'), brightness_boost=1.35)
PAL5 = load_palette(os.path.join(PROJECT_DIR, 'tools', 'mpq_raw', 'd2exp', 'data', 'global', 'palette', 'ACT5', 'pal.dat'), brightness_boost=1.35)

def export_monster_sprites(m_id, actions_dict, cell_w, cell_h, anchor_x, anchor_y, pal):
    manifest_actions = {}
    for act_name, part_paths in actions_dict.items():
        decoders = []
        if isinstance(part_paths, str):
            part_paths = [part_paths]
            
        for pp in part_paths:
            full_p = os.path.join(PROJECT_DIR, 'tools', 'mpq_raw', 'd2data', 'data', 'global', 'monsters', pp)
            if not os.path.exists(full_p):
                print(f"[ERROR] Missing {full_p}")
                continue
            decoders.append(DCCDecoder(full_p))
            
        if not decoders:
            continue
            
        dirs = decoders[0].directions
        fpd = decoders[0].frames_per_dir
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
                    
        out_fn = f"{m_id}_{act_name}.png"
        out_path = os.path.join(OUT_MONSTERS_DIR, out_fn)
        sheet.save(out_path)
        print(f"  [{m_id.upper()}] {out_fn} saved ({sheet_w}x{sheet_h}, {dirs} dirs x {fpd} frames)")
        manifest_actions[act_name] = {
            "file": f"assets/monsters/{out_fn}",
            "directions": dirs,
            "frames": fpd,
            "cell_width": cell_w,
            "cell_height": cell_h,
            "anchor_x": anchor_x,
            "anchor_y": anchor_y
        }
    return manifest_actions

def main():
    print("==================================================================")
    print(" Exporting 6 Additional Authentic Diablo II Monsters             ")
    print("==================================================================")
    
    # 1. Fallen Shaman (FS)
    fs_actions = {
        'idle': 'FS/TR/FSTRLITNUHTH.dcc',
        'walk': 'FS/TR/FSTRLITWLHTH.dcc',
        'attack': 'FS/TR/FSTRLITA1HTH.dcc',
        'cast': 'FS/TR/FSTRLITA2HTH.dcc',
        'hit': 'FS/TR/FSTRLITGHHTH.dcc',
        'death': 'FS/TR/FSTRLITDTHTH.dcc'
    }
    fs_meta = export_monster_sprites('fallen_shaman', fs_actions, 120, 120, 60, 90, PAL1)
    
    # 2. Goatman (GM)
    gm_actions = {
        'idle': ['GM/TR/GMTRLITNU2HS.dcc', 'GM/RH/GMRHBTXNU2HS.dcc'],
        'walk': ['GM/TR/GMTRLITWL2HS.dcc', 'GM/RH/GMRHBTXWL2HS.dcc'],
        'attack': ['GM/TR/GMTRLITA12HS.dcc', 'GM/RH/GMRHBTXA12HS.dcc'],
        'hit': ['GM/TR/GMTRLITGH2HS.dcc', 'GM/RH/GMRHBTXGH2HS.dcc'],
        'death': 'GM/TR/GMTRLITDTHTH.dcc'
    }
    gm_meta = export_monster_sprites('goatman', gm_actions, 140, 140, 70, 100, PAL1)
    
    # 3. Blunderbore (BB)
    bb_actions = {
        'idle': 'BB/TR/BBTRLITNUHTH.dcc',
        'walk': 'BB/TR/BBTRLITWLHTH.dcc',
        'attack': 'BB/TR/BBTRLITA1HTH.dcc',
        'hit': 'BB/TR/BBTRLITGHHTH.dcc',
        'death': 'BB/TR/BBTRLITDTHTH.dcc'
    }
    bb_meta = export_monster_sprites('blunderbore', bb_actions, 180, 180, 90, 140, PAL2)
    
    # 4. Fetish Shaman (FW)
    fw_actions = {
        'idle': 'FW/TR/FWTRLITNUHTH.dcc',
        'walk': 'FW/TR/FWTRLITWLHTH.dcc',
        'attack': 'FW/TR/FWTRLITA1HTH.dcc',
        'cast': 'FW/TR/FWTRLITSCHTH.dcc',
        'hit': 'FW/TR/FWTRLITGHHTH.dcc',
        'death': 'FW/TR/FWTRLITDTHTH.dcc'
    }
    fw_meta = export_monster_sprites('fetish_shaman', fw_actions, 110, 130, 55, 100, PAL3)
    
    # 5. Frog Demon (SW)
    sw_actions = {
        'idle': 'SW/TR/SWTRLITNUHTH.dcc',
        'walk': 'SW/TR/SWTRLITWLHTH.dcc',
        'attack': 'SW/TR/SWTRLITA1HTH.dcc',
        'hit': 'SW/TR/SWTRLITGHHTH.dcc',
        'death': 'SW/TR/SWTRLITDTHTH.dcc'
    }
    sw_meta = export_monster_sprites('frog_demon', sw_actions, 160, 160, 80, 130, PAL3)
    
    # 6. Balrog (DM)
    dm_actions = {
        'idle': ['DM/TR/DMTRLITNUHTH.dcc', 'DM/RH/DMRHWSDNUHTH.dcc'],
        'walk': ['DM/TR/DMTRLITWLHTH.dcc', 'DM/RH/DMRHWSDWLHTH.dcc'],
        'attack': ['DM/TR/DMTRLITA1HTH.dcc', 'DM/RH/DMRHWSDA1HTH.dcc'],
        'cast': ['DM/TR/DMTRLITS1HTH.dcc', 'DM/RH/DMRHWSDS1HTH.dcc'],
        'hit': ['DM/TR/DMTRLITGHHTH.dcc', 'DM/RH/DMRHWSDGHHTH.dcc'],
        'death': 'DM/TR/DMTRLITDTHTH.dcc'
    }
    dm_meta = export_monster_sprites('balrog', dm_actions, 220, 220, 110, 175, PAL4)
    
    # 載入現有 manifest 並更新
    manifest_path = os.path.join(PROJECT_DIR, 'web', 'assets', 'monsters', 'monsters_manifest.json')
    with open(manifest_path, 'r', encoding='utf-8') as f:
        manifest = json.load(f)
        
    manifest['fallen_shaman'] = {
        "name": "Fallen Shaman (沉淪巫師)",
        "type": "minion",
        "act": 1,
        "max_hp": 55,
        "actions": fs_meta
    }
    manifest['goatman'] = {
        "name": "Goatman (羊人)",
        "type": "minion",
        "act": 1,
        "max_hp": 50,
        "actions": gm_meta
    }
    manifest['blunderbore'] = {
        "name": "Blunderbore (大笨獸)",
        "type": "minion",
        "act": 2,
        "max_hp": 90,
        "actions": bb_meta
    }
    manifest['fetish_shaman'] = {
        "name": "Fetish Shaman (小矮人巫師)",
        "type": "minion",
        "act": 3,
        "max_hp": 60,
        "actions": fw_meta
    }
    manifest['frog_demon'] = {
        "name": "Frog Demon (青蛙惡魔/沼澤居客)",
        "type": "minion",
        "act": 3,
        "max_hp": 65,
        "actions": sw_meta
    }
    manifest['balrog'] = {
        "name": "Balrog (巨大惡魔/巴洛克)",
        "type": "minion",
        "act": 4,
        "max_hp": 110,
        "actions": dm_meta
    }
    
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
        
    manifest_js_path = os.path.join(PROJECT_DIR, 'web', 'assets', 'monsters', 'monsters_manifest.js')
    with open(manifest_js_path, 'w', encoding='utf-8') as f:
        f.write("window.D2_MONSTERS_MANIFEST = ")
        json.dump(manifest, f, indent=2, ensure_ascii=False)
        f.write(";\n")
        
    print(f"\n[SUCCESS] Total monsters now registered in manifest: {len(manifest)}")

if __name__ == '__main__':
    main()
