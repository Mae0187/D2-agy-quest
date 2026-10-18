import os
import glob

# 搜尋現有怪物檔案在 tools/*.py 中的原始碼參照
search_keys = ['fallen', 'skeleton', 'zombie', 'spider', 'beetle', 'mummy', 'wraith', 'doom_knight', 'andariel', 'duriel', 'council', 'diablo', 'mephisto', 'baal', 'baal_minion']

for py in glob.glob('Diablo2-Agent-Monitor/tools/*.py'):
    with open(py, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
    for k in search_keys:
        if k in content.lower():
            # 找出包含 mpq_raw 的行
            for line in content.splitlines():
                if ('monsters' in line or 'MPQ' in line or 'd2' in line) and any(x in line.lower() for x in [f"'{k}'", f'"{k}"', f'{k}_']):
                    # print snippet
                    pass

# 直接在 mpq_raw 中找常見怪物縮寫
monsters_dir = 'Diablo2-Agent-Monitor/tools/mpq_raw/d2data/data/global/monsters'
exp_monsters_dir = 'Diablo2-Agent-Monitor/tools/mpq_raw/d2exp/data/global/monsters'

print("=== 審查怪物目錄與部件 ===")
# 檢查各怪物的代號
# Fallen: FA?
if os.path.exists(os.path.join(monsters_dir, 'FA')):
    print("FA (Fallen?):", os.listdir(os.path.join(monsters_dir, 'FA')))
# Mummy: MM?
if os.path.exists(os.path.join(monsters_dir, 'MM')):
    print("MM (Mummy?):", os.listdir(os.path.join(monsters_dir, 'MM')))
# Spider: SP?
if os.path.exists(os.path.join(monsters_dir, 'SP')):
    print("SP (Spider?):", os.listdir(os.path.join(monsters_dir, 'SP')))
# Beetle: BT?
if os.path.exists(os.path.join(monsters_dir, 'BT')):
    print("BT (Beetle?):", os.listdir(os.path.join(monsters_dir, 'BT')))
# Wraith: WR?
if os.path.exists(os.path.join(monsters_dir, 'WR')):
    print("WR (Wraith?):", os.listdir(os.path.join(monsters_dir, 'WR')))
# Doom Knight: DK?
if os.path.exists(os.path.join(monsters_dir, 'DK')):
    print("DK (Doom Knight?):", os.listdir(os.path.join(monsters_dir, 'DK')))
# Council: 1Z / 21 / CM?
