"""
Diablo II Authentic Skills & Missiles Full Extraction & Categorization Pipeline
從暴雪原版 MPQ DCC (d2data, d2exp, Expansion) 全量解碼所有主動法術、投射物與狀態靈氣，
並依照七大職業 (Amazon, Assassin, Barbarian, Druid, Necromancer, Paladin, Sorceress) 與五大魔王怪獸精準分目錄存放。
"""

import os
import sys
import json
import time
import shutil
from PIL import Image

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
Image.MAX_IMAGE_PIXELS = None

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.normpath(os.path.join(SCRIPT_DIR, '..'))
WORKSPACE_DIR = PROJECT_DIR if os.path.exists(os.path.join(PROJECT_DIR, 'diablo2_normalized_assets')) else os.path.normpath(os.path.join(PROJECT_DIR, '..'))

TARGET_NORMALIZED_DIR = os.path.join(WORKSPACE_DIR, 'diablo2_normalized_assets')
WEB_ASSETS_DIR = os.path.join(PROJECT_DIR, 'web', 'assets')

TOOLS_DIR = os.path.join(PROJECT_DIR, 'tools')
sys.path.append(TOOLS_DIR)

from dcc_to_png import DCCDecoder, load_palette

PAL_PATH = os.path.join(TOOLS_DIR, 'mpq_raw', 'd2data', 'data', 'global', 'palette', 'ACT1', 'pal.dat')
PALETTE = load_palette(PAL_PATH) if os.path.exists(PAL_PATH) else None

MISSILES_TXT = os.path.join(TOOLS_DIR, 'mpq_raw', 'd2exp', 'data', 'global', 'excel', 'Missiles.txt')

def ensure_dir(d):
    os.makedirs(d, exist_ok=True)

# 讀取 Missiles.txt 獲得 Trans (加法發光混色屬性)
def load_missiles_metadata():
    meta = {}
    if not os.path.exists(MISSILES_TXT):
        return meta
    with open(MISSILES_TXT, 'r', encoding='utf-8', errors='replace') as f:
        h = f.readline().strip().split('\t')
        m_i = h.index('Missile') if 'Missile' in h else -1
        c_i = h.index('CelFile') if 'CelFile' in h else -1
        trans_i = h.index('Trans') if 'Trans' in h else -1
        for line in f:
            p = line.strip().split('\t')
            if len(p) > c_i:
                m = p[m_i].strip()
                c = p[c_i].strip().lower()
                trans = int(p[trans_i]) if trans_i != -1 and trans_i < len(p) and p[trans_i].isdigit() else 0
                if c:
                    if c not in meta:
                        meta[c] = {'missiles': [], 'trans': trans}
                    meta[c]['missiles'].append(m)
                    if trans > 0:
                        meta[c]['trans'] = trans
    return meta

def categorize_skill(filename, missiles_list):
    fn = filename.lower()
    m_text = ' '.join(missiles_list).lower()
    comb = f"{fn} {m_text}"

    # 1. 關底首領 (Bosses)
    if any(k in comb for k in ['andariel', 'andy', 'andrial']):
        return 'monsters/andariel'
    if 'duriel' in comb:
        return 'monsters/duriel'
    if any(k in comb for k in ['mephisto', 'meph', 'smithhole']):
        return 'monsters/mephisto'
    if any(k in comb for k in ['diablolightning', 'diablofire', 'diablo']):
        return 'monsters/diablo'
    if any(k in comb for k in ['baal', 'bluenova']):
        return 'monsters/baal'

    # 2. 聖騎士 (Paladin)
    if any(k in comb for k in ['blessedhammer', 'holybolt', 'fistoftheheavens', 'handofgod', 'charge', 'smite', 'sanctuary', 'holyfire', 'holyshock', 'conviction', 'fanat', 'unholybolt']):
        return 'paladin'

    # 3. 魔法使 (Sorceress)
    if any(k in comb for k in ['fireball', 'meteor', 'blizzard', 'frozenorb', 'glacial', 'iceblast', 'firewall', 'hydra', 'chargedbolt', 'chainlightning', 'thunderstorm', 'inferno', 'enchant', 'static', 'firebolt', 'shamanfireball']):
        return 'sorceress'

    # 4. 死靈法師 (Necromancer)
    if any(k in comb for k in ['bonespear', 'bonespirit', 'teeth', 'corpseexplode', 'corpseexplosion', 'poisonnova', 'bonearmor', 'boneprison', 'bonewall', 'curse']):
        return 'necromancer'

    # 5. 亞馬遜 (Amazon)
    if any(k in comb for k in ['arrow', 'javelin', 'multishot', 'strafe', 'guided', 'valkyrie', 'decoy', 'plague', 'lightningbolt', 'lightningfury', 'fend', 'jab']):
        return 'amazon'

    # 6. 野蠻人 (Barbarian)
    if any(k in comb for k in ['bayell', 'howl', 'shout', 'battlecry', 'warcry', 'whirlwind', 'berserk', 'frenzy', 'leap', 'bash', 'stun']):
        return 'barbarian'

    # 7. 德魯伊 (Druid)
    if any(k in comb for k in ['tornado', 'twister', 'cyclone', 'hurricane', 'armageddon', 'fissure', 'volcano', 'molten', 'firestorm', 'arctic', 'boulder']):
        return 'druid'

    # 8. 刺客 (Assassin)
    if any(k in comb for k in ['trap', 'sentinel', 'blade', 'sentry', 'fury', 'claws', 'phoenix', 'tiger', 'cobra', 'fade', 'burst', 'mindblast']):
        return 'assassin'

    # 9. 常見怪獸技能 (Common Monsters)
    if any(k in comb for k in ['mon', 'sandmaggot', 'spider', 'beetle', 'scarab', 'succubus', 'willowisp', 'gloam', 'fetish', 'vampire', 'reanim', 'flayer', 'council', 'goospit']):
        return 'monsters/common'

    return 'general'

def decode_dcc_missile_to_png(dcc_path, out_png_path, trans=0):
    if not os.path.exists(dcc_path) or not PALETTE:
        return None

    try:
        decoder = DCCDecoder(dcc_path)
    except Exception as e:
        return None

    dirs = decoder.directions
    frames_per_dir = decoder.frames_per_dir
    if dirs == 0 or frames_per_dir == 0:
        return None

    all_decoded = []
    min_xoff, min_yoff = 9999, 9999
    max_xend, max_yend = -9999, -9999

    for d in range(dirs):
        dir_frames = decoder.decode_direction(d)
        all_decoded.append(dir_frames)
        for fr in dir_frames:
            fw, fh = fr['width'], fr['height']
            if fw == 0 or fh == 0:
                continue
            xo, yo = fr['x_offset'], fr['y_offset']
            min_xoff = min(min_xoff, xo)
            min_yoff = min(min_yoff, yo)
            max_xend = max(max_xend, xo + fw)
            max_yend = max(max_yend, yo + fh)

    if min_xoff == 9999:
        min_xoff, min_yoff = 0, 0
        max_xend, max_yend = 32, 32

    cell_w = max(16, max_xend - min_xoff + 2)
    cell_h = max(16, max_yend - min_yoff + 2)
    pivot_x = -min_xoff + 1
    pivot_y = -min_yoff + 1

    sheet_w = cell_w * frames_per_dir
    sheet_h = cell_h * dirs

    sheet = Image.new('RGBA', (sheet_w, sheet_h), (0, 0, 0, 0))

    for d in range(dirs):
        dir_frames = all_decoded[d]
        for f in range(frames_per_dir):
            if f >= len(dir_frames):
                continue
            fr = dir_frames[f]
            fw, fh = fr['width'], fr['height']
            if fw == 0 or fh == 0:
                continue

            xo, yo = fr['x_offset'], fr['y_offset']
            raw_pixels = fr['pixels']

            img_fr = Image.new('RGBA', (fw, fh), (0, 0, 0, 0))
            rgba_pixels = [PALETTE[idx] for idx in raw_pixels]
            img_fr.putdata(rgba_pixels)

            dst_x = f * cell_w + (pivot_x + xo)
            dst_y = d * cell_h + (pivot_y + yo)
            sheet.paste(img_fr, (int(dst_x), int(dst_y)), img_fr)

    ensure_dir(os.path.dirname(out_png_path))
    sheet.save(out_png_path, 'PNG')

    return {
        'cell_width': cell_w,
        'cell_height': cell_h,
        'pivot_x': pivot_x,
        'pivot_y': pivot_y,
        'directions': dirs,
        'frames': frames_per_dir,
        'trans': trans,
        'sheet_width': sheet_w,
        'sheet_height': sheet_h
    }

def main():
    print("=================================================================", flush=True)
    print("  Diablo II 暴雪原版全技能與投射物解碼重組工程 (Full Skills Pipeline)", flush=True)
    print("=================================================================", flush=True)
    t0 = time.time()

    missiles_meta = load_missiles_metadata()

    # 收集全部 DCC 檔案 (包含 missiles, overlays, Expansion)
    search_dirs = [
        os.path.join(TOOLS_DIR, 'mpq_raw', 'd2data', 'data', 'global', 'missiles'),
        os.path.join(TOOLS_DIR, 'mpq_raw', 'd2exp', 'data', 'global', 'missiles'),
        os.path.join(TOOLS_DIR, 'mpq_raw', 'd2exp', 'data', 'global', 'missiles', 'Expansion'),
        os.path.join(TOOLS_DIR, 'mpq_raw', 'd2data', 'data', 'global', 'overlays'),
        os.path.join(TOOLS_DIR, 'mpq_raw', 'd2exp', 'data', 'global', 'overlays'),
        os.path.join(TOOLS_DIR, 'mpq_raw', 'd2exp', 'data', 'global', 'overlays', 'Expansion'),
    ]

    all_dccs = {}
    for sd in search_dirs:
        if not os.path.exists(sd):
            continue
        for f in os.listdir(sd):
            if f.lower().endswith('.dcc'):
                key = f[:-4].lower()
                all_dccs[key] = (f[:-4], os.path.join(sd, f))

    print(f">>> 掃描到暴雪原廠技能與彈道 DCC 檔案共: {len(all_dccs)} 個", flush=True)

    skills_manifest = {}
    total_decoded = 0

    for key, (orig_name, dcc_path) in sorted(all_dccs.items()):
        m_info = missiles_meta.get(key, {'missiles': [], 'trans': 0})
        trans = m_info['trans']
        cat = categorize_skill(orig_name, m_info['missiles'])

        norm_out_path = os.path.join(TARGET_NORMALIZED_DIR, 'skills', cat, f"{orig_name}.png")
        web_out_path = os.path.join(WEB_ASSETS_DIR, 'skills', cat, f"{orig_name}.png")

        # 解碼
        res = decode_dcc_missile_to_png(dcc_path, norm_out_path, trans=trans)
        if res:
            total_decoded += 1
            ensure_dir(os.path.dirname(web_out_path))
            shutil.copy2(norm_out_path, web_out_path)

            rel_path = f"assets/skills/{cat}/{orig_name}.png"
            norm_rel_path = f"skills/{cat}/{orig_name}.png"
            res['file'] = rel_path
            res['normalized_file'] = norm_rel_path
            res['category'] = cat
            res['name'] = orig_name
            res['missiles'] = m_info['missiles']
            skills_manifest[orig_name.lower()] = res

    # 產出 skills_manifest.json 與 skills_manifest.js
    norm_json_path = os.path.join(TARGET_NORMALIZED_DIR, 'skills', 'skills_manifest.json')
    web_json_path = os.path.join(WEB_ASSETS_DIR, 'skills', 'skills_manifest.json')
    web_js_path = os.path.join(PROJECT_DIR, 'web', 'js', 'skills_manifest.js')

    with open(norm_json_path, 'w', encoding='utf-8') as f:
        json.dump(skills_manifest, f, indent=2, ensure_ascii=False)
    with open(web_json_path, 'w', encoding='utf-8') as f:
        json.dump(skills_manifest, f, indent=2, ensure_ascii=False)

    js_content = f"// Diablo II Authentic Blizzard Skills & Projectiles Manifest\nwindow.D2_AUTHENTIC_SKILLS_MANIFEST = {json.dumps(skills_manifest, indent=2, ensure_ascii=False)};\n"
    with open(web_js_path, 'w', encoding='utf-8') as f:
        f.write(js_content)

    # 統計分類
    cat_counts = {}
    for item in skills_manifest.values():
        c = item['category']
        cat_counts[c] = cat_counts.get(c, 0) + 1

    print("\n>>> [分類解碼結果]:", flush=True)
    for c, count in sorted(cat_counts.items()):
        print(f"  - {c}: {count} 款正統技能/投射物", flush=True)

    elapsed = time.time() - t0
    print(f"\n[OK] 暴雪原版全技能與投射物解碼圓滿完成！共解碼 {total_decoded} 款技能，耗時 {elapsed:.2f} 秒！", flush=True)

if __name__ == '__main__':
    main()
