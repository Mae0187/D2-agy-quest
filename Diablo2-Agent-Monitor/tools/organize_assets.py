"""
Diablo II 素材分類歸檔腳本
將 MPQ 提取出的原始檔案依據專案規格書分類整理到 Diablo2-Agent-Monitor 目錄結構
"""
import os
import shutil
import logging
import uuid
import glob

EXEC_ID = str(uuid.uuid4())[:8]
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.normpath(os.path.join(SCRIPT_DIR, '..'))
RAW_BASE = os.path.normpath(os.path.join(SCRIPT_DIR, 'mpq_raw'))
LOG_FILE = os.path.join(PROJECT_DIR, 'debug.log')

logger = logging.getLogger('asset_organizer')
logger.setLevel(logging.DEBUG)
fh = logging.FileHandler(LOG_FILE, mode='a', encoding='utf-8')
fh.setLevel(logging.DEBUG)
fmt = logging.Formatter(f'[%(asctime)s] [%(levelname)s] [%(funcName)s] [{EXEC_ID}] %(message)s')
fh.setFormatter(fmt)
logger.addHandler(fh)

# 計數器
stats = {'copied': 0, 'skipped': 0, 'errors': 0}

def safe_copy(src, dst):
    """安全複製檔案"""
    try:
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        if not os.path.exists(dst):
            shutil.copy2(src, dst)
            stats['copied'] += 1
        else:
            stats['skipped'] += 1
    except Exception as e:
        stats['errors'] += 1
        logger.exception(f"Copy failed: {src} -> {dst}")

def copy_tree(src_dir, dst_dir, extensions=None):
    """複製整個目錄樹 (可選副檔名篩選)"""
    if not os.path.exists(src_dir):
        logger.warning(f"Source not found: {src_dir}")
        return 0
    
    count = 0
    for root, dirs, files in os.walk(src_dir):
        for f in files:
            if extensions:
                if not any(f.lower().endswith(ext) for ext in extensions):
                    continue
            src = os.path.join(root, f)
            rel = os.path.relpath(src, src_dir)
            dst = os.path.join(dst_dir, rel)
            safe_copy(src, dst)
            count += 1
    return count


def organize_sounds():
    """分類音效資源到 sounds/ 目錄"""
    print("\n[1/5] 整理音效資源...")
    sfx_base = os.path.join(RAW_BASE, 'd2sfx', 'DATA', 'GLOBAL', 'SFX')
    sounds_dir = os.path.join(PROJECT_DIR, 'sounds')
    
    # 環境音效 -> sounds/ambient/
    ambient_src = os.path.join(sfx_base, 'ambient')
    copy_tree(ambient_src, os.path.join(sounds_dir, 'ambient'), ['.wav', '.flac'])
    
    # 物件音效 (營火、寶箱等) -> sounds/ambient/
    object_src = os.path.join(sfx_base, 'object')
    copy_tree(object_src, os.path.join(sounds_dir, 'ambient', 'objects'), ['.wav', '.flac'])
    
    # 戰鬥音效 -> sounds/combat/
    combat_src = os.path.join(sfx_base, 'combat')
    copy_tree(combat_src, os.path.join(sounds_dir, 'combat'), ['.wav', '.flac'])
    
    # 技能音效 -> sounds/combat/skills/
    skill_src = os.path.join(sfx_base, 'skill')
    copy_tree(skill_src, os.path.join(sounds_dir, 'combat', 'skills'), ['.wav', '.flac'])
    
    # 怪物音效 -> sounds/combat/monsters/
    monster_src = os.path.join(sfx_base, 'monster')
    copy_tree(monster_src, os.path.join(sounds_dir, 'combat', 'monsters'), ['.wav', '.flac'])
    
    # 任務音效 -> sounds/ui/quest/
    quest_src = os.path.join(sfx_base, 'quest')
    copy_tree(quest_src, os.path.join(sounds_dir, 'ui', 'quest'), ['.wav', '.flac'])
    
    # 物品音效 -> sounds/loot/
    item_src = os.path.join(sfx_base, 'item')
    copy_tree(item_src, os.path.join(sounds_dir, 'loot'), ['.wav', '.flac'])
    
    # 游標/UI 音效 -> sounds/ui/
    cursor_src = os.path.join(sfx_base, 'cursor')
    copy_tree(cursor_src, os.path.join(sounds_dir, 'ui', 'cursor'), ['.wav', '.flac'])
    
    # d2exp 額外音效
    exp_sfx = os.path.join(RAW_BASE, 'd2exp', 'data', 'global', 'sfx')
    if os.path.exists(exp_sfx):
        copy_tree(exp_sfx, os.path.join(sounds_dir, 'combat', 'expansion'), ['.wav', '.flac'])
    
    print(f"  音效整理完成")


def organize_ui():
    """分類 UI 資源到 assets/ui/ 目錄"""
    print("\n[2/5] 整理 UI 資源...")
    ui_base = os.path.join(RAW_BASE, 'd2data', 'data', 'global', 'ui')
    ui_dst = os.path.join(PROJECT_DIR, 'assets', 'ui')
    
    # 面板 (血球/藍球/經驗條/底部欄) -> assets/ui/panel/
    panel_src = os.path.join(ui_base, 'PANEL')
    copy_tree(panel_src, os.path.join(ui_dst, 'panel'))
    
    # 字型 -> assets/ui/font/
    font_src = os.path.join(ui_base, 'FONT')
    copy_tree(font_src, os.path.join(ui_dst, 'font'))
    
    # 前端選單 (營火角色選單背景) -> assets/ui/frontend/
    frontend_src = os.path.join(ui_base, 'FrontEnd')
    copy_tree(frontend_src, os.path.join(ui_dst, 'frontend'))
    
    # 角色選擇畫面 -> assets/ui/charselect/
    charsel_src = os.path.join(ui_base, 'CharSelect')
    copy_tree(charsel_src, os.path.join(ui_dst, 'charselect'))
    
    # Logo -> assets/ui/logo/
    logo_src = os.path.join(ui_base, 'Logo')
    copy_tree(logo_src, os.path.join(ui_dst, 'logo'))
    
    # 大選單 -> assets/ui/bigmenu/
    bigmenu_src = os.path.join(ui_base, 'BIGMENU')
    copy_tree(bigmenu_src, os.path.join(ui_dst, 'bigmenu'))
    
    # 技能圖示 -> assets/ui/spells/
    spells_src = os.path.join(ui_base, 'SPELLS')
    copy_tree(spells_src, os.path.join(ui_dst, 'spells'))
    
    # 小地圖 -> assets/ui/minimap/
    minimap_src = os.path.join(ui_base, 'MINIMAP')
    copy_tree(minimap_src, os.path.join(ui_dst, 'minimap'))
    
    # 讀取畫面 -> assets/ui/loading/
    loading_src = os.path.join(ui_base, 'Loading')
    copy_tree(loading_src, os.path.join(ui_dst, 'loading'))
    
    # Widgets (小工具) -> assets/ui/widgets/
    widgets_src = os.path.join(ui_base, 'WIDGETS')
    copy_tree(widgets_src, os.path.join(ui_dst, 'widgets'))
    
    # 傭兵介面 -> assets/ui/hireables/
    hire_src = os.path.join(ui_base, 'HIREABLES')
    copy_tree(hire_src, os.path.join(ui_dst, 'hireables'))
    
    # 游標 -> assets/ui/cursor/
    cursor_src = os.path.join(ui_base, 'CURSOR')
    copy_tree(cursor_src, os.path.join(ui_dst, 'cursor'))
    
    # d2exp UI 補充
    exp_ui = os.path.join(RAW_BASE, 'd2exp', 'data', 'global', 'ui')
    if os.path.exists(exp_ui):
        for sub in os.listdir(exp_ui):
            sub_src = os.path.join(exp_ui, sub)
            if os.path.isdir(sub_src):
                copy_tree(sub_src, os.path.join(ui_dst, sub.lower()))
    
    print(f"  UI 資源整理完成")


def organize_tiles():
    """分類場景地磚到 assets/acts/ 目錄"""
    print("\n[3/5] 整理場景地磚...")
    
    # d2data 地磚
    tiles_base = os.path.join(RAW_BASE, 'd2data', 'data', 'global', 'tiles')
    
    act_mapping = {
        'ACT1': 'act1', 'ACT2': 'act2', 'ACT3': 'act3', 'ACT4': 'act4',
    }
    
    for src_name, dst_name in act_mapping.items():
        src = os.path.join(tiles_base, src_name)
        dst = os.path.join(PROJECT_DIR, 'assets', 'acts', dst_name, 'tiles')
        copy_tree(src, dst)
    
    # d2exp 地磚 (Act 5)
    exp_tiles = os.path.join(RAW_BASE, 'd2exp', 'data', 'global', 'tiles')
    if os.path.exists(exp_tiles):
        for sub in os.listdir(exp_tiles):
            sub_path = os.path.join(exp_tiles, sub)
            if os.path.isdir(sub_path):
                if 'act5' in sub.lower() or sub.lower().startswith('act5'):
                    copy_tree(sub_path, os.path.join(PROJECT_DIR, 'assets', 'acts', 'act5', 'tiles', sub))
                else:
                    # 對照已有的 act 地磚做覆蓋補充
                    for act_key, act_dst in act_mapping.items():
                        if sub.upper() == act_key:
                            copy_tree(sub_path, os.path.join(PROJECT_DIR, 'assets', 'acts', act_dst, 'tiles'))
                            break
                    else:
                        copy_tree(sub_path, os.path.join(PROJECT_DIR, 'assets', 'acts', 'act5', 'tiles', sub))
    
    # 調色盤 -> 各幕對應目錄
    palette_base = os.path.join(RAW_BASE, 'd2data', 'data', 'global', 'palette')
    for act_name in ['ACT1','ACT2','ACT3','ACT4','ACT5']:
        src = os.path.join(palette_base, act_name)
        dst_act = act_name.lower().replace('act', 'act')
        dst = os.path.join(PROJECT_DIR, 'assets', 'acts', dst_act, 'palette')
        copy_tree(src, dst)
    
    # 額外調色盤 (fechar, loading 等)
    for special in ['fechar','loading','Menu0','menu1','menu2','menu3','menu4','EndGame','STATIC','Units']:
        src = os.path.join(palette_base, special)
        if os.path.exists(src):
            copy_tree(src, os.path.join(PROJECT_DIR, 'assets', 'ui', 'palette', special.lower()))
    
    # d2exp 調色盤
    exp_pal = os.path.join(RAW_BASE, 'd2exp', 'data', 'global', 'palette')
    if os.path.exists(exp_pal):
        for sub in os.listdir(exp_pal):
            src = os.path.join(exp_pal, sub)
            if os.path.isdir(src):
                if 'act5' in sub.lower():
                    copy_tree(src, os.path.join(PROJECT_DIR, 'assets', 'acts', 'act5', 'palette'))
                else:
                    copy_tree(src, os.path.join(PROJECT_DIR, 'assets', 'ui', 'palette', sub.lower()))
    
    print(f"  場景地磚整理完成")


def organize_monsters():
    """分類怪物資源到 assets/acts/ 目錄"""
    print("\n[4/5] 整理怪物與物件資源...")
    
    # d2data 怪物
    mon_base = os.path.join(RAW_BASE, 'd2data', 'data', 'global', 'monsters')
    if os.path.exists(mon_base):
        copy_tree(mon_base, os.path.join(PROJECT_DIR, 'assets', 'acts', '_monsters_raw'))
    
    # d2data 物件 (營火、寶箱等)
    obj_base = os.path.join(RAW_BASE, 'd2data', 'data', 'global', 'objects')
    if os.path.exists(obj_base):
        copy_tree(obj_base, os.path.join(PROJECT_DIR, 'assets', 'acts', '_objects_raw'))
    
    # d2data 投射物/法術特效
    miss_base = os.path.join(RAW_BASE, 'd2data', 'data', 'global', 'missiles')
    if os.path.exists(miss_base):
        copy_tree(miss_base, os.path.join(PROJECT_DIR, 'assets', 'acts', '_missiles_raw'))
    
    # d2data 覆蓋層特效
    ovl_base = os.path.join(RAW_BASE, 'd2data', 'data', 'global', 'overlays')
    if os.path.exists(ovl_base):
        copy_tree(ovl_base, os.path.join(PROJECT_DIR, 'assets', 'acts', '_overlays_raw'))
    
    # d2exp 怪物 (資料片怪物)
    exp_mon = os.path.join(RAW_BASE, 'd2exp', 'data', 'global', 'monsters')
    if os.path.exists(exp_mon):
        copy_tree(exp_mon, os.path.join(PROJECT_DIR, 'assets', 'acts', '_monsters_exp'))
    
    # d2exp 物件
    exp_obj = os.path.join(RAW_BASE, 'd2exp', 'data', 'global', 'objects')
    if os.path.exists(exp_obj):
        copy_tree(exp_obj, os.path.join(PROJECT_DIR, 'assets', 'acts', '_objects_exp'))
    
    # d2exp 投射物
    exp_miss = os.path.join(RAW_BASE, 'd2exp', 'data', 'global', 'missiles')
    if os.path.exists(exp_miss):
        copy_tree(exp_miss, os.path.join(PROJECT_DIR, 'assets', 'acts', '_missiles_exp'))
    
    # d2exp 覆蓋層
    exp_ovl = os.path.join(RAW_BASE, 'd2exp', 'data', 'global', 'overlays')
    if os.path.exists(exp_ovl):
        copy_tree(exp_ovl, os.path.join(PROJECT_DIR, 'assets', 'acts', '_overlays_exp'))
    
    # d2data 道具圖示
    items_base = os.path.join(RAW_BASE, 'd2data', 'data', 'global', 'items')
    if os.path.exists(items_base):
        copy_tree(items_base, os.path.join(PROJECT_DIR, 'assets', 'items', 'base'))
    
    # d2exp 道具圖示
    exp_items = os.path.join(RAW_BASE, 'd2exp', 'data', 'global', 'items')
    if os.path.exists(exp_items):
        copy_tree(exp_items, os.path.join(PROJECT_DIR, 'assets', 'items', 'expansion'))
    
    print(f"  怪物與物件資源整理完成")


def organize_characters():
    """分類角色精靈圖到 assets/characters/ 目錄"""
    print("\n[5/5] 整理角色精靈圖...")
    
    # d2char 角色資源
    chars_base = os.path.join(RAW_BASE, 'd2char', 'data', 'global', 'CHARS')
    if os.path.exists(chars_base):
        copy_tree(chars_base, os.path.join(PROJECT_DIR, 'assets', 'characters', '_chars_raw'))
    
    # d2exp 角色資源 (資料片職業: 刺客、德魯伊)
    exp_chars = os.path.join(RAW_BASE, 'd2exp', 'data', 'global', 'CHARS')
    if os.path.exists(exp_chars):
        copy_tree(exp_chars, os.path.join(PROJECT_DIR, 'assets', 'characters', '_chars_exp'))
    
    # Excel 資料表 (怪物/道具/技能數據)
    excel_base = os.path.join(RAW_BASE, 'd2data', 'data', 'global', 'excel')
    if os.path.exists(excel_base):
        copy_tree(excel_base, os.path.join(PROJECT_DIR, 'assets', '_data_tables', 'base'))
    
    exp_excel = os.path.join(RAW_BASE, 'd2exp', 'data', 'global', 'excel')
    if os.path.exists(exp_excel):
        copy_tree(exp_excel, os.path.join(PROJECT_DIR, 'assets', '_data_tables', 'expansion'))
    
    # Patch 補丁資源覆蓋
    patch_base = os.path.join(RAW_BASE, 'Patch_D2', 'data')
    if os.path.exists(patch_base):
        copy_tree(patch_base, os.path.join(PROJECT_DIR, 'assets', '_patch_overrides'))
    
    print(f"  角色資源整理完成")


def print_summary():
    """列印統計摘要"""
    print("\n" + "=" * 60)
    print("素材分類歸檔統計")
    print("=" * 60)
    print(f"  複製: {stats['copied']} 個檔案")
    print(f"  跳過 (已存在): {stats['skipped']} 個")
    print(f"  錯誤: {stats['errors']} 個")
    
    # 統計各目錄大小
    for dirname in ['assets', 'sounds']:
        dirpath = os.path.join(PROJECT_DIR, dirname)
        if os.path.exists(dirpath):
            total_size = 0
            total_files = 0
            for root, dirs, files in os.walk(dirpath):
                for f in files:
                    fp = os.path.join(root, f)
                    total_size += os.path.getsize(fp)
                    total_files += 1
            print(f"  {dirname}/: {total_files} 檔案, {total_size / 1024 / 1024:.1f} MB")
    
    print("=" * 60)


def main():
    print("=" * 60)
    print("Diablo II 素材分類歸檔工具")
    print(f"來源: {RAW_BASE}")
    print(f"目標: {PROJECT_DIR}")
    print("=" * 60)
    
    if not os.path.exists(RAW_BASE):
        print("ERROR: 原始素材目錄不存在，請先執行 extract_mpq.py")
        return
    
    organize_sounds()
    organize_ui()
    organize_tiles()
    organize_monsters()
    organize_characters()
    print_summary()


if __name__ == '__main__':
    main()
