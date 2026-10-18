"""
Diablo II DCC (Diablo Character Composite) 檔案解碼器
基於暴雪原版 DCC 規範與 Lectem / OpenDiablo2 解碼架構，
將 .dcc 動畫精靈圖解碼為精確 256 色索引 / RGBA PNG 幀序列。
"""
import os
import sys
import struct
from PIL import Image

# DCC 寬度映射查表 (4-bit -> 實際位元數)
BITS_WIDTH_TABLE = [0, 1, 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 26, 28, 30, 32]

class BitStream:
    def __init__(self, data: bytes, size_in_bits: int = None, bit_offset: int = 0):
        self.data = data
        self.total_bits = size_in_bits if size_in_bits is not None else len(data) * 8
        self.bit_pos = bit_offset
        self.first_bit_offset = bit_offset

    def tell(self):
        return self.bit_pos - self.first_bit_offset

    def size(self):
        return self.total_bits

    def skip(self, n: int):
        self.bit_pos += n

    def align_to_byte(self):
        self.bit_pos = (self.bit_pos + 7) & ~7

    def read_bool(self) -> bool:
        byte_idx = self.bit_pos // 8
        bit_idx = self.bit_pos % 8
        self.bit_pos += 1
        if byte_idx < len(self.data):
            return bool((self.data[byte_idx] >> bit_idx) & 1)
        return False

    def read_bits(self, n: int) -> int:
        if n == 0:
            return 0
        val = 0
        dest_bit = 0
        while dest_bit < n:
            byte_idx = self.bit_pos // 8
            bit_idx = self.bit_pos % 8
            bits_available_in_byte = 8 - bit_idx
            bits_to_read = min(bits_available_in_byte, n - dest_bit)
            mask = (1 << bits_to_read) - 1
            if byte_idx < len(self.data):
                in_bits = (self.data[byte_idx] >> bit_idx) & mask
            else:
                in_bits = 0
            val |= in_bits << dest_bit
            dest_bit += bits_to_read
            self.bit_pos += bits_to_read
        return val

    def read_signed(self, n: int) -> int:
        if n == 0:
            return 0
        val = self.read_bits(n)
        if val & (1 << (n - 1)):
            val -= (1 << n)
        return val

    def create_subview(self, size_in_bits: int):
        sub = BitStream(self.data, size_in_bits, self.bit_pos)
        return sub

def load_palette(pal_path: str, brightness_boost=1.4):
    """載入 D2 原版 pal.dat (768 bytes, 256 colors BGR 順序，支援動態亮度增益)"""
    with open(pal_path, 'rb') as f:
        data = f.read(768)
    palette = []
    for i in range(256):
        if i == 0:
            palette.append((0, 0, 0, 0)) # 索引 0 為透明
        else:
            b = data[i * 3]
            g = data[i * 3 + 1]
            r = data[i * 3 + 2]
            if brightness_boost != 1.0:
                r = min(255, int(r * brightness_boost))
                g = min(255, int(g * brightness_boost))
                b = min(255, int(b * brightness_boost))
            palette.append((r, g, b, 255))
    return palette

class DCCDecoder:
    def __init__(self, filepath: str):
        self.filepath = filepath
        with open(filepath, 'rb') as f:
            self.raw_data = f.read()
        self.parse_header()

    def parse_header(self):
        sig, ver, dirs, frames_per_dir, tag, final_dc6_size = struct.unpack_from('<BBBIII', self.raw_data, 0)
        if sig != 0x74:
            raise ValueError(f"Invalid DCC signature: {hex(sig)}")
        self.signature = sig
        self.version = ver
        self.directions = dirs
        self.frames_per_dir = frames_per_dir
        self.tag = tag
        self.final_dc6_size = final_dc6_size

        self.dir_offsets = []
        offset = 15
        for _ in range(dirs):
            off = struct.unpack_from('<I', self.raw_data, offset)[0]
            self.dir_offsets.append(off)
            offset += 4
        self.dir_offsets.append(len(self.raw_data))

    def decode_direction(self, dir_idx: int):
        start_off = self.dir_offsets[dir_idx]
        end_off = self.dir_offsets[dir_idx + 1]
        dir_data = self.raw_data[start_off:end_off]
        bs = BitStream(dir_data)

        # 1. Direction Header
        outsize_coded = bs.read_bits(32)
        has_raw_pixel_encoding = bs.read_bool()
        compress_equal_cells = bs.read_bool()

        var0_bits = BITS_WIDTH_TABLE[bs.read_bits(4)]
        width_bits = BITS_WIDTH_TABLE[bs.read_bits(4)]
        height_bits = BITS_WIDTH_TABLE[bs.read_bits(4)]
        x_offset_bits = BITS_WIDTH_TABLE[bs.read_bits(4)]
        y_offset_bits = BITS_WIDTH_TABLE[bs.read_bits(4)]
        optional_bytes_bits = BITS_WIDTH_TABLE[bs.read_bits(4)]
        coded_bytes_bits = BITS_WIDTH_TABLE[bs.read_bits(4)]

        # 2. Frame Headers
        frame_headers = []
        for _ in range(self.frames_per_dir):
            var0 = bs.read_bits(var0_bits)
            w = bs.read_bits(width_bits)
            h = bs.read_bits(height_bits)
            x_off = bs.read_signed(x_offset_bits)
            y_off = bs.read_signed(y_offset_bits)
            opt_bytes = bs.read_bits(optional_bytes_bits)
            coded_bytes = bs.read_bits(coded_bytes_bits)
            bottom_up = bs.read_bool()

            x_lower = x_off
            x_upper = x_off + w
            if bottom_up:
                y_lower = y_off
                y_upper = y_off + h
            else:
                y_lower = y_off - h + 1
                y_upper = y_off + 1

            frame_headers.append({
                'var0': var0, 'width': w, 'height': h,
                'x_off': x_off, 'y_off': y_off,
                'opt_bytes': opt_bytes, 'coded_bytes': coded_bytes,
                'bottom_up': bottom_up,
                'x_lower': x_lower, 'x_upper': x_upper,
                'y_lower': y_lower, 'y_upper': y_upper
            })

        # Skip optional bytes if any
        for fh in frame_headers:
            if fh['opt_bytes'] > 0:
                bs.align_to_byte()
                bs.skip(fh['opt_bytes'] * 8)

        # 3. Compute Direction Extents
        dir_x_lower = min(fh['x_lower'] for fh in frame_headers)
        dir_x_upper = max(fh['x_upper'] for fh in frame_headers)
        dir_y_lower = min(fh['y_lower'] for fh in frame_headers)
        dir_y_upper = max(fh['y_upper'] for fh in frame_headers)
        dir_w = dir_x_upper - dir_x_lower
        dir_h = dir_y_upper - dir_y_lower

        # 4. Read Substream sizes
        equal_cells_size = bs.read_bits(20) if compress_equal_cells else 0
        pixel_mask_size = bs.read_bits(20)
        if has_raw_pixel_encoding:
            raw_usage_size = bs.read_bits(20)
            raw_codes_size = bs.read_bits(20)
        else:
            raw_usage_size = 0
            raw_codes_size = 0

        # Palette code mapping
        code_to_pixel_value = []
        for i in range(256):
            if bs.read_bool():
                code_to_pixel_value.append(i)

        # Substreams
        equal_cell_bs = bs.create_subview(equal_cells_size)
        bs.skip(equal_cells_size)

        pixel_mask_bs = bs.create_subview(pixel_mask_size)
        bs.skip(pixel_mask_size)

        raw_usage_bs = bs.create_subview(raw_usage_size)
        bs.skip(raw_usage_size)

        raw_codes_bs = bs.create_subview(raw_codes_size)
        bs.skip(raw_codes_size)

        displacement_bs = bs.create_subview(len(dir_data) * 8 - bs.bit_pos)

        # 5. Cell Grid Calculation for each Frame
        nb_pb_cells_x = 1 + (dir_w - 1) // 4 if dir_w > 0 else 1
        nb_pb_cells_y = 1 + (dir_h - 1) // 4 if dir_h > 0 else 1

        frames_data = []
        for fh in frame_headers:
            ox = fh['x_lower'] - dir_x_lower
            oy = fh['y_lower'] - dir_y_lower
            fw = fh['width']
            fh_h = fh['height']

            w_first = 4 - (ox % 4)
            if (fw - w_first) <= 1:
                nb_cx = 1
            else:
                tmp = fw - w_first - 1
                nb_cx = 2 + (tmp // 4)
                if (tmp % 4) == 0:
                    nb_cx -= 1

            h_first = 4 - (oy % 4)
            if (fh_h - h_first) <= 1:
                nb_cy = 1
            else:
                tmp = fh_h - h_first - 1
                nb_cy = 2 + (tmp // 4)
                if (tmp % 4) == 0:
                    nb_cy -= 1

            cell_widths = [4] * nb_cx
            cell_heights = [4] * nb_cy
            if nb_cx == 1:
                cell_widths[0] = fw
            else:
                cell_widths[0] = w_first
                cell_widths[-1] = fw - (w_first + 4 * (nb_cx - 2))

            if nb_cy == 1:
                cell_heights[0] = fh_h
            else:
                cell_heights[0] = h_first
                cell_heights[-1] = fh_h - (h_first + 4 * (nb_cy - 2))

            frames_data.append({
                'header': fh,
                'ox': ox, 'oy': oy,
                'nb_cx': nb_cx, 'nb_cy': nb_cy,
                'cell_widths': cell_widths,
                'cell_heights': cell_heights,
                'cell_same': [False] * (nb_cx * nb_cy),
                'first_pb_entry': 0,
                'pixels': bytearray(fw * fh_h)
            })

        # 6. Stage 1: Decode PB Entries
        pb_entries = []
        pixel_buffer_last_entry = [None] * (nb_pb_cells_x * nb_pb_cells_y)

        for fd in frames_data:
            fd['first_pb_entry'] = len(pb_entries)
            fc_ox = fd['ox'] // 4
            fc_oy = fd['oy'] // 4

            for cy in range(fd['nb_cy']):
                cur_cell_y = fc_oy + cy
                for cx in range(fd['nb_cx']):
                    cur_cell_x = fc_ox + cx
                    pb_idx = cur_cell_x + cur_cell_y * nb_pb_cells_x
                    frame_cell_idx = cx + cy * fd['nb_cx']

                    last_entry_idx = pixel_buffer_last_entry[pb_idx]
                    same_as_prev = False
                    pixel_mask = 0x0F

                    if last_entry_idx is not None:
                        if compress_equal_cells:
                            same_as_prev = equal_cell_bs.read_bool()
                        if not same_as_prev:
                            pixel_mask = pixel_mask_bs.read_bits(4)

                    fd['cell_same'][frame_cell_idx] = same_as_prev

                    if not same_as_prev:
                        pixel_codes_stack = []
                        if pixel_mask != 0:
                            nb_pixels_in_mask = bin(pixel_mask).count('1')
                            decode_raw = raw_usage_bs.total_bits > 0 and raw_usage_bs.read_bool()

                            last_pixel_code = 0
                            for _ in range(nb_pixels_in_mask):
                                if decode_raw:
                                    cur_code = raw_codes_bs.read_bits(8)
                                else:
                                    cur_code = last_pixel_code
                                    while True:
                                        disp = displacement_bs.read_bits(4)
                                        cur_code += disp
                                        if disp != 0x0F:
                                            break
                                if cur_code == last_pixel_code:
                                    break
                                else:
                                    last_pixel_code = cur_code
                                    pixel_codes_stack.append(cur_code)

                        prev_entry = pb_entries[last_entry_idx] if last_entry_idx is not None else [0, 0, 0, 0]
                        new_entry = [0] * 4

                        cur_idx = len(pixel_codes_stack) - 1
                        for i in range(4):
                            if pixel_mask & (1 << i):
                                code = pixel_codes_stack[cur_idx] if cur_idx >= 0 else 0
                                cur_idx -= 1
                                new_entry[i] = code_to_pixel_value[code] if code < len(code_to_pixel_value) else 0
                            else:
                                new_entry[i] = prev_entry[i]

                        pixel_buffer_last_entry[pb_idx] = len(pb_entries)
                        pb_entries.append(new_entry)

        # 7. Stage 2: Render into Direction Pixel Buffer & Output Frames
        p_buffer = bytearray(dir_w * dir_h)
        pb_cell_sizes = [(0xF, 0xF)] * (nb_pb_cells_x * nb_pb_cells_y)

        decoded_images = []

        for frame_idx, fd in enumerate(frames_data):
            pb_entry_idx = fd['first_pb_entry']
            pb_cell_pos_y = fd['oy']

            for cy in range(fd['nb_cy']):
                cell_h = fd['cell_heights'][cy]
                pb_cell_pos_x = fd['ox']

                for cx in range(fd['nb_cx']):
                    cell_w = fd['cell_widths'][cx]
                    frame_cell_idx = cx + cy * fd['nb_cx']
                    pb_idx = (pb_cell_pos_x // 4) + (pb_cell_pos_y // 4) * nb_pb_cells_x
                    old_cw, old_ch = pb_cell_sizes[pb_idx]

                    if fd['cell_same'][frame_cell_idx]:
                        if cell_w != old_cw or cell_h != old_ch:
                            for py in range(cell_h):
                                row_start = (pb_cell_pos_y + py) * dir_w + pb_cell_pos_x
                                for px in range(cell_w):
                                    p_buffer[row_start + px] = 0
                    else:
                        pix_values = pb_entries[pb_entry_idx]
                        pb_entry_idx += 1

                        if pix_values[0] == pix_values[1]:
                            val = pix_values[0]
                            for py in range(cell_h):
                                row_start = (pb_cell_pos_y + py) * dir_w + pb_cell_pos_x
                                for px in range(cell_w):
                                    p_buffer[row_start + px] = val
                        else:
                            if pix_values[1] == pix_values[2]:
                                nb_bits = 1
                            else:
                                nb_bits = 2

                            for py in range(cell_h):
                                row_start = (pb_cell_pos_y + py) * dir_w + pb_cell_pos_x
                                for px in range(cell_w):
                                    code_idx = displacement_bs.read_bits(nb_bits)
                                    val = pix_values[code_idx]
                                    p_buffer[row_start + px] = val

                    pb_cell_sizes[pb_idx] = (cell_w, cell_h)
                    pb_cell_pos_x += cell_w
                pb_cell_pos_y += cell_h

            fw = fd['header']['width']
            fh_h = fd['header']['height']
            frame_pixels = bytearray(fw * fh_h)

            for py in range(fh_h):
                src_row = (fd['oy'] + py) * dir_w + fd['ox']
                dst_row = py * fw
                frame_pixels[dst_row:dst_row + fw] = p_buffer[src_row:src_row + fw]

            decoded_images.append({
                'width': fw,
                'height': fh_h,
                'x_offset': fd['header']['x_off'],
                'y_offset': fd['header']['y_off'],
                'pixels': frame_pixels,
                'bottom_up': fd['header']['bottom_up']
            })

        return decoded_images

def export_dcc_to_png(dcc_path: str, out_dir: str, pal_path: str, base_name: str = None):
    """將 DCC 檔案解碼並輸出為透明 RGBA PNG 序列圖"""
    palette = load_palette(pal_path)
    decoder = DCCDecoder(dcc_path)
    os.makedirs(out_dir, exist_ok=True)
    if base_name is None:
        base_name = os.path.splitext(os.path.basename(dcc_path))[0]

    output_files = []
    for dir_idx in range(decoder.directions):
        frames = decoder.decode_direction(dir_idx)
        for frame_idx, fr in enumerate(frames):
            fw = fr['width']
            fh = fr['height']
            if fw == 0 or fh == 0:
                continue

            img = Image.new('RGBA', (fw, fh), (0, 0, 0, 0))
            pixels = fr['pixels']
            for y in range(fh):
                # 判斷是否需要上下顛倒
                src_y = (fh - 1 - y) if fr['bottom_up'] else y
                for x in range(fw):
                    idx = pixels[src_y * fw + x]
                    color = palette[idx]
                    img.putpixel((x, y), color)

            filename = f"{base_name}_d{dir_idx}_f{frame_idx}.png"
            out_file = os.path.join(out_dir, filename)
            img.save(out_file)
            output_files.append(out_file)

    print(f"Exported {len(output_files)} frames from {dcc_path} to {out_dir}")
    return output_files

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python dcc_to_png.py <file.dcc> <output_dir> <pal.dat>")
        sys.exit(1)
    export_dcc_to_png(sys.argv[1], sys.argv[2], sys.argv[3])
