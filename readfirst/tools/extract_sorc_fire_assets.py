#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
extract_sorc_fire_assets.py
從 Diablo II 1.13c 原版 MPQ 中精確萃取魔法使純火體系所有原廠 DCC/COF/Palette 素材
"""
import os
import sys
import ctypes
from ctypes import wintypes
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT_DIR = SCRIPT_DIR.parent
D2_DIR = ROOT_DIR / "Diablo II 1.13c"
STORMLIB_DLL = ROOT_DIR / "Diablo2-Agent-Monitor" / "tools" / "stormlib" / "x64" / "StormLib.dll"
RAW_DIR = ROOT_DIR / "Diablo2-Agent-Monitor" / "tools" / "mpq_raw"

storm = ctypes.WinDLL(str(STORMLIB_DLL))
storm.SFileOpenArchive.argtypes = [ctypes.c_wchar_p, ctypes.c_uint32, ctypes.c_uint32, ctypes.POINTER(wintypes.HANDLE)]
storm.SFileOpenArchive.restype = ctypes.c_bool
storm.SFileCloseArchive.argtypes = [wintypes.HANDLE]
storm.SFileCloseArchive.restype = ctypes.c_bool
storm.SFileOpenFileEx.argtypes = [wintypes.HANDLE, ctypes.c_char_p, ctypes.c_uint32, ctypes.POINTER(wintypes.HANDLE)]
storm.SFileOpenFileEx.restype = ctypes.c_bool
storm.SFileGetFileSize.argtypes = [wintypes.HANDLE, ctypes.POINTER(wintypes.DWORD)]
storm.SFileGetFileSize.restype = wintypes.DWORD
storm.SFileReadFile.argtypes = [wintypes.HANDLE, ctypes.c_void_p, wintypes.DWORD, ctypes.POINTER(wintypes.DWORD), ctypes.c_void_p]
storm.SFileReadFile.restype = ctypes.c_bool
storm.SFileCloseFile.argtypes = [wintypes.HANDLE]
storm.SFileCloseFile.restype = ctypes.c_bool

FILES_TO_EXTRACT = [
    # Palette
    (b"data\\global\\palette\\ACT1\\pal.dat", "d2data"),
    # Missiles
    (b"data\\global\\missiles\\Firebolt.dcc", "d2data"),
    (b"data\\global\\missiles\\Flamethrower.dcc", "d2data"),
    (b"data\\global\\missiles\\groundFireBig.dcc", "d2data"),
    (b"data\\global\\missiles\\groundFireMedium.dcc", "d2data"),
    (b"data\\global\\missiles\\Meteor.dcc", "d2data"),
    (b"data\\global\\missiles\\MeteorTargetIndicator.dcc", "d2data"),
    (b"data\\global\\missiles\\ExpArrowExplode.dcc", "d2data"),
    # Hydra Monster parts
    (b"data\\global\\monsters\\HX\\Tr\\HXTRLITNUHTH.dcc", "d2data"),
    (b"data\\global\\monsters\\HX\\Tr\\HXTRLITA1HTH.dcc", "d2data"),
    (b"data\\global\\monsters\\HX\\S1\HXS1LITNUHTH.dcc", "d2data"),
    (b"data\\global\\monsters\\HX\\S1\HXS1LITA1HTH.dcc", "d2data"),
    (b"data\\global\\monsters\\HX\\Cof\\HXNUHTH.COF", "d2data"),
    (b"data\\global\\monsters\\HX\\Cof\\HXA1HTH.COF", "d2data"),
]

def extract_file(h_mpq, internal_name: bytes, out_path: Path):
    out_path.parent.mkdir(parents=True, exist_ok=True)
    h_file = wintypes.HANDLE()
    if not storm.SFileOpenFileEx(h_mpq, internal_name, 0, ctypes.byref(h_file)):
        print(f"  [FAIL] Cannot open: {internal_name.decode()}")
        return False
    
    file_size_high = wintypes.DWORD()
    file_size = storm.SFileGetFileSize(h_file, ctypes.byref(file_size_high))
    if file_size == 0xFFFFFFFF:
        storm.SFileCloseFile(h_file)
        return False
        
    buf = ctypes.create_string_buffer(file_size)
    bytes_read = wintypes.DWORD()
    if not storm.SFileReadFile(h_file, buf, file_size, ctypes.byref(bytes_read), None):
        print(f"  [FAIL] Cannot read: {internal_name.decode()}")
        storm.SFileCloseFile(h_file)
        return False
        
    storm.SFileCloseFile(h_file)
    with open(out_path, "wb") as f:
        f.write(buf.raw[:bytes_read.value])
    print(f"  [OK] Extracted ({bytes_read.value} bytes) -> {out_path.name}")
    return True

def main():
    print("=== Extracting Sorceress Fire Assets from MPQ ===")
    archives = {}
    for internal_name, mpq_name in FILES_TO_EXTRACT:
        if mpq_name not in archives:
            mpq_file = D2_DIR / f"{mpq_name}.mpq"
            h = wintypes.HANDLE()
            if not storm.SFileOpenArchive(str(mpq_file), 0, 0x100, ctypes.byref(h)):
                print(f"ERROR: Cannot open {mpq_file}")
                sys.exit(1)
            archives[mpq_name] = h
        
        h_mpq = archives[mpq_name]
        rel_path = internal_name.decode().replace("\\", "/")
        out_file = RAW_DIR / mpq_name / rel_path
        extract_file(h_mpq, internal_name, out_file)

    for h in archives.values():
        storm.SFileCloseArchive(h)
    print("=== Extraction Finished ===")

if __name__ == "__main__":
    main()
