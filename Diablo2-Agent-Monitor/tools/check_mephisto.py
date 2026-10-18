import struct
import os
import sys

sys.path.append(os.path.join(os.path.dirname(__file__)))
from dc6_to_png import decode_dc6_frame

fp = os.path.normpath(os.path.join(os.path.dirname(__file__), 'mpq_raw', 'd2data', 'data', 'global', 'monsters', 'MP', 'TR', 'MPTRLITNUHTH.DC6'))
with open(fp, 'rb') as f:
    data = f.read()

off = struct.unpack_from('<I', data, 24)[0]
info, pixels = decode_dc6_frame(data, off)
w, h = info['width'], info['height']
print(f"Mephisto TR frame 0: w={w}, h={h}, flip={info['flip']}")

for row in range(0, h, 10):
    cnt = sum(1 for x in range(w) if pixels[row * w + x] != 0)
    print(f"Row {row:3d}: {'#' * (cnt // 2)}")
