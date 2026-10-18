"""
Diablo II 等距菱形石磚地牢地面無縫拼貼生成器
將 160x80 的原版安達利爾地牢菱形地磚 (Andariel Floor) 以 2:1 等距幾何無縫咬合，
生成乾淨、正統、無洋紅色的 800x600 地牢背景。
"""
from PIL import Image
import numpy as np
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.normpath(os.path.join(SCRIPT_DIR, '..'))
FLOOR_SRC = os.path.join(PROJECT_DIR, 'assets', 'acts', 'act1', 'tiles_sprites', 'Catacombs Floor.png')
OUT_PATH = os.path.join(PROJECT_DIR, 'web', 'assets', 'dungeon', 'catacomb_bg.png')

im = Image.open(FLOOR_SRC).convert('RGBA')
arr = np.array(im)

# 将洋红色 (255, 0, 255) 过滤为完全透明
is_magenta = (arr[:, :, 0] > 180) & (arr[:, :, 1] < 60) & (arr[:, :, 2] > 180)
arr[is_magenta] = [0, 0, 0, 0]

# 提取几个不同的 160x80 菱形地砖 (跳过第一格带文字的区域)
tiles = []
# row 1: y=80..160
for c in range(5):
    patch = arr[80:160, c*160:(c+1)*160]
    # check if has pixels
    if (patch[:, :, 3] > 0).sum() > 2000:
        tiles.append(Image.fromarray(patch, 'RGBA'))

# row 2: y=160..240
for c in range(5):
    patch = arr[160:240, c*160:(c+1)*160]
    if (patch[:, :, 3] > 0).sum() > 2000:
        tiles.append(Image.fromarray(patch, 'RGBA'))

# row 3: y=240..320
for c in range(5):
    patch = arr[240:320, c*160:(c+1)*160]
    if (patch[:, :, 3] > 0).sum() > 2000:
        tiles.append(Image.fromarray(patch, 'RGBA'))

print(f"Extracted {len(tiles)} distinct clean isometric floor tiles.")

# 创建 800x600 地牢画布 (底色为深石灰暗黑底色)
out_bg = Image.new('RGBA', (800, 600), (12, 12, 15, 255))

# 等距交错平铺:
# X 步长为 160, Y 步长为 40 (交错奇数行偏移 80)
tile_idx = 0
for y in range(-40, 640, 40):
    row_idx = (y + 40) // 40
    x_offset = -80 if (row_idx % 2 == 1) else -160
    for x in range(x_offset, 880, 160):
        t = tiles[tile_idx % len(tiles)]
        out_bg.paste(t, (x, y), t)
        tile_idx = (tile_idx * 7 + 3) % len(tiles)

out_bg = out_bg.convert('RGB')
out_bg.save(OUT_PATH, 'PNG', optimize=True)
print("Saved stitched dungeon floor to", OUT_PATH)
