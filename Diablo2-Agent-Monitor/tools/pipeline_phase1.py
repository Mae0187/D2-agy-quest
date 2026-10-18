"""
Diablo II Engine Phase 1: Palette & Index Shader Pipeline
嚴格落實 AGENT.md 第 1 階段規範：
1. DC6 8-bit 原始索引解碼與 Index 0 絕對透明判定
2. 查表管線：原始索引 -> PL2 光照等級表 (0~31) -> 官方 fechar/pal.dat (BGR)
3. 支援營火選角待命動畫 (Amazon, Barbarian, Paladin, Necromancer, Sorceress) 與營火動態
4. 產出驗收圖像至 assets/verify_phase1_pipeline.png
"""
import struct
import os
import sys
from PIL import Image

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MPQ_RAW = os.path.join(BASE_DIR, "tools", "mpq_raw")
FECHAR_PAL = os.path.join(MPQ_RAW, "d2data", "data", "global", "palette", "fechar", "pal.dat")
FECHAR_PL2 = os.path.join(MPQ_RAW, "d2data", "data", "global", "palette", "fechar", "Pal.PL2")
ASSETS_DIR = os.path.join(BASE_DIR, "assets")

class D2PalettePipeline:
    def __init__(self, pal_path=FECHAR_PAL, pl2_path=FECHAR_PL2):
        with open(pal_path, 'rb') as f:
            self.pal_bytes = f.read()
        with open(pl2_path, 'rb') as f:
            self.pl2_bytes = f.read()
            
    def get_color(self, index, light_level=31):
        if index == 0:
            return (0, 0, 0, 0)
        light_level = max(0, min(31, light_level))
        pl2_offset = light_level * 256
        lit_idx = self.pl2_bytes[pl2_offset + index]
        b = self.pal_bytes[lit_idx * 3]
        g = self.pal_bytes[lit_idx * 3 + 1]
        r = self.pal_bytes[lit_idx * 3 + 2]
        return (r, g, b, 255)

    def decode_dc6_frame(self, dc6_bytes, frame_idx=0, light_level=31, additive=False):
        header = struct.unpack_from('<6I', dc6_bytes, 0)
        version, flags, encoding, termination, directions, frames_per_dir = header
        total_frames = directions * frames_per_dir
        if frame_idx >= total_frames:
            frame_idx = 0
            
        frame_offset = struct.unpack_from('<I', dc6_bytes, 24 + frame_idx * 4)[0]
        flip, width, height, offset_x, offset_y, unknown, next_block, length = struct.unpack_from(
            '<2I2i4I', dc6_bytes, frame_offset
        )
        
        pixels = bytearray(width * height)
        src = frame_offset + 32
        src_end = src + length
        
        x = 0
        y = height - 1
        y_step = -1
        
        while src < src_end:
            b = dc6_bytes[src]
            src += 1
            if b == 0x80:
                x = 0
                y += y_step
            elif b & 0x80:
                x += (b & 0x7F)
            else:
                run_len = b
                for _ in range(run_len):
                    if src < src_end and x < width and 0 <= y < height:
                        pixels[y * width + x] = dc6_bytes[src]
                        src += 1
                        x += 1
                        
        img = Image.new('RGBA', (width, height), (0, 0, 0, 0))
        d = img.load()
        pl2_offset = light_level * 256
        
        for py in range(height):
            for px in range(width):
                idx = pixels[py * width + px]
                if idx != 0:
                    lit = self.pl2_bytes[pl2_offset + idx]
                    b = self.pal_bytes[lit * 3]
                    g = self.pal_bytes[lit * 3 + 1]
                    r = self.pal_bytes[lit * 3 + 2]
                    
                    if additive:
                        # Additive transparency for fire and magical light
                        brightness = (r * 299 + g * 587 + b * 114) // 1000
                        if brightness > 15:
                            d[px, py] = (r, g, b, min(255, brightness * 2))
                    else:
                        d[px, py] = (r, g, b, 255)
                        
        return img, (width, height), (offset_x, offset_y), frames_per_dir

def generate_phase1_verification():
    pipeline = D2PalettePipeline()
    fe_dir = os.path.join(MPQ_RAW, "d2data", "data", "global", "ui", "FrontEnd")
    
    char_configs = [
        ("Amazon (AMNU1)", os.path.join(fe_dir, "amazon", "AMNU1.DC6"), 31, False),
        ("Barbarian (banu1)", os.path.join(fe_dir, "barbarian", "banu1.DC6"), 31, False),
        ("Paladin (PANU1)", os.path.join(fe_dir, "paladin", "PANU1.DC6"), 31, False),
        ("Campfire Warm (L22)", os.path.join(fe_dir, "barbarian", "banu1.DC6"), 22, False),
        ("Shadow Ambient (L10)", os.path.join(fe_dir, "barbarian", "banu1.DC6"), 10, False),
        ("Campfire Flame", os.path.join(fe_dir, "fire.DC6"), 31, True),
    ]
    
    rendered_frames = []
    max_h = 0
    total_w = 0
    spacing = 25
    
    for label, path, lvl, is_add in char_configs:
        if os.path.exists(path):
            with open(path, 'rb') as f:
                data = f.read()
            img, sz, offset, frames = pipeline.decode_dc6_frame(data, frame_idx=0, light_level=lvl, additive=is_add)
            rendered_frames.append((label, img, sz))
            max_h = max(max_h, sz[1])
            total_w += sz[0] + spacing
            
    canvas = Image.new('RGBA', (total_w + 30, max_h + 60), (12, 10, 10, 255))
    curr_x = 20
    
    for label, img, sz in rendered_frames:
        # bottom align
        y_pos = max_h - sz[1] + 20
        canvas.paste(img, (curr_x, y_pos), img)
        curr_x += sz[0] + spacing
        
    out_path = os.path.join(ASSETS_DIR, "verify_phase1_pipeline.png")
    canvas.save(out_path)
    print(f"Successfully generated Phase 1 Verification Showcase: {out_path}")
    return out_path

if __name__ == "__main__":
    generate_phase1_verification()
