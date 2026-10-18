"""
角色精靈圖分類映射腳本
將 _chars_raw 和 _chars_exp 的 D2 角色代碼映射到七大職業目錄
D2 角色代碼: AM=Amazon, BA=Barbarian, NE=Necromancer, PA=Paladin, SO=Sorceress, AI=Assassin, DZ=Druid
"""
import os
import shutil

PROJECT_DIR = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))

# D2 角色代碼 -> 職業目錄名
CHAR_CODE_MAP = {
    'AM': 'amazon',
    'BA': 'barbarian',
    'NE': 'necromancer',
    'PA': 'paladin',
    'SO': 'sorceress',
    'AI': 'assassin',
    'DZ': 'druid',
}

def copy_tree(src_dir, dst_dir):
    """複製整個目錄樹"""
    if not os.path.exists(src_dir):
        return 0
    count = 0
    for root, dirs, files in os.walk(src_dir):
        for f in files:
            src = os.path.join(root, f)
            rel = os.path.relpath(src, src_dir)
            dst = os.path.join(dst_dir, rel)
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            if not os.path.exists(dst):
                shutil.copy2(src, dst)
                count += 1
    return count

def main():
    chars_base = os.path.join(PROJECT_DIR, 'assets', 'characters')
    
    # 處理 _chars_raw (原版 d2char.mpq)
    raw_dir = os.path.join(chars_base, '_chars_raw')
    if os.path.exists(raw_dir):
        print("Processing _chars_raw...")
        for code, class_name in CHAR_CODE_MAP.items():
            src = os.path.join(raw_dir, code)
            dst = os.path.join(chars_base, class_name)
            if os.path.exists(src):
                count = copy_tree(src, dst)
                print(f"  {code} -> {class_name}: {count} files")
    
    # 處理 _chars_exp (資料片 d2exp.mpq)
    exp_dir = os.path.join(chars_base, '_chars_exp')
    if os.path.exists(exp_dir):
        print("Processing _chars_exp...")
        for code, class_name in CHAR_CODE_MAP.items():
            src = os.path.join(exp_dir, code)
            dst = os.path.join(chars_base, class_name)
            if os.path.exists(src):
                count = copy_tree(src, dst)
                print(f"  {code} -> {class_name}: {count} files (expansion)")
    
    # 統計最終結果
    print("\n=== Final character asset counts ===")
    for class_name in sorted(CHAR_CODE_MAP.values()):
        class_dir = os.path.join(chars_base, class_name)
        if os.path.exists(class_dir):
            total = sum(1 for _ in os.scandir(class_dir) if _.is_file()) + \
                    sum(len(files) for _, _, files in os.walk(class_dir))
            # 精確計數
            total = 0
            for _, _, files in os.walk(class_dir):
                total += len(files)
            print(f"  {class_name}: {total} files")

if __name__ == '__main__':
    main()
