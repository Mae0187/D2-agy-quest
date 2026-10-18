"""
Boss 和怪物精確分類腳本
將 _monsters_raw / _monsters_exp 的怪物代碼分類到對應的五幕目錄
依據 Diablo II 原版怪物代碼對應關係
"""
import os
import shutil
import logging
import uuid

EXEC_ID = str(uuid.uuid4())[:8]
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.normpath(os.path.join(SCRIPT_DIR, '..'))
LOG_FILE = os.path.join(PROJECT_DIR, 'debug.log')

logger = logging.getLogger('monster_classifier')
logger.setLevel(logging.DEBUG)
fh = logging.FileHandler(LOG_FILE, mode='a', encoding='utf-8')
fh.setFormatter(logging.Formatter(f'[%(asctime)s] [%(levelname)s] [%(funcName)s] [{EXEC_ID}] %(message)s'))
logger.addHandler(fh)

# ===== D2 怪物代碼 -> (幕別, 分類, 中文名) =====
# 五大 Boss
BOSS_MAP = {
    'AN': ('act1', 'boss', '安達利爾 Andariel'),
    'DU': ('act2', 'boss', '督瑞爾 Duriel'),
    'ME': ('act3', 'boss', '墨菲斯托 Mephisto'),
    'DI': ('act4', 'boss', '迪亞布羅 Diablo'),
    'BA': ('act5', 'boss', '巴爾 Baal'),        # 若在 monsters 裡
}

# Act1 常見怪物
ACT1_MONSTERS = {
    'FA': ('act1', 'fallen', '沉淪魔 Fallen'),
    'FM': ('act1', 'fallen', '沉淪魔巫師 Fallen Shaman'),
    'SK': ('act1', 'skeleton', '骷髏兵 Skeleton'),
    'RG': ('act1', 'mercenary', '羅格弓手（傭兵）Rogue'),
    'ZM': ('act1', 'zombie', '殭屍 Zombie'),
    'BH': ('act1', 'bloodhawk', '血鷹 Blood Hawk'),
    'CR': ('act1', 'carver', '沉淪武士 Carver'),
    'CO': ('act1', 'corrupt_rogue', '墮落修女 Corrupt Rogue'),
    'GH': ('act1', 'ghostly', '幽魂 Ghostly'),
    'SC': ('act1', 'sand_raider', '沙地劫匪 Sand Raider'),
    'WA': ('act1', 'wendigo', '食人鬼 Wendigo'),
}

# Act2 常見怪物
ACT2_MONSTERS = {
    'MQ': ('act2', 'mercenary', '沙漠長槍兵（傭兵）Desert Mercenary'),
    'MA': ('act2', 'sand_maggot', '沙蟲 Sand Maggot'),
    'VM': ('act2', 'viper', '爪牙蝮蛇 Claw Viper'),
    'MY': ('act2', 'mummy', '木乃伊 Mummy'),
    'SP': ('act2', 'sand_leaper', '沙躍鬼 Sand Leaper'),
    'SU': ('act2', 'servant', '古墓仆從 Unraveler'),
    'SD': ('act2', 'sand_dweller', '沙漠潛伏者 Sand Dweller'),
    'SM': ('act2', 'scarab', '金甲蟲 Scarab'),
    'SS': ('act2', 'skeleton_archer', '骷髏弓手 Skeleton Archer'),
    'SW': ('act2', 'swarm', '蟲群 Swarm'),
    'G1': ('act2', 'greater_hell_spawn', '地獄火人 Greater Hell Spawn'),
    'G2': ('act2', 'greater_hell_spawn', '地獄火人 Greater Hell Spawn 2'),
}

# Act3 常見怪物
ACT3_MONSTERS = {
    'IW': ('act3', 'mercenary', '鐵狼法師（傭兵）Iron Wolf'),
    'FE': ('act3', 'flayer', '小矮人 Flayer'),
    'FK': ('act3', 'flayer_shaman', '小矮人薩滿 Flayer Shaman'),
    'ST': ('act3', 'stygian_doll', '冥河娃娃 Stygian Doll'),
    'CM': ('act3', 'council', '崔凡克議會 Council Member'),
    'GZ': ('act3', 'ghoul', '食屍鬼 Ghoul'),
    'SB': ('act3', 'slinger', '投石手 Slinger'),
    'BK': ('act3', 'bone_knight', '骨甲騎士 Bone Knight'),
    'OR': ('act3', 'oblivion_knight', '遺忘騎士 Oblivion Knight (Act3)'),
    'EC': ('act3', 'flying_scimitar', '飛刀刃 Flying Scimitar'),
    'LS': ('act3', 'lightning_spire', '閃電尖塔 Lightning Spire'),
}

# Act4 常見怪物
ACT4_MONSTERS = {
    'OB': ('act4', 'oblivion_knight', '遺忘騎士 Oblivion Knight'),
    'OF': ('act4', 'oblivion_knight', '遺忘騎士 Oblivion Knight Variant'),
    'VD': ('act4', 'venom_lord', '滅絕者 Venom Lord'),
    'VH': ('act4', 'venom_lord', '滅絕者 Venom Lord Heavy'),
    'VJ': ('act4', 'venom_lord', '滅絕者 Venom Lord Jumper'),
    'VK': ('act4', 'venom_lord', '滅絕者 VK'),
    'DC': ('act4', 'dark_lord', '黑暗天使 Dark Lord'),
    'GY': ('act4', 'grotesque', '地獄牛 Grotesque'),
    'PW': ('act4', 'pit_lord', '深坑魔王 Pit Lord'),
    'DH': ('act4', 'doom_knight', '末日騎士 Doom Knight'),
}

# Act5 常見怪物（資料片）
ACT5_MONSTERS = {
    '5P': ('act5', 'mercenary', '高原野蠻人（傭兵）Highland Warrior'),
    'QQ': ('act5', 'quill_rat', '豪豬 Quill Rat'),
    'A6': ('act5', 'death_brigadier', '死亡旅長 Death Brigadier'),
    'AC': ('act5', 'abominable', '雪怪 Abominable'),
    'AG': ('act5', 'ancients', '亙古守衛 Ancients'),
    'E9': ('act5', 'enslaved', '奴役魔 Enslaved'),
    'FG': ('act5', 'frenzy_taur', '憤怒牛頭怪 Frenzy Taur'),
    'GB': ('act5', 'ghoul_berserk', '狂暴食屍鬼 Ghoul Berserk'),
    'IO': ('act5', 'ice_spawner', '冰霜元素 Ice Spawner'),
    'TG': ('act5', 'siege_beast', '重機攻城獸 Siege Beast'),
    'TW': ('act5', 'tur_duren', '圖爾杜倫 Tur Duren'),
    'UA': ('act5', 'undead_barbarian', '亡靈野蠻人 Undead Barbarian'),
    'WF': ('act5', 'wolf_rider', '狼騎士 Wolf Rider'),
    'X3': ('act5', 'baal_minion', '巴爾召喚物 X3'),
    'X4': ('act5', 'baal_minion', '巴爾召喚物 X4'),
    'XR': ('act5', 'baal_minion', '毀滅附肢 Destructive Tentacle'),
    'XS': ('act5', 'baal_minion', '毀滅附肢 Destructive Tentacle S'),
    'XT': ('act5', 'baal_minion', '毀滅附肢 Destructive Tentacle T'),
    'XU': ('act5', 'baal_minion', '巴爾分身 Baal Clone'),
    'XV': ('act5', 'baal_minion', '毀滅附肢 Destructive Tentacle V'),
    'XW': ('act5', 'baal_minion', '巴爾毀滅召喚 XW'),
    'XX': ('act5', 'baal_minion', '巴爾毀滅召喚 XX'),
    'XY': ('act5', 'baal_minion', '巴爾毀滅召喚 XY'),
    'XZ': ('act5', 'baal_minion', '巴爾毀滅召喚 XZ'),
    'Y0': ('act5', 'baal_minion', '巴爾毀滅召喚 Y0'),
}

# 合併所有映射
ALL_MONSTER_MAP = {}
ALL_MONSTER_MAP.update(BOSS_MAP)
ALL_MONSTER_MAP.update(ACT1_MONSTERS)
ALL_MONSTER_MAP.update(ACT2_MONSTERS)
ALL_MONSTER_MAP.update(ACT3_MONSTERS)
ALL_MONSTER_MAP.update(ACT4_MONSTERS)
ALL_MONSTER_MAP.update(ACT5_MONSTERS)


def copy_tree(src, dst):
    if not os.path.exists(src): return 0
    count = 0
    for root, dirs, files in os.walk(src):
        for f in files:
            s = os.path.join(root, f)
            rel = os.path.relpath(s, src)
            d = os.path.join(dst, rel)
            os.makedirs(os.path.dirname(d), exist_ok=True)
            if not os.path.exists(d):
                shutil.copy2(s, d)
                count += 1
    return count


def classify_monsters():
    """將怪物從 _monsters_raw / _monsters_exp 分類到各幕"""
    acts_dir = os.path.join(PROJECT_DIR, 'assets', 'acts')
    
    sources = [
        os.path.join(acts_dir, '_monsters_raw'),
        os.path.join(acts_dir, '_monsters_exp'),
    ]
    
    classified = {}
    unclassified = []
    
    for src_base in sources:
        if not os.path.exists(src_base):
            continue
        
        for code_dir in os.listdir(src_base):
            code_path = os.path.join(src_base, code_dir)
            if not os.path.isdir(code_path):
                continue
            
            code_upper = code_dir.upper()
            
            if code_upper in ALL_MONSTER_MAP:
                act, category, name = ALL_MONSTER_MAP[code_upper]
                dst = os.path.join(acts_dir, act, 'monsters', category, code_dir)
                n = copy_tree(code_path, dst)
                classified[code_dir] = (act, category, name, n)
            else:
                unclassified.append(code_dir)
    
    return classified, unclassified


def classify_objects():
    """將場景物件分類到各幕"""
    acts_dir = os.path.join(PROJECT_DIR, 'assets', 'acts')
    
    # 場景物件依幕分類（簡化版，直接整批複製並按幕別分）
    # d2data 的 objects 是所有幕共用的，按照 listfile 中的路徑沒有幕別資訊
    # 先直接複製到通用物件池，再在前端按需使用
    obj_src = os.path.join(acts_dir, '_objects_raw')
    obj_dst = os.path.join(PROJECT_DIR, 'assets', 'acts', '_shared_objects')
    
    obj_exp_src = os.path.join(acts_dir, '_objects_exp')
    obj_exp_dst = os.path.join(PROJECT_DIR, 'assets', 'acts', '_shared_objects_exp')
    
    n1 = copy_tree(obj_src, obj_dst) if os.path.exists(obj_src) else 0
    n2 = copy_tree(obj_exp_src, obj_exp_dst) if os.path.exists(obj_exp_src) else 0
    
    return n1, n2


def main():
    print("=" * 50)
    print("怪物/Boss 精確分類工具")
    print("=" * 50)
    
    print("\n=== 分類怪物到各幕 ===")
    classified, unclassified = classify_monsters()
    
    # 統計
    by_act = {}
    for code, (act, cat, name, n) in classified.items():
        if act not in by_act:
            by_act[act] = []
        by_act[act].append((code, cat, name, n))
    
    for act in sorted(by_act.keys()):
        items = by_act[act]
        total_files = sum(n for _, _, _, n in items)
        print(f"\n  [{act.upper()}] {len(items)} 種怪物, {total_files} 個檔案:")
        for code, cat, name, n in sorted(items):
            print(f"    {code:4s} ({cat:20s}): {n:4d} files  # {name}")
    
    if unclassified:
        print(f"\n  未分類 (已知代碼外): {len(unclassified)} 種")
        # 仍保留在 _monsters_raw/exp，不刪除
    
    print("\n=== 整理共用場景物件 ===")
    n1, n2 = classify_objects()
    print(f"  objects_raw: {n1} files -> _shared_objects/")
    print(f"  objects_exp: {n2} files -> _shared_objects_exp/")
    
    print("\n完成!")
    logger.info(f"Monster classification done: {len(classified)} classified, {len(unclassified)} unclassified")


if __name__ == '__main__':
    main()
