"""
Diablo II Authentic Multi-Scene Dungeon Generator (Clean Diamond Tessellation)
嚴格過濾原版精靈圖中的文字、白邊、黑洞與殘缺瓦片，
以純粹 160x80 原廠菱形地磚與等距無相鄰重複平鋪演算法，
生成 100% 滿版無縫、無黑洞、無文字雜訊的 Act 1 經典場景。
"""
import os
import random
from PIL import Image
import numpy as np

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.normpath(os.path.join(SCRIPT_DIR, '..'))
TILES_DIR = os.path.join(PROJECT_DIR, 'assets', 'acts', 'act1', 'tiles_sprites')
OUT_DIR = os.path.join(PROJECT_DIR, 'web', 'assets', 'dungeon')
os.makedirs(OUT_DIR, exist_ok=True)

def extract_valid_diamond_tiles(file_name, max_black_ratio=0.15, min_mean=15):
    path = os.path.join(TILES_DIR, file_name)
    if not os.path.exists(path):
        print(f"[WARN] File not found: {path}")
        return []
    
    im = Image.open(path).convert('RGBA')
    arr = np.array(im)
    rows = im.size[1] // 80
    cols = im.size[0] // 160
    
    clean_tiles = []
    # 跳過第 0 行 (常包含作者文字、分類標籤、EXIT 標記等雜訊)
    for r in range(1, rows):
        for c in range(cols):
            patch = arr[r*80:(r+1)*80, c*160:(c+1)*160].copy()
            # 判定洋紅背景 (255, 0, 255)
            is_mag = (patch[:, :, 0] > 180) & (patch[:, :, 1] < 60) & (patch[:, :, 2] > 180)
            # 判定純白文字/分割線
            is_white = (patch[:, :, 0] > 230) & (patch[:, :, 1] > 230) & (patch[:, :, 2] > 230)
            
            # 若含有白字則剔除
            if is_white.sum() > 6:
                continue
                
            non_bg_pixels = patch[(~is_mag) & (~is_white)]
            # 標準 160x80 菱形面積為 6400 像素，非背景像素需充足
            if len(non_bg_pixels) < 5600:
                continue
                
            # 檢查是否含有大片死黑空洞 (岩壁遮罩殘留)
            is_black = (non_bg_pixels[:, 0] < 12) & (non_bg_pixels[:, 1] < 12) & (non_bg_pixels[:, 2] < 12)
            black_ratio = is_black.sum() / len(non_bg_pixels)
            if black_ratio > max_black_ratio:
                continue
                
            if non_bg_pixels.mean() < min_mean:
                continue
                
            # 將洋紅背景與純白邊緣設為完全透明
            patch[is_mag] = [0, 0, 0, 0]
            patch[is_white] = [0, 0, 0, 0]
            clean_tiles.append(Image.fromarray(patch, 'RGBA'))
            
    print(f"[{file_name}] Extracted {len(clean_tiles)} pure seamless diamond tiles.")
    return clean_tiles

def build_seamless_dungeon(tiles, out_name, decor_builder=None, seed=42):
    if not tiles:
        print(f"[ERROR] No tiles available for {out_name}")
        return
        
    random.seed(seed)
    shuffled = list(tiles)
    random.shuffle(shuffled)
    
    # 建立 800x600 深色暗黑基底畫布
    canvas = Image.new('RGBA', (800, 600), (8, 9, 12, 255))
    
    # 建立無相鄰重複索引矩陣
    tile_map = {}
    for ry in range(-2, 20):
        for rx in range(-3, 10):
            forbidden = set()
            for dx, dy in [(-1, 0), (0, -1), (-1, -1), (1, -1)]:
                if (rx + dx, ry + dy) in tile_map:
                    forbidden.add(tile_map[(rx + dx, ry + dy)])
            candidates = [i for i in range(len(shuffled)) if i not in forbidden]
            chosen = random.choice(candidates if candidates else range(len(shuffled)))
            tile_map[(rx, ry)] = chosen
            
    # 正統 2.5D 等距菱形密鋪 (Diamond Staggered Grid)
    # y 軸步長 40 (地磚高度 80 之半)
    # 偶數行 x 偏移 -160, 奇數行 x 偏移 -80
    for y_idx in range(-2, 17):
        y = y_idx * 40
        x_offset = -80 if (abs(y_idx) % 2 == 1) else -160
        for x_idx in range(-2, 9):
            x = x_offset + x_idx * 160
            t_idx = tile_map.get((x_idx, y_idx), 0)
            t = shuffled[t_idx % len(shuffled)]
            canvas.paste(t, (x, y), t)
            
    # 附加立體氛圍裝飾 (石柱/牆角)
    if decor_builder:
        decor_builder(canvas)
        
    out_path = os.path.join(OUT_DIR, out_name)
    canvas.convert('RGB').save(out_path, 'PNG', optimize=True)
    print(f"[SUCCESS] Saved clean authentic scene: {out_path}")

def main():
    print("=== Generating 100% Clean Authentic Diablo II Scenes ===")
    
    # 1. 地下墓穴 (Catacombs)
    cata_tiles = extract_valid_diamond_tiles('Catacombs Floor.png', max_black_ratio=0.10)
    def cata_decor(cv):
        c_path = os.path.join(TILES_DIR, 'Catacomb.png')
        if os.path.exists(c_path):
            im = Image.open(c_path).convert('RGBA')
            arr = np.array(im)
            is_m = (arr[:, :, 0] > 180) & (arr[:, :, 1] < 60) & (arr[:, :, 2] > 180)
            arr[is_m] = [0, 0, 0, 0]
            # 兩側立體石柱
            p1 = arr[430:638, 40:130]
            p2 = arr[430:638, 180:270]
            p1_img = Image.fromarray(p1, 'RGBA')
            p2_img = Image.fromarray(p2, 'RGBA')
            cv.paste(p1_img, (15, 60), p1_img)
            cv.paste(p2_img, (695, 60), p2_img)
    build_seamless_dungeon(cata_tiles, 'catacomb_bg.png', cata_decor, seed=101)
    
    # 2. 修道院兵營 (Barracks)
    barr_tiles = extract_valid_diamond_tiles('Barracks Floor.png', max_black_ratio=0.12)
    build_seamless_dungeon(barr_tiles, 'barracks_bg.png', seed=202)
    
    # 3. 邪惡洞窟 (Cave)
    cave_tiles = extract_valid_diamond_tiles('Cave Floor.png', max_black_ratio=0.14)
    build_seamless_dungeon(cave_tiles, 'cave_bg.png', seed=303)
    
    # 4. 崔斯特姆 (Tristram) - 結合純淨焦土地表與廢墟石板
    trist_tiles = extract_valid_diamond_tiles('Tristram Ground.png', max_black_ratio=0.18, min_mean=18)
    if len(trist_tiles) < 10:
        # 若過濾後較少，融合部分 Cathedral 石板營造小鎮焦黑石路
        extra = extract_valid_diamond_tiles('Cathedral Floor.png', max_black_ratio=0.15)
        trist_tiles += extra[:15]
    build_seamless_dungeon(trist_tiles, 'tristram_bg.png', seed=404)
    
    # 5. 大教堂神聖大廳 (Cathedral)
    cath_tiles = extract_valid_diamond_tiles('Cathedral Floor.png', max_black_ratio=0.12)
    build_seamless_dungeon(cath_tiles, 'cathedral_bg.png', seed=505)

if __name__ == "__main__":
    main()
