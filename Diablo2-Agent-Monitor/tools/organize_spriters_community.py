"""
Diablo 2 社群精靈圖分類歸檔腳本 (方案 A - 移動模式)
將 diablo2_sprites 資料夾內的素材依規格移動至 Diablo2-Agent-Monitor/assets/
"""
import os
import shutil
import zipfile
import logging
import uuid

EXEC_ID = str(uuid.uuid4())[:8]
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.normpath(os.path.join(SCRIPT_DIR, '..'))
SOURCE_DIR = os.path.normpath(r"C:\Users\DUCK\Desktop\D2-agy-quest\diablo2_sprites")
TARGET_ASSETS = os.path.join(PROJECT_DIR, 'assets')
LOG_FILE = os.path.join(PROJECT_DIR, 'debug.log')

logger = logging.getLogger('spriters_organizer')
logger.setLevel(logging.DEBUG)
fh = logging.FileHandler(LOG_FILE, mode='a', encoding='utf-8')
fh.setFormatter(logging.Formatter(f'[%(asctime)s] [%(levelname)s] [%(funcName)s] [{EXEC_ID}] %(message)s'))
logger.addHandler(fh)

CLASS_MAP = {
    'Amazon (Heavy)': ('amazon', 'amazon_heavy.gif'),
    'Amazon (Light)': ('amazon', 'amazon_light.gif'),
    'Assassin (Heavy)': ('assassin', 'assassin_heavy.gif'),
    'Assassin (Light)': ('assassin', 'assassin_light.gif'),
    'Assassin (Medium)': ('assassin', 'assassin_medium.gif'),
    'Barbarian (Heavy)': ('barbarian', 'barbarian_heavy.gif'),
    'Barbarian (Light)': ('barbarian', 'barbarian_light.gif'),
    'Barbarian (Medium)': ('barbarian', 'barbarian_medium.gif'),
    'Druid (Heavy)': ('druid', 'druid_heavy.gif'),
    'Druid (Light)': ('druid', 'druid_light.gif'),
    'Druid (Medium)': ('druid', 'druid_medium.gif'),
    'Necromancer (Heavy)': ('necromancer', 'necromancer_heavy.gif'),
    'Necromancer (Light)': ('necromancer', 'necromancer_light.gif'),
    'Necromancer (Medium)': ('necromancer', 'necromancer_medium.gif'),
    'Paladin (Heavy, Heraldic Shield)': ('paladin', 'paladin_heavy_heraldic.gif'),
    'Paladin (Heavy, Tower Shield)': ('paladin', 'paladin_heavy_tower.gif'),
    'Paladin (Light)': ('paladin', 'paladin_light.gif'),
    'Paladin (Medium)': ('paladin', 'paladin_medium.gif'),
    'Sorceress (Heavy)': ('sorceress', 'sorceress_heavy.gif'),
    'Sorceress (Light)': ('sorceress', 'sorceress_light.gif'),
}

def move_file_safe(src, dst):
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    if os.path.exists(dst):
        os.remove(dst)
    shutil.move(src, dst)

def move_directory_contents(src_dir, dst_dir):
    if not os.path.exists(src_dir):
        return 0
    os.makedirs(dst_dir, exist_ok=True)
    count = 0
    for root, dirs, files in os.walk(src_dir):
        for f in files:
            s = os.path.join(root, f)
            rel = os.path.relpath(s, src_dir)
            d = os.path.join(dst_dir, rel)
            os.makedirs(os.path.dirname(d), exist_ok=True)
            if os.path.exists(d):
                os.remove(d)
            shutil.move(s, d)
            count += 1
    # 清除空資料夾
    try:
        shutil.rmtree(src_dir)
    except Exception as e:
        logger.warning(f"Failed to remove source dir {src_dir}: {e}")
    return count

def organize_classes():
    classes_dir = os.path.join(SOURCE_DIR, 'Classes')
    if not os.path.exists(classes_dir):
        print("Classes 目錄不存在或已移動")
        return 0
    
    count = 0
    for filename in os.listdir(classes_dir):
        src = os.path.join(classes_dir, filename)
        if not os.path.isfile(src):
            continue
        base_name, _ = os.path.splitext(filename)
        if base_name in CLASS_MAP:
            char_class, target_name = CLASS_MAP[base_name]
            dst = os.path.join(TARGET_ASSETS, 'characters', char_class, 'spriters', target_name)
            move_file_safe(src, dst)
            count += 1
            print(f"  [職業移動] {filename} -> characters/{char_class}/spriters/{target_name}")
            logger.info(f"Moved {filename} -> characters/{char_class}/spriters/{target_name}")
        else:
            # 未在標準映射中的話直接搬到 characters 通用區
            dst = os.path.join(TARGET_ASSETS, 'characters', '_misc_classes', filename)
            move_file_safe(src, dst)
            count += 1
    try:
        shutil.rmtree(classes_dir)
    except Exception:
        pass
    return count

def organize_enemies_and_bosses():
    eb_dir = os.path.join(SOURCE_DIR, 'Enemies & Bosses')
    if not os.path.exists(eb_dir):
        return 0
    
    target_dir = os.path.join(TARGET_ASSETS, 'acts', '_enemies_bosses_sprites')
    os.makedirs(target_dir, exist_ok=True)
    count = 0

    for filename in os.listdir(eb_dir):
        src = os.path.join(eb_dir, filename)
        if os.path.isfile(src):
            if filename.lower().endswith('.zip'):
                # 解壓 zip 內容至同名目錄
                base_name, _ = os.path.splitext(filename)
                extract_path = os.path.join(target_dir, base_name)
                os.makedirs(extract_path, exist_ok=True)
                try:
                    with zipfile.ZipFile(src, 'r') as z:
                        z.extractall(extract_path)
                    print(f"  [解壓怪獸] {filename} -> acts/_enemies_bosses_sprites/{base_name}/")
                    logger.info(f"Extracted {filename} to {extract_path}")
                    os.remove(src)
                    count += 1
                except Exception as e:
                    logger.exception(f"Failed to unzip {src}: {e}")
                    # 直接移動 zip
                    shutil.move(src, os.path.join(target_dir, filename))
                    count += 1
            else:
                dst = os.path.join(target_dir, filename)
                move_file_safe(src, dst)
                count += 1
        elif os.path.isdir(src):
            dst = os.path.join(target_dir, filename)
            shutil.move(src, dst)
            count += 1
            
    try:
        shutil.rmtree(eb_dir)
    except Exception:
        pass
    return count

def main():
    print("=" * 60)
    print("開始執行社群精靈圖移動與分類 (方案 A)")
    print("=" * 60)

    total_moved = 0

    # 1. Classes -> characters/<class>/spriters/
    print("\n[1/7] 整理七大職業預組裝精靈圖...")
    n = organize_classes()
    total_moved += n
    print(f"  職業精靈圖共處理: {n} 個")

    # 2. Tiles -> acts/act1~5/tiles_sprites/
    print("\n[2/7] 整理各幕場景地磚...")
    for act_num in range(1, 6):
        src_tile = os.path.join(SOURCE_DIR, f'Act {act_num} Tiles')
        dst_tile = os.path.join(TARGET_ASSETS, 'acts', f'act{act_num}', 'tiles_sprites')
        n = move_directory_contents(src_tile, dst_tile)
        total_moved += n
        print(f"  Act {act_num} Tiles: 移動 {n} 個檔案 -> acts/act{act_num}/tiles_sprites/")

    # 3. Enemies & Bosses -> acts/_enemies_bosses_sprites/
    print("\n[3/7] 整理敵人與 Boss 精靈圖...")
    n = organize_enemies_and_bosses()
    total_moved += n
    print(f"  Enemies & Bosses: 處理 {n} 個項目 (含自動解壓 ZIP)")

    # 4. Battle.net Chat Avatars -> ui/avatars/
    print("\n[4/7] 整理 Battle.net 聊天頭像...")
    src_avatars = os.path.join(SOURCE_DIR, 'Battle.net Chat Avatars')
    dst_avatars = os.path.join(TARGET_ASSETS, 'ui', 'avatars')
    n = move_directory_contents(src_avatars, dst_avatars)
    total_moved += n
    print(f"  Chat Avatars: 移動 {n} 個頭像 -> ui/avatars/")

    # 5. Non-Playable Characters -> characters/npcs/
    print("\n[5/7] 整理 NPC 精靈圖...")
    src_npcs = os.path.join(SOURCE_DIR, 'Non-Playable Characters')
    dst_npcs = os.path.join(TARGET_ASSETS, 'characters', 'npcs')
    n = move_directory_contents(src_npcs, dst_npcs)
    total_moved += n
    print(f"  NPCs: 移動 {n} 個精靈圖 -> characters/npcs/")

    # 6. Parts 類 (Rogue, Zealot, Zombie, Fallen)
    print("\n[6/7] 整理組裝零件庫 (Parts)...")
    parts_map = [
        ('Rogue Parts', os.path.join(TARGET_ASSETS, 'characters', 'mercenaries', 'act1_rogue', 'parts')),
        ('Zombie Parts', os.path.join(TARGET_ASSETS, 'acts', 'act1', 'monsters', 'zombie_parts')),
        ('Fallen Parts', os.path.join(TARGET_ASSETS, 'acts', 'act1', 'monsters', 'fallen_parts')),
        ('Zealot Parts', os.path.join(TARGET_ASSETS, 'acts', 'act3', 'monsters', 'zealot_parts')),
    ]
    for src_sub, dst_sub in parts_map:
        src_p = os.path.join(SOURCE_DIR, src_sub)
        n = move_directory_contents(src_p, dst_sub)
        total_moved += n
        rel_dst = os.path.relpath(dst_sub, TARGET_ASSETS)
        print(f"  {src_sub}: 移動 {n} 個檔案 -> {rel_dst}")

    # 7. Objects & Animals
    print("\n[7/7] 整理場景物件與小動物...")
    n_obj = move_directory_contents(os.path.join(SOURCE_DIR, 'Objects'), os.path.join(TARGET_ASSETS, 'acts', '_objects_sprites'))
    n_ani = move_directory_contents(os.path.join(SOURCE_DIR, 'Animals'), os.path.join(TARGET_ASSETS, 'acts', '_animals_sprites'))
    total_moved += n_obj + n_ani
    print(f"  Objects: 移動 {n_obj} 個檔案 -> acts/_objects_sprites/")
    print(f"  Animals: 移動 {n_ani} 個檔案 -> acts/_animals_sprites/")

    # 檢查 source 目錄是否已全空
    remaining = []
    if os.path.exists(SOURCE_DIR):
        for root, dirs, files in os.walk(SOURCE_DIR):
            for f in files:
                remaining.append(os.path.join(root, f))
    
    print("\n" + "=" * 60)
    print(f"移動歸檔全數完成！共移動/處理 {total_moved} 個資產項目。")
    if remaining:
        print(f"⚠ 原資料夾剩餘未處理檔案: {len(remaining)} 個")
    else:
        print("✓ 原 diablo2_sprites 資料夾中所有素材已 100% 清空並移動至專案中！")
        try:
            os.rmdir(SOURCE_DIR)
            print("✓ 原始已清空的空目錄已完成清理。")
        except Exception:
            pass
    print("=" * 60)
    logger.info(f"Migration completed. Total assets moved: {total_moved}, remaining: {len(remaining)}")

if __name__ == '__main__':
    main()
