"""
Diablo II 多樣化原版地牢場景生成器 (Diverse Dungeon Generator)
融合 Catacombs 與 Barracks 80+ 種純淨無文字石磚地磚，
實作無相鄰重複平鋪演算法，徹底根除地面單調重複問題。
"""
import os
import random
from PIL import Image
import numpy as np

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.normpath(os.path.join(SCRIPT_DIR, '..'))
TILES_DIR = os.path.join(PROJECT_DIR, 'assets', 'acts', 'act1', 'tiles_sprites')
OUT_PATH = os.path.join(PROJECT_DIR, 'web', 'assets', 'dungeon', 'catacomb_bg.png')

def extract_clean_diamond_tiles(file_name):
    path = os.path.join(TILES_DIR, file_name)
    im = Image.open(path).convert('RGBA')
    arr = np.array(im)
    
    # 洋紅色過濾
    is_mag = (arr[:, :, 0] > 180) & (arr[:, :, 1] < 60) & (arr[:, :, 2] > 180)
    arr[is_mag] = [0, 0, 0, 0]
    
    rows = im.size[1] // 80
    cols = im.size[0] // 160
    
    tiles = []
    for r in range(1, rows):
        for c in range(cols):
            patch = arr[r*80:(r+1)*80, c*160:(c+1)*160]
            # 檢查是否有文字條或分割白線 (任何白色像素)
            is_white = (patch[:, :, 0] > 200) & (patch[:, :, 1] > 200) & (patch[:, :, 2] > 200)
            if is_white.sum() > 8:
                continue
                
            # 檢查非透明像素數量
            alpha = patch[:, :, 3]
            if (alpha > 0).sum() < 2800:
                continue
                
            tile_pil = Image.fromarray(patch, 'RGBA')
            tiles.append(tile_pil)
            
    return tiles

print("Extracting diverse tiles from Catacombs Floor and Barracks Floor...")
cata_tiles = extract_clean_diamond_tiles('Catacombs Floor.png')
barr_tiles = extract_clean_diamond_tiles('Barracks Floor.png')
all_tiles = cata_tiles + barr_tiles
print(f"Total clean, unique stone tiles extracted: {len(all_tiles)} (Catacombs: {len(cata_tiles)}, Barracks: {len(barr_tiles)})")

# 建立 800x600 畫布 (深石墨黑底色)
canvas = Image.new('RGBA', (800, 600), (10, 10, 14, 255))

# 構建無相鄰重複的交錯平鋪
# X 間隔 160, Y 間隔 40 (交錯網格)
random.seed(42) # 固定隨機種子保證地貌穩定美觀
shuffled_tiles = list(all_tiles)
random.shuffle(shuffled_tiles)

grid_w = 8
grid_h = 18
tile_map = {}

# 預先為每個網格指派不同地磚，確保相鄰不重複
for ry in range(-1, grid_h + 1):
    for rx in range(-2, grid_w + 2):
        # 排除與相鄰 (rx-1, ry), (rx, ry-1), (rx-1, ry-1) 相同的地磚
        forbidden = set()
        if (rx - 1, ry) in tile_map: forbidden.add(tile_map[(rx - 1, ry)])
        if (rx, ry - 1) in tile_map: forbidden.add(tile_map[(rx, ry - 1)])
        if (rx - 1, ry - 1) in tile_map: forbidden.add(tile_map[(rx - 1, ry - 1)])
        if (rx + 1, ry - 1) in tile_map: forbidden.add(tile_map[(rx + 1, ry - 1)])
        
        candidates = [i for i in range(len(shuffled_tiles)) if i not in forbidden]
        chosen = random.choice(candidates if candidates else range(len(shuffled_tiles)))
        tile_map[(rx, ry)] = chosen

# 繪製地面
for y_idx in range(-1, 16):
    y = y_idx * 40
    x_offset = -80 if (y_idx % 2 == 1) else -160
    for x_idx in range(-1, 8):
        x = x_offset + x_idx * 160
        t_idx = tile_map.get((x_idx, y_idx), 0)
        t_img = shuffled_tiles[t_idx % len(shuffled_tiles)]
        canvas.paste(t_img, (x, y), t_img)

# 左右兩側古代石柱裝飾 (增添地牢縱深感)
cata_im = Image.open(os.path.join(TILES_DIR, 'Catacomb.png')).convert('RGBA')
cata_arr = np.array(cata_im)
is_mag = (cata_arr[:, :, 0] > 180) & (cata_arr[:, :, 1] < 60) & (cata_arr[:, :, 2] > 180)
cata_arr[is_mag] = [0, 0, 0, 0]

# 截取一根乾淨無文字的石柱 (避開 y=641 分割白線)
pillar_crop = cata_arr[430:638, 40:130]
# 將石柱切片內任何邊緣純白色像素設為透明
is_p_white = (pillar_crop[:, :, 0] > 200) & (pillar_crop[:, :, 1] > 200) & (pillar_crop[:, :, 2] > 200)
pillar_crop[is_p_white] = [0, 0, 0, 0]
pillar_pil = Image.fromarray(pillar_crop, 'RGBA')

canvas.paste(pillar_pil, (-20, 60), pillar_pil)
canvas.paste(pillar_pil, (730, 60), pillar_pil)

# 保存
final_img = canvas.convert('RGB')
final_img.save(OUT_PATH, 'PNG', optimize=True)
print(f"Successfully generated diverse dungeon background at {OUT_PATH}")
