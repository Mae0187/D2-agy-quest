"""
Export All Authentic Act Monsters & Bosses from Diablo II MPQ DCC
Generates spritesheets and monsters_manifest.js for:
- Minions: fallen, skeleton, zombie, spider, wraith, beetle, mummy, council_minion, doom_knight
- Bosses: andariel (Act 1), duriel (Act 2), council (Act 3), diablo (Act 4)
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

def export_composite_monster_dcc(code, parts, action_suffix, out_filename, cell_w, cell_h, anchor_x, anchor_y):
    base_dir = os.path.join(PROJECT_DIR, 'tools', 'mpq_raw', 'd2data', 'data', 'global', 'monsters', code)
    p0 = os.path.join(base_dir, parts[0], f'{code}{parts[0].upper()}LIT{action_suffix}.dcc')
    if not os.path.exists(p0):
        print(f"[ERROR] Composite base not found: {p0}")
        return None
    dec0 = DCCDecoder(p0)
    sheet_w = cell_w * dec0.frames_per_dir
    sheet_h = cell_h * dec0.directions
    sheet = Image.new('RGBA', (sheet_w, sheet_h), (0, 0, 0, 0))

    decoders = []
    for part in parts:
        p = os.path.join(base_dir, part, f'{code}{part.upper()}LIT{action_suffix}.dcc')
        if os.path.exists(p):
            decoders.append(DCCDecoder(p))
        else:
            decoders.append(None)

    for d in range(dec0.directions):
        for f_idx in range(dec0.frames_per_dir):
            for dec in decoders:
                if dec is None:
                    continue
                fr = dec.decode_direction(d)[f_idx]
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
                dst_x = f_idx * cell_w + anchor_x + fr['x_offset']
                dst_y = d * cell_h + anchor_y + fr['y_offset'] - fh + 1
                sheet.paste(frame_img, (dst_x, dst_y), frame_img)

    out_path = os.path.join(OUT_DIR, out_filename)
    sheet.save(out_path)
    print(f"[EXPORT COMPOSITE] {out_filename} ({sheet_w}x{sheet_h}, {dec0.directions} dirs x {dec0.frames_per_dir} frames)")
    return {
        "file": f"assets/monsters/{out_filename}",
        "directions": dec0.directions,
        "frames": dec0.frames_per_dir,
        "cell_width": cell_w,
        "cell_height": cell_h,
        "anchor_x": anchor_x,
        "anchor_y": anchor_y
    }

def main():
    print("=== Generating Authentic D2 Multi-Act Monsters & Bosses ===")
    manifest = {}

    # --- ACT 1 MINIONS ---
    # 1. 沉淪魔 (FA)
    fa_base = "d2data/data/global/monsters/FA/TR"
    manifest["fallen"] = {
        "name": "Fallen (沉淪魔)",
        "type": "minion",
        "act": 1,
        "max_hp": 30,
        "actions": {
            "idle": export_monster_dcc(f"{fa_base}/FATRLITNUHTH.dcc", "fallen_idle.png", 100, 100, 50, 75),
            "walk": export_monster_dcc(f"{fa_base}/FATRLITWLHTH.dcc", "fallen_walk.png", 100, 100, 50, 75),
            "attack": export_monster_dcc(f"{fa_base}/FATRLITA1HTH.dcc", "fallen_attack.png", 100, 100, 50, 75),
            "hit": export_monster_dcc(f"{fa_base}/FATRLITGHHTH.dcc", "fallen_hit.png", 100, 100, 50, 75),
            "death": export_monster_dcc(f"{fa_base}/FATRLITDTHTH.dcc", "fallen_death.png", 100, 100, 50, 75)
        }
    }

    # 2. 骷髏戰士 (SK)
    sk_base = "d2data/data/global/monsters/SK/TR"
    manifest["skeleton"] = {
        "name": "Skeleton (骷髏戰士)",
        "type": "minion",
        "act": 1,
        "max_hp": 45,
        "actions": {
            "idle": export_monster_dcc(f"{sk_base}/SKTRLITNU1HS.dcc", "skeleton_idle.png", 130, 110, 65, 75),
            "walk": export_monster_dcc(f"{sk_base}/SKTRLITWL1HS.dcc", "skeleton_walk.png", 130, 110, 65, 75),
            "attack": export_monster_dcc(f"{sk_base}/SKTRLITA11HS.dcc", "skeleton_attack.png", 130, 110, 65, 75),
            "hit": export_monster_dcc(f"{sk_base}/SKTRLITGH1HS.dcc", "skeleton_hit.png", 130, 110, 65, 75),
            "death": export_monster_dcc(f"{sk_base}/SKTRLITDT1HS.dcc", "skeleton_death.png", 130, 110, 65, 75)
        }
    }

    # 3. 飢餓殭屍 (ZM)
    zm_base = "d2data/data/global/monsters/ZM/TR"
    manifest["zombie"] = {
        "name": "Zombie (飢餓殭屍)",
        "type": "minion",
        "act": 1,
        "max_hp": 60,
        "actions": {
            "idle": export_monster_dcc(f"{zm_base}/ZMTRLITNUHTH.dcc", "zombie_idle.png", 130, 110, 65, 75),
            "walk": export_monster_dcc(f"{zm_base}/ZMTRLITWLHTH.dcc", "zombie_walk.png", 130, 110, 65, 75),
            "attack": export_monster_dcc(f"{zm_base}/ZMTRLITA1HTH.dcc", "zombie_attack.png", 130, 110, 65, 75),
            "hit": export_monster_dcc(f"{zm_base}/ZMTRLITGHHTH.dcc", "zombie_hit.png", 130, 110, 65, 75),
            "death": export_monster_dcc(f"{zm_base}/ZMTRLITDTHTH.dcc", "zombie_death.png", 130, 110, 65, 75)
        }
    }

    # 4. 劇毒蜘蛛 (SP)
    sp_base = "d2data/data/global/monsters/SP/TR"
    manifest["spider"] = {
        "name": "Giant Spider (劇毒蜘蛛)",
        "type": "minion",
        "act": 1,
        "max_hp": 40,
        "actions": {
            "idle": export_monster_dcc(f"{sp_base}/SPTRLITNUHTH.dcc", "spider_idle.png", 230, 200, 115, 130),
            "walk": export_monster_dcc(f"{sp_base}/SPTRLITWLHTH.dcc", "spider_walk.png", 230, 200, 115, 130),
            "attack": export_monster_dcc(f"{sp_base}/SPTRLITA1HTH.dcc", "spider_attack.png", 230, 200, 115, 130),
            "hit": export_monster_dcc(f"{sp_base}/SPTRLITGHHTH.dcc", "spider_hit.png", 230, 200, 115, 130),
            "death": export_monster_dcc(f"{sp_base}/SPTRLITDTHTH.dcc", "spider_death.png", 230, 200, 115, 130)
        }
    }

    # --- ACT 2 MINIONS ---
    # 5. 聖甲蟲 (BT - Death Beetle)
    bt_base = "d2data/data/global/monsters/BT/TR"
    manifest["beetle"] = {
        "name": "Death Beetle (聖甲蟲)",
        "type": "minion",
        "act": 2,
        "max_hp": 55,
        "actions": {
            "idle": export_monster_dcc(f"{bt_base}/BTTRLITNUHTH.dcc", "beetle_idle.png", 180, 160, 90, 105),
            "walk": export_monster_dcc(f"{bt_base}/BTTRLITWLHTH.dcc", "beetle_walk.png", 180, 160, 90, 105),
            "attack": export_monster_dcc(f"{bt_base}/BTTRLITA1HTH.dcc", "beetle_attack.png", 180, 160, 90, 105),
            "hit": export_monster_dcc(f"{bt_base}/BTTRLITGHHTH.dcc", "beetle_hit.png", 180, 160, 90, 105),
            "death": export_monster_dcc(f"{bt_base}/BTTRLITDTHTH.dcc", "beetle_death.png", 180, 160, 90, 105)
        }
    }

    # 6. 古代木乃伊 (MM - Greater Mummy)
    mm_base = "d2data/data/global/monsters/MM/TR"
    manifest["mummy"] = {
        "name": "Ancient Mummy (古代木乃伊)",
        "type": "minion",
        "act": 2,
        "max_hp": 65,
        "actions": {
            "idle": export_monster_dcc(f"{mm_base}/MMTRLITNUHTH.dcc", "mummy_idle.png", 160, 160, 80, 120),
            "walk": export_monster_dcc(f"{mm_base}/MMTRLITWLHTH.dcc", "mummy_walk.png", 160, 160, 80, 120),
            "attack": export_monster_dcc(f"{mm_base}/MMTRLITA1HTH.dcc", "mummy_attack.png", 160, 160, 80, 120),
            "hit": export_monster_dcc(f"{mm_base}/MMTRLITGHHTH.dcc", "mummy_hit.png", 160, 160, 80, 120),
            "death": export_monster_dcc(f"{mm_base}/MMTRLITDTHTH.dcc", "mummy_death.png", 160, 160, 80, 120)
        }
    }

    # --- ACT 3 MINIONS ---
    # 7. 幽靈鬼魂 (WR - Wraith)
    wr_base = "d2data/data/global/monsters/WR/TR"
    manifest["wraith"] = {
        "name": "Wraith (幽靈鬼魂)",
        "type": "minion",
        "act": 3,
        "max_hp": 38,
        "actions": {
            "idle": export_monster_dcc(f"{wr_base}/WRTRLITNUHTH.dcc", "wraith_idle.png", 180, 170, 90, 130),
            "walk": export_monster_dcc(f"{wr_base}/WRTRLITWLHTH.dcc", "wraith_walk.png", 180, 170, 90, 130),
            "attack": export_monster_dcc(f"{wr_base}/WRTRLITA1HTH.dcc", "wraith_attack.png", 180, 170, 90, 130),
            "hit": export_monster_dcc(f"{wr_base}/WRTRLITGHHTH.dcc", "wraith_hit.png", 180, 170, 90, 130),
            "death": export_monster_dcc(f"{wr_base}/WRTRLITDTHTH.dcc", "wraith_death.png", 180, 170, 90, 130)
        }
    }

    # --- ACT 4 MINIONS ---
    # 8. 末日騎士 (DM - Doom Knight)
    dm_base = "d2data/data/global/monsters/DM/TR"
    manifest["doom_knight"] = {
        "name": "Doom Knight (末日騎士)",
        "type": "minion",
        "act": 4,
        "max_hp": 80,
        "actions": {
            "idle": export_monster_dcc(f"{dm_base}/DMTRLITNUHTH.dcc", "doom_knight_idle.png", 240, 220, 120, 145),
            "walk": export_monster_dcc(f"{dm_base}/DMTRLITWLHTH.dcc", "doom_knight_walk.png", 240, 220, 120, 145),
            "attack": export_monster_dcc(f"{dm_base}/DMTRLITA1HTH.dcc", "doom_knight_attack.png", 240, 220, 120, 145),
            "hit": export_monster_dcc(f"{dm_base}/DMTRLITGHHTH.dcc", "doom_knight_hit.png", 240, 220, 120, 145),
            "death": export_monster_dcc(f"{dm_base}/DMTRLITDTHTH.dcc", "doom_knight_death.png", 240, 220, 120, 145)
        }
    }

    # --- ACT BOSSES ---
    # ACT 1 BOSS: 安達利爾 (AN - Andariel)
    an_base = "d2data/data/global/monsters/AN/TR"
    manifest["andariel"] = {
        "name": "Andariel (安達利爾)",
        "title": "ANDARIEL — MAIDEN OF ANGUISH",
        "type": "boss",
        "act": 1,
        "max_hp": 350,
        "actions": {
            "idle": export_monster_dcc(f"{an_base}/ANTRLITNUHTH.dcc", "andariel_idle.png", 220, 240, 110, 190),
            "walk": export_monster_dcc(f"{an_base}/ANTRLITWLHTH.dcc", "andariel_walk.png", 220, 240, 110, 190),
            "attack": export_monster_dcc(f"{an_base}/ANTRLITA1HTH.dcc", "andariel_attack.png", 220, 240, 110, 190),
            "hit": export_monster_dcc(f"{an_base}/ANTRLITGHHTH.dcc", "andariel_hit.png", 220, 240, 110, 190),
            "death": export_monster_dcc(f"{an_base}/ANTRLITDTHTH.dcc", "andariel_death.png", 220, 240, 110, 190)
        }
    }

    # ACT 2 BOSS: 督瑞爾 (DU - Duriel, Composite)
    du_parts = ['Lg', 'Tr', 'Ra', 'La']
    manifest["duriel"] = {
        "name": "Duriel (督瑞爾)",
        "title": "DURIEL — LORD OF PAIN",
        "type": "boss",
        "act": 2,
        "max_hp": 450,
        "actions": {
            "idle": export_composite_monster_dcc('DU', du_parts, 'NUHTH', "duriel_idle.png", 330, 270, 170, 175),
            "walk": export_composite_monster_dcc('DU', du_parts, 'WLHTH', "duriel_walk.png", 330, 270, 170, 175),
            "attack": export_composite_monster_dcc('DU', du_parts, 'A1HTH', "duriel_attack.png", 330, 270, 170, 175),
            "hit": export_composite_monster_dcc('DU', du_parts, 'GHHTH', "duriel_hit.png", 330, 270, 170, 175),
            "death": export_composite_monster_dcc('DU', du_parts, 'DTHTH', "duriel_death.png", 330, 270, 170, 175)
        }
    }

    # ACT 3 BOSS: 崔凡克最高議會長老 (HP - Council Member)
    hp_base = "d2data/data/global/monsters/HP/TR"
    manifest["council"] = {
        "name": "High Priest (最高議會長老)",
        "title": "ISMAIL VILEHAND — HIGH PRIEST OF ZAKARUM",
        "type": "boss",
        "act": 3,
        "max_hp": 400,
        "actions": {
            "idle": export_monster_dcc(f"{hp_base}/HPTRLITNUHTH.dcc", "council_idle.png", 210, 180, 105, 120),
            "walk": export_monster_dcc(f"{hp_base}/HPTRLITWLHTH.dcc", "council_walk.png", 210, 180, 105, 120),
            "attack": export_monster_dcc(f"{hp_base}/HPTRLITA1HTH.dcc", "council_attack.png", 210, 180, 105, 120),
            "hit": export_monster_dcc(f"{hp_base}/HPTRLITGHHTH.dcc", "council_hit.png", 210, 180, 105, 120),
            "death": export_monster_dcc(f"{hp_base}/HPTRLITDTHTH.dcc", "council_death.png", 210, 180, 105, 120)
        }
    }

    # ACT 4 BOSS: 暗黑破壞神 (DI - Diablo, Composite)
    di_parts = ['Lg', 'Tr', 'Ra', 'La']
    manifest["diablo"] = {
        "name": "Diablo (暗黑破壞神)",
        "title": "DIABLO — THE LORD OF TERROR",
        "type": "boss",
        "act": 4,
        "max_hp": 600,
        "actions": {
            "idle": export_composite_monster_dcc('DI', di_parts, 'NUHTH', "diablo_idle.png", 350, 280, 175, 175),
            "walk": export_composite_monster_dcc('DI', di_parts, 'WLHTH', "diablo_walk.png", 350, 280, 175, 175),
            "attack": export_composite_monster_dcc('DI', di_parts, 'A1HTH', "diablo_attack.png", 350, 280, 175, 175),
            "hit": export_composite_monster_dcc('DI', di_parts, 'GHHTH', "diablo_hit.png", 350, 280, 175, 175),
            "death": export_composite_monster_dcc('DI', di_parts, 'DDHTH', "diablo_death.png", 350, 280, 175, 175)
        }
    }

    # Write manifests
    js_content = "window.D2_MONSTERS_MANIFEST = " + json.dumps(manifest, indent=2, ensure_ascii=False) + ";\n"
    with open(os.path.join(OUT_DIR, "monsters_manifest.js"), "w", encoding="utf-8") as f:
        f.write(js_content)
    with open(os.path.join(OUT_DIR, "monsters_manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)

    print("\n[SUCCESS] All Act monsters and bosses exported successfully!")

if __name__ == "__main__":
    main()
