"""
DC6 圖檔轉換工具
將暗黑2的 DC6 格式圖檔轉換為 PNG 格式
DC6 格式說明: Diablo II 壓縮精靈圖格式，包含多方向多幀的動畫序列
"""
import struct
import os
import sys
import logging
import uuid

try:
    from PIL import Image
except ImportError:
    print("ERROR: 需要安裝 Pillow: pip install Pillow")
    sys.exit(1)

EXEC_ID = str(uuid.uuid4())[:8]
logger = logging.getLogger('dc6_converter')

# DC6 格式常量
DC6_HEADER_SIZE = 24

# D2 原版 256色調色盤 (ACT1 暖色調)
# 這是簡化版的 D2 調色盤，實際完整調色盤需要從 d2data.mpq 的 .dat 檔案提取
DEFAULT_PALETTE = []
for i in range(256):
    # 生成一個合理的暗黑風格調色盤
    if i == 0:
        DEFAULT_PALETTE.append((0, 0, 0, 0))  # 透明
    else:
        r = min(255, (i * 7 + 23) % 256)
        g = min(255, (i * 5 + 11) % 256)
        b = min(255, (i * 3 + 7) % 256)
        DEFAULT_PALETTE.append((r, g, b, 255))


def read_dc6_header(data):
    """解析 DC6 檔頭"""
    if len(data) < DC6_HEADER_SIZE:
        return None
    
    version = struct.unpack_from('<I', data, 0)[0]
    flags = struct.unpack_from('<I', data, 4)[0]
    encoding = struct.unpack_from('<I', data, 8)[0]
    termination = struct.unpack_from('<I', data, 12)[0]  # terminator bytes
    directions = struct.unpack_from('<I', data, 16)[0]
    frames_per_dir = struct.unpack_from('<I', data, 20)[0]
    
    return {
        'version': version,
        'flags': flags,
        'encoding': encoding,
        'termination': termination,
        'directions': directions,
        'frames_per_dir': frames_per_dir,
        'total_frames': directions * frames_per_dir
    }


def decode_dc6_frame(data, offset):
    """解碼單個 DC6 幀"""
    if offset + 32 > len(data):
        return None, None
    
    # 幀頭 (32 bytes)
    flip = struct.unpack_from('<I', data, offset)[0]
    width = struct.unpack_from('<I', data, offset + 4)[0]
    height = struct.unpack_from('<I', data, offset + 8)[0]
    offset_x = struct.unpack_from('<i', data, offset + 12)[0]
    offset_y = struct.unpack_from('<i', data, offset + 16)[0]
    unknown = struct.unpack_from('<I', data, offset + 20)[0]
    next_block = struct.unpack_from('<I', data, offset + 24)[0]
    length = struct.unpack_from('<I', data, offset + 28)[0]
    
    frame_info = {
        'flip': flip,
        'width': width,
        'height': height,
        'offset_x': offset_x,
        'offset_y': offset_y,
        'length': length
    }
    
    if width == 0 or height == 0 or width > 4096 or height > 4096:
        return frame_info, None
    
    # 解碼像素資料 (RLE 壓縮)
    pixels = bytearray(width * height)
    pixel_data_start = offset + 32
    
    if pixel_data_start + length > len(data):
        return frame_info, None
    
    src = pixel_data_start
    src_end = pixel_data_start + length
    
    # DC6 採用由下而上的掃描線序 (Bottom-Up)
    x = 0
    y = 0 if flip else height - 1
    
    while src < src_end and 0 <= y < height:
        b = data[src]
        src += 1
        
        if b == 0x80:
            # 行結束標記
            x = 0
            if flip:
                y += 1
            else:
                y -= 1
        elif b & 0x80:
            # 透明跑步 (b & 0x7F 個透明像素)
            x += (b & 0x7F)
        else:
            # 不透明像素 (b 個像素)
            count = b
            for i in range(count):
                if src < src_end and x < width and 0 <= y < height:
                    pixels[y * width + x] = data[src]
                    src += 1
                    x += 1
                else:
                    break
    
    return frame_info, pixels


def load_palette(palette_path, brightness_boost=1.5):
    """從 .dat 檔案載入 D2 調色盤 (768 bytes = 256 RGB)，支援動態亮度增益"""
    if not os.path.exists(palette_path):
        return DEFAULT_PALETTE
    
    pal = []
    with open(palette_path, 'rb') as f:
        pal_data = f.read(768)
    
    for i in range(256):
        if i * 3 + 2 < len(pal_data):
            b = pal_data[i * 3]
            g = pal_data[i * 3 + 1]
            r = pal_data[i * 3 + 2]
            a = 0 if i == 0 else 255
            if brightness_boost != 1.0 and a != 0:
                r = min(255, int(r * brightness_boost))
                g = min(255, int(g * brightness_boost))
                b = min(255, int(b * brightness_boost))
            pal.append((r, g, b, a))
        else:
            pal.append((0, 0, 0, 0))
    
    return pal


def convert_dc6_to_png(dc6_path, output_dir, palette=None):
    """將 DC6 檔案轉換為 PNG 序列幀"""
    if palette is None:
        palette = DEFAULT_PALETTE
    
    with open(dc6_path, 'rb') as f:
        data = f.read()
    
    header = read_dc6_header(data)
    if header is None:
        logger.error(f"Invalid DC6 header: {dc6_path}")
        return []
    
    basename = os.path.splitext(os.path.basename(dc6_path))[0]
    os.makedirs(output_dir, exist_ok=True)
    
    total_frames = header['total_frames']
    if total_frames == 0:
        return []
    
    # 讀取幀偏移表
    offset_table_start = DC6_HEADER_SIZE
    frame_offsets = []
    for i in range(total_frames):
        pos = offset_table_start + i * 4
        if pos + 4 <= len(data):
            frame_offsets.append(struct.unpack_from('<I', data, pos)[0])
    
    output_files = []
    for dir_idx in range(header['directions']):
        for frame_idx in range(header['frames_per_dir']):
            global_idx = dir_idx * header['frames_per_dir'] + frame_idx
            if global_idx >= len(frame_offsets):
                break
            
            frame_info, pixels = decode_dc6_frame(data, frame_offsets[global_idx])
            if frame_info is None or pixels is None:
                continue
            
            w = frame_info['width']
            h = frame_info['height']
            
            if w == 0 or h == 0:
                continue
            
            # 建立 RGBA 影像
            img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
            for py in range(h):
                for px in range(w):
                    idx = pixels[py * w + px]
                    color = palette[idx] if idx < len(palette) else (0, 0, 0, 0)
                    img.putpixel((px, py), color)
            
            out_name = f"{basename}_d{dir_idx}_f{frame_idx}.png"
            out_path = os.path.join(output_dir, out_name)
            img.save(out_path)
            output_files.append(out_path)
    
    return output_files


def batch_convert_dc6(input_dir, output_dir, palette=None):
    """批量轉換目錄下的所有 DC6 檔案"""
    converted = 0
    errors = 0
    
    for root, dirs, files in os.walk(input_dir):
        for fname in files:
            if fname.lower().endswith('.dc6'):
                dc6_path = os.path.join(root, fname)
                rel_path = os.path.relpath(root, input_dir)
                out_dir = os.path.join(output_dir, rel_path)
                
                try:
                    result = convert_dc6_to_png(dc6_path, out_dir, palette)
                    if result:
                        converted += 1
                        if converted % 50 == 0:
                            print(f"  Converted {converted} DC6 files...")
                except Exception as e:
                    errors += 1
                    logger.exception(f"Failed to convert: {dc6_path}")
    
    print(f"DC6 conversion done: {converted} succeeded, {errors} failed")
    return converted


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python dc6_to_png.py <input_dir_or_file> <output_dir> [palette.dat]")
        sys.exit(1)
    
    input_path = sys.argv[1]
    output_dir = sys.argv[2]
    palette = None
    
    if len(sys.argv) > 3:
        palette = load_palette(sys.argv[3])
    
    if os.path.isfile(input_path):
        results = convert_dc6_to_png(input_path, output_dir, palette)
        print(f"Converted {len(results)} frames from {input_path}")
    elif os.path.isdir(input_path):
        batch_convert_dc6(input_path, output_dir, palette)
    else:
        print(f"Path not found: {input_path}")
