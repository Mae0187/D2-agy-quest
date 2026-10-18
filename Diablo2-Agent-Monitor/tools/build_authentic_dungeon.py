"""
Diablo II 正統墓穴地牢場景生成器 (Authentic Catacombs Dungeon Builder)
深入利用原版 Catacombs Floor (75+ 種不同地磚) 與 Catacomb 牆體、石柱、火把壁燈，
告別單調重複，生成多樣性豐富、具備立體縱深感的真實暗黑2地下城場景。
"""
import os
import random
from PIL import Image
import numpy as np

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.normpath(os.path.join(SCRIPT_DIR, '..'))
TILES_DIR = os.path.join(PROJECT_DIR, 'assets', 'acts', 'act1', 'tiles_sprites')
OUT_PATH = os.path.join(PROJECT_DIR, 'web', 'assets', 'dungeon', 'catacomb_bg.png')

# 1. 解析 Catacombs Floor.png
floor_im = Image.open(os.path.join(TILES_DIR, 'Catacombs Floor.png')).convert('RGBA')
floor_arr = np.array(floor_im)

# 消除洋紅色 (255, 0, 255)
is_magenta = (floor_arr[:, :, 0] > 180) & (floor_arr[:, :, 1] < 60) & (floor_arr[:, :, 2] > 180)
floor_arr[is_magenta] = [0, 0, 0, 0]

# 提取所有有效的 160x80 菱形地磚
plain_tiles = []
cracked_tiles = []
blood_tiles = []

rows = floor_im.size[1] // 80
cols = floor_im.size[0] // 160

for r in range(rows):
    for c in range(cols):
        # 避開左上角帶文字的第一格 (0, 0)
        if r == 0 and c == 0:
            continue
        patch = floor_arr[r*80:(r+1)*80, c*160:(c+1)*160]
        alpha = patch[:, :, 3]
        if (alpha > 0).sum() < 2500:
            continue
            
        tile_pil = Image.fromarray(patch, 'RGBA')
        
        # 分類地磚類型
        non_trans = patch[alpha > 0]
        is_red = (non_trans[:, 0] > 100) & (non_trans[:, 1] < 60) & (non_trans[:, 2] < 60)
        red_ratio = is_red.sum() / len(non_trans)
        
        # 檢測裂縫或凹坑 (局部深色對比)
        gray = 0.299 * non_trans[:, 0] + 0.587 * non_trans[:, 1] + 0.114 * non_trans[:, 2]
        std_val = gray.std()
        
        if red_ratio > 0.05:
            blood_tiles.append(tile_pil)
        elif std_val > 18:
            cracked_tiles.append(tile_pil)
        else:
            plain_tiles.append(tile_pil)

print(f"Extracted {len(plain_tiles)} plain stone tiles, {len(cracked_tiles)} cracked/debris tiles, {len(blood_tiles)} blood/rune tiles.")

# 2. 解析 Catacomb.png (牆體、石柱、壁燈、碎石)
catacomb_im = Image.open(os.path.join(TILES_DIR, 'Catacomb.png')).convert('RGBA')
cata_arr = np.array(catacomb_im)
is_mag_cata = (cata_arr[:, :, 0] > 180) & (cata_arr[:, :, 1] < 60) & (cata_arr[:, :, 2] > 180)
cata_arr[is_mag_cata] = [0, 0, 0, 0]

# 提取立體石柱 (Pillar) 與牆壁
# 在 Catacomb.png 中找幾塊乾淨的物件
def extract_object_box(im_arr, box):
    x1, y1, x2, y2 = box
    patch = im_arr[y1:y2, x1:x2]
    return Image.fromarray(patch, 'RGBA')

# 石柱 (Pillars around row 1/2)
pillar1 = extract_object_box(cata_arr, (40, 420, 140, 680))
pillar2 = extract_object_box(cata_arr, (180, 420, 280, 680))
# 帶火把或雕飾的石牆
wall1 = extract_object_box(cata_arr, (1160, 420, 1340, 680))
wall2 = extract_object_box(cata_arr, (1540, 420, 1720, 680))
# 碎石石礫堆
rubble1 = extract_object_box(cata_arr, (20, 150, 140, 260))
rubble2 = extract_object_box(cata_arr, (160, 150, 280, 260))

# 3. 組合構建 800x600 逼真地牢畫布
canvas = Image.new('RGBA', (800, 600), (8, 8, 12, 255))

# A. 等距交錯鋪設地面 (隨機權重：80% 普通多樣石板，15% 裂紋碎石，5% 血痕)
random.seed(1337) # 固定隨機種子保證地圖質感一致且穩定

for y in range(-40, 640, 40):
    row_idx = (y + 40) // 40
    x_offset = -80 if (row_idx % 2 == 1) else -160
    for x in range(x_offset, 880, 160):
        # 決定地磚類型
        roll = random.random()
        if roll < 0.80 and plain_tiles:
            t = random.choice(plain_tiles)
        elif roll < 0.95 and cracked_tiles:
            t = random.choice(cracked_tiles)
        elif blood_tiles:
            t = random.choice(blood_tiles)
        else:
            t = random.choice(plain_tiles)
            
        canvas.paste(t, (x, y), t)

# B. 邊界立體高牆與石柱佈局 (營造縱深與地牢氛圍)
# 頂部石牆與暗影
if wall1.size[0] > 0 and wall1.size[1] > 0:
    canvas.paste(wall1, (80, -90), wall1)
    canvas.paste(wall2, (260, -90), wall2)
    canvas.paste(wall1, (440, -90), wall1)
    canvas.paste(wall2, (620, -90), wall2)

# 左右兩側的古代石柱 (Pillars)
if pillar1.size[0] > 0:
    canvas.paste(pillar1, (10, 40), pillar1)
    canvas.paste(pillar2, (690, 40), pillar2)

# 散落邊角的古老碎石堆 (Rubble)
if rubble1.size[0] > 0:
    canvas.paste(rubble1, (50, 480), rubble1)
if rubble2.size[0] > 0:
    canvas.paste(rubble2, (680, 470), rubble2)

# 轉為 RGB 並保存
final_dungeon = canvas.convert('RGB')
final_dungeon.save(OUT_PATH, 'PNG', optimize=True)
print(f"\nAuthentic Diablo II dungeon successfully generated and saved to {OUT_PATH}")
