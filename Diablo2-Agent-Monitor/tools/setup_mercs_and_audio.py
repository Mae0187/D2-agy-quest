"""
傭兵精靈圖分類腳本 + WAV 音效標準化
"""
import os
import shutil
import subprocess
import logging
import uuid

EXEC_ID = str(uuid.uuid4())[:8]
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.normpath(os.path.join(SCRIPT_DIR, '..'))
MPQ_RAW = os.path.normpath(os.path.join(SCRIPT_DIR, 'mpq_raw'))
LOG_FILE = os.path.join(PROJECT_DIR, 'debug.log')

logger = logging.getLogger('merc_wav')
logger.setLevel(logging.DEBUG)
fh = logging.FileHandler(LOG_FILE, mode='a', encoding='utf-8')
fh.setFormatter(logging.Formatter(f'[%(asctime)s] [%(levelname)s] [%(funcName)s] [{EXEC_ID}] %(message)s'))
logger.addHandler(fh)

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


def organize_mercenaries():
    """把傭兵精靈圖複製到 mercenaries/ 各子目錄"""
    print("\n=== 整理傭兵精靈圖 ===")
    
    merc_base = os.path.join(PROJECT_DIR, 'assets', 'characters', 'mercenaries')
    monsters_raw = os.path.join(MPQ_RAW, 'd2data', 'data', 'global', 'monsters')
    
    # Act1 羅格弓手 (RG)
    rg_src = os.path.join(monsters_raw, 'RG')
    rg_dst = os.path.join(merc_base, 'act1_rogue')
    n = copy_tree(rg_src, rg_dst)
    print(f"  Act1 羅格弓手 (RG): {n} files -> act1_rogue/")
    
    # Act2 沙漠長槍兵/米山 (MQ)
    mq_src = os.path.join(monsters_raw, 'MQ')
    mq_dst = os.path.join(merc_base, 'act2_desert')
    n = copy_tree(mq_src, mq_dst)
    print(f"  Act2 沙漠長槍兵 (MQ): {n} files -> act2_desert/")
    
    # Act3 鐵狼法師 (IW)
    iw_src = os.path.join(monsters_raw, 'IW')
    iw_dst = os.path.join(merc_base, 'act3_ironwolf')
    n = copy_tree(iw_src, iw_dst)
    print(f"  Act3 鐵狼法師 (IW): {n} files -> act3_ironwolf/")
    
    # Act5 高原野蠻人 - 在 d2exp/CHARS/BA (與野蠻人職業共用骨架但配置不同)
    # 先找 d2exp monsters 的 Act5 野蠻人傭兵代碼
    # 根據 D2 資料，Act5 傭兵叫做 5P (Highland Warrior) 或在 d2data monsters 的 5P
    hp5_src_data = os.path.join(monsters_raw, '5P')
    hp5_src_exp = os.path.join(MPQ_RAW, 'd2exp', 'data', 'global', 'monsters', '5P')
    ba_src_chars = os.path.join(MPQ_RAW, 'd2exp', 'data', 'global', 'CHARS', 'BA')
    ba5_dst = os.path.join(merc_base, 'act5_barbarian')
    
    n = 0
    if os.path.exists(hp5_src_data):
        n += copy_tree(hp5_src_data, ba5_dst)
    if os.path.exists(hp5_src_exp):
        n += copy_tree(hp5_src_exp, ba5_dst)
    # 也帶入 BA chars (共用動畫骨架)
    if os.path.exists(ba_src_chars):
        n += copy_tree(ba_src_chars, os.path.join(ba5_dst, '_chars_ba'))
    print(f"  Act5 高原野蠻人 (5P/BA): {n} files -> act5_barbarian/")
    
    # HIREABLES UI 圖示 -> mercenaries/icons/
    hire_ui = os.path.join(PROJECT_DIR, 'assets', 'ui', 'hireables')
    hire_dst = os.path.join(merc_base, '_icons')
    n = copy_tree(hire_ui, hire_dst)
    print(f"  傭兵 UI 圖示: {n} files -> _icons/")
    
    print("傭兵整理完成!")
    logger.info("Mercenary organization done")


def check_ffmpeg():
    """檢查 FFmpeg 是否可用（用於 WAV 轉碼）"""
    try:
        result = subprocess.run(['ffmpeg', '-version'], capture_output=True, text=True, timeout=5)
        if result.returncode == 0:
            version_line = result.stdout.split('\n')[0]
            return True, version_line
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass
    return False, None


def normalize_wav_file(src_path, dst_path):
    """將單個 WAV 轉碼為 44.1kHz 16-bit PCM"""
    os.makedirs(os.path.dirname(dst_path), exist_ok=True)
    
    cmd = [
        'ffmpeg', '-y',
        '-i', src_path,
        '-ar', '44100',   # 44.1kHz
        '-acodec', 'pcm_s16le',  # 16-bit PCM
        '-ac', '2',       # 雙聲道（若原本是單聲道則複製）
        dst_path
    ]
    
    try:
        result = subprocess.run(cmd, capture_output=True, timeout=30)
        return result.returncode == 0
    except subprocess.TimeoutExpired:
        logger.warning(f"Timeout converting: {src_path}")
        return False
    except Exception as e:
        logger.exception(f"Exception converting: {src_path}")
        return False


def normalize_all_wavs():
    """標準化所有音效 WAV 到 44.1kHz"""
    print("\n=== WAV 音效標準化 (22.05kHz -> 44.1kHz) ===")
    
    has_ffmpeg, ver = check_ffmpeg()
    if not has_ffmpeg:
        print("  ⚠ FFmpeg 未找到，跳過音效標準化")
        print("  (請確保 FFmpeg 在 PATH 中，或音效可直接使用原版)")
        return
    
    print(f"  FFmpeg: {ver}")
    
    sounds_dir = os.path.join(PROJECT_DIR, 'sounds')
    normalized_dir = os.path.join(PROJECT_DIR, 'sounds_normalized')
    
    converted = 0
    skipped = 0
    errors = 0
    
    for root, dirs, files in os.walk(sounds_dir):
        for f in files:
            if not f.lower().endswith('.wav'):
                continue
            
            src = os.path.join(root, f)
            rel = os.path.relpath(src, sounds_dir)
            dst = os.path.join(normalized_dir, rel)
            
            if os.path.exists(dst):
                skipped += 1
                continue
            
            if normalize_wav_file(src, dst):
                converted += 1
                if converted % 100 == 0:
                    print(f"  已轉換 {converted} 個 WAV...")
            else:
                # 若轉換失敗，直接複製原檔
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                shutil.copy2(src, dst)
                errors += 1
                logger.warning(f"Fallback copy: {f}")
    
    print(f"  WAV 轉換完成: 成功 {converted}, 跳過 {skipped}, 錯誤(已複製) {errors}")
    logger.info(f"WAV normalization: converted={converted}, skipped={skipped}, errors={errors}")


def show_final_merc_stats():
    merc_base = os.path.join(PROJECT_DIR, 'assets', 'characters', 'mercenaries')
    print("\n=== 傭兵資源最終統計 ===")
    for sub in ['act1_rogue', 'act2_desert', 'act3_ironwolf', 'act5_barbarian', '_icons']:
        d = os.path.join(merc_base, sub)
        if os.path.exists(d):
            total = sum(len(files) for _, _, files in os.walk(d))
            print(f"  {sub}/: {total} files")


def main():
    print("=" * 50)
    print("傭兵整理 + WAV 標準化工具")
    print("=" * 50)
    
    organize_mercenaries()
    show_final_merc_stats()
    normalize_all_wavs()


if __name__ == '__main__':
    main()
