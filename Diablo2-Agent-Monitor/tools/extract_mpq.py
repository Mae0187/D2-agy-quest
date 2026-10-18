"""
Diablo II MPQ 素材批量提取腳本
使用 StormLib DLL (ctypes) 解包 d2sfx.mpq, d2data.mpq, d2char.mpq, d2exp.mpq
"""
import ctypes
import ctypes.wintypes as wintypes
import os
import sys
import logging
import uuid

# === 日誌設定 ===
EXEC_ID = str(uuid.uuid4())[:8]
LOG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'debug.log')
logger = logging.getLogger('mpq_extractor')
logger.setLevel(logging.DEBUG)
fh = logging.FileHandler(LOG_FILE, mode='w', encoding='utf-8')
fh.setLevel(logging.DEBUG)
ch = logging.StreamHandler()
ch.setLevel(logging.ERROR)
fmt = logging.Formatter(f'[%(asctime)s] [%(levelname)s] [%(funcName)s] [{EXEC_ID}] %(message)s')
fh.setFormatter(fmt)
ch.setFormatter(fmt)
logger.addHandler(fh)
logger.addHandler(ch)

# === 路徑配置 (全部使用絕對路徑 normpath) ===
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
STORMLIB_DLL = os.path.normpath(os.path.join(SCRIPT_DIR, 'stormlib', 'x64', 'StormLib.dll'))
LISTFILE = os.path.normpath(os.path.join(SCRIPT_DIR, 'listfiles', 'Diablo II LOD.txt'))
D2_DIR = os.path.normpath(os.path.join(SCRIPT_DIR, '..', '..', 'Diablo II 1.13c'))
RAW_OUTPUT_BASE = os.path.normpath(os.path.join(SCRIPT_DIR, 'mpq_raw'))

# MPQ 檔案清單
MPQ_FILES = {
    'd2sfx': os.path.normpath(os.path.join(D2_DIR, 'd2sfx.mpq')),
    'd2data': os.path.normpath(os.path.join(D2_DIR, 'd2data.mpq')),
    'd2char': os.path.normpath(os.path.join(D2_DIR, 'd2char.mpq')),
    'd2exp': os.path.normpath(os.path.join(D2_DIR, 'd2exp.mpq')),
    'Patch_D2': os.path.normpath(os.path.join(D2_DIR, 'Patch_D2.mpq')),
}

# === StormLib 常量 ===
STREAM_FLAG_READ_ONLY = 0x00000100
MPQ_OPEN_READ_ONLY = 0x00000100
SFILE_OPEN_FROM_MPQ = 0x00000000
MAX_PATH = 260

def load_stormlib():
    """載入 StormLib DLL"""
    if not os.path.exists(STORMLIB_DLL):
        logger.error(f"StormLib DLL does not exist: {STORMLIB_DLL}")
        sys.exit(1)
    
    storm = ctypes.WinDLL(STORMLIB_DLL)
    logger.info(f"StormLib DLL loaded successfully")
    
    # ===== 使用 W (Wide/Unicode) 版本處理含空格路徑 =====
    
    # SFileOpenArchive (TCHAR* = wchar_t* on Windows Unicode build)
    storm.SFileOpenArchive.argtypes = [ctypes.c_wchar_p, ctypes.c_uint32, ctypes.c_uint32, ctypes.POINTER(wintypes.HANDLE)]
    storm.SFileOpenArchive.restype = ctypes.c_bool
    
    # SFileCloseArchive
    storm.SFileCloseArchive.argtypes = [wintypes.HANDLE]
    storm.SFileCloseArchive.restype = ctypes.c_bool
    
    # SFileOpenFileEx - 內部檔名仍為 ANSI
    storm.SFileOpenFileEx.argtypes = [wintypes.HANDLE, ctypes.c_char_p, ctypes.c_uint32, ctypes.POINTER(wintypes.HANDLE)]
    storm.SFileOpenFileEx.restype = ctypes.c_bool
    
    # SFileGetFileSize
    storm.SFileGetFileSize.argtypes = [wintypes.HANDLE, ctypes.POINTER(wintypes.DWORD)]
    storm.SFileGetFileSize.restype = wintypes.DWORD
    
    # SFileReadFile
    storm.SFileReadFile.argtypes = [wintypes.HANDLE, ctypes.c_void_p, wintypes.DWORD, ctypes.POINTER(wintypes.DWORD), ctypes.c_void_p]
    storm.SFileReadFile.restype = ctypes.c_bool
    
    # SFileCloseFile
    storm.SFileCloseFile.argtypes = [wintypes.HANDLE]
    storm.SFileCloseFile.restype = ctypes.c_bool
    
    # SFileHasFile
    storm.SFileHasFile.argtypes = [wintypes.HANDLE, ctypes.c_char_p]
    storm.SFileHasFile.restype = ctypes.c_bool
    
    # SFileAddListFile - listfile 路徑也用 TCHAR
    storm.SFileAddListFile.argtypes = [wintypes.HANDLE, ctypes.c_wchar_p]
    storm.SFileAddListFile.restype = ctypes.c_int
    
    # SFileFindFirstFile - mask 為 ANSI，listfile 路徑為 TCHAR
    storm.SFileFindFirstFile.argtypes = [wintypes.HANDLE, ctypes.c_char_p, ctypes.c_void_p, ctypes.c_wchar_p]
    storm.SFileFindFirstFile.restype = wintypes.HANDLE
    
    # SFileFindNextFile
    storm.SFileFindNextFile.argtypes = [wintypes.HANDLE, ctypes.c_void_p]
    storm.SFileFindNextFile.restype = ctypes.c_bool
    
    # SFileFindClose
    storm.SFileFindClose.argtypes = [wintypes.HANDLE]
    storm.SFileFindClose.restype = ctypes.c_bool
    
    return storm

# SFILE_FIND_DATA 結構體
class SFILE_FIND_DATA(ctypes.Structure):
    _fields_ = [
        ("cFileName", ctypes.c_char * 1024),
        ("szPlainName", ctypes.c_char_p),
        ("dwHashIndex", wintypes.DWORD),
        ("dwBlockIndex", wintypes.DWORD),
        ("dwFileSize", wintypes.DWORD),
        ("dwFileFlags", wintypes.DWORD),
        ("dwCompSize", wintypes.DWORD),
        ("dwFileTimeLo", wintypes.DWORD),
        ("dwFileTimeHi", wintypes.DWORD),
        ("lcLocale", wintypes.DWORD),
    ]

def extract_mpq(storm, mpq_path, output_dir, mpq_name):
    """提取單個 MPQ 檔案的所有內容"""
    if not os.path.exists(mpq_path):
        logger.warning(f"MPQ file not found, skip: {mpq_path}")
        print(f"[{mpq_name}] MPQ not found: {mpq_path}")
        return 0
    
    logger.info(f"Start extracting {mpq_name}: {mpq_path}")
    print(f"[{mpq_name}] Opening: {mpq_path}")
    
    # 開啟 MPQ (使用 Unicode 路徑)
    h_mpq = wintypes.HANDLE()
    
    if not storm.SFileOpenArchive(mpq_path, 0, MPQ_OPEN_READ_ONLY, ctypes.byref(h_mpq)):
        err = ctypes.GetLastError()
        logger.error(f"Cannot open MPQ: {mpq_path}, error code: {err}")
        print(f"  ERROR: Cannot open, code={err}")
        return 0
    
    logger.info(f"MPQ opened: {mpq_name}")
    print(f"  MPQ opened successfully")
    
    # 載入 listfile (使用 Unicode 路徑)
    if os.path.exists(LISTFILE):
        result = storm.SFileAddListFile(h_mpq, LISTFILE)
        logger.info(f"Listfile load result: {result}")
        print(f"  Listfile loaded (result={result})")
    
    # 遍歷所有檔案
    find_data = SFILE_FIND_DATA()
    h_find = storm.SFileFindFirstFile(h_mpq, b"*", ctypes.byref(find_data), None)
    
    INVALID_HANDLE = wintypes.HANDLE(-1).value
    if h_find is None or (hasattr(h_find, 'value') and h_find.value == INVALID_HANDLE):
        logger.warning(f"No files found in {mpq_name}")
        print(f"  WARNING: No files found")
        storm.SFileCloseArchive(h_mpq)
        return 0
    
    extracted = 0
    errors = 0
    
    while True:
        filename = find_data.cFileName.decode('ascii', errors='replace').strip('\x00')
        
        if filename and not filename.startswith('('):
            # 建立輸出路徑
            out_path = os.path.join(output_dir, filename.replace('\\', os.sep))
            out_dir = os.path.dirname(out_path)
            
            try:
                os.makedirs(out_dir, exist_ok=True)
                
                # 開啟檔案
                h_file = wintypes.HANDLE()
                if storm.SFileOpenFileEx(h_mpq, filename.encode('ascii', errors='replace'), SFILE_OPEN_FROM_MPQ, ctypes.byref(h_file)):
                    # 取得檔案大小
                    hi_size = wintypes.DWORD()
                    file_size = storm.SFileGetFileSize(h_file, ctypes.byref(hi_size))
                    
                    if file_size > 0 and file_size != 0xFFFFFFFF:
                        # 讀取檔案
                        buf = ctypes.create_string_buffer(file_size)
                        bytes_read = wintypes.DWORD()
                        
                        if storm.SFileReadFile(h_file, buf, file_size, ctypes.byref(bytes_read), None):
                            with open(out_path, 'wb') as f:
                                f.write(buf.raw[:bytes_read.value])
                            extracted += 1
                            if extracted % 500 == 0:
                                print(f"  [{mpq_name}] Extracted {extracted} files...")
                                logger.info(f"[{mpq_name}] Extracted {extracted} files...")
                        else:
                            errors += 1
                            logger.debug(f"Read failed: {filename}")
                    
                    storm.SFileCloseFile(h_file)
                else:
                    errors += 1
                    logger.debug(f"Cannot open: {filename}")
            except Exception as e:
                errors += 1
                logger.exception(f"Exception extracting: {filename}")
        
        # 下一個檔案
        if not storm.SFileFindNextFile(h_find, ctypes.byref(find_data)):
            break
    
    storm.SFileFindClose(h_find)
    storm.SFileCloseArchive(h_mpq)
    
    logger.info(f"[{mpq_name}] Done: success={extracted}, errors={errors}")
    print(f"  [{mpq_name}] Done: {extracted} extracted, {errors} errors")
    return extracted

def main():
    print("=" * 60)
    print("Diablo II MPQ 素材批量提取工具")
    print("=" * 60)
    
    storm = load_stormlib()
    total = 0
    
    for mpq_name, mpq_path in MPQ_FILES.items():
        output_dir = os.path.join(RAW_OUTPUT_BASE, mpq_name)
        os.makedirs(output_dir, exist_ok=True)
        count = extract_mpq(storm, mpq_path, output_dir, mpq_name)
        total += count
    
    print(f"\n全部完成！共提取 {total} 個檔案")
    print(f"原始素材已儲存至: {RAW_OUTPUT_BASE}")
    logger.info(f"全部提取完成，共 {total} 個檔案")

if __name__ == '__main__':
    main()
