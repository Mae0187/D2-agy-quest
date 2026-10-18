"""Direction Laboratory (spec section 51).

Renders the 16 compass sectors around a circle, each showing the asset sprite
that the 64->16 mapping table selects for that heading.  If the mapping is
right the flame rotates smoothly; if any index is off by one or mirrored, the
ring shows a visible seam.

    python tools/direction_lab.py <file.dcc> <pal.dat> <out.png> [--frame N]
"""

from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "asset-builder"))

from dcc import load  # noqa: E402
from dcc.dir_tables import asset_direction, compass_name  # noqa: E402

sys.path.insert(0, str(Path(__file__).resolve().parent))
from render_dcc import BACKGROUND, LABEL, frame_image, palette_rgba  # noqa: E402

RING_RADIUS = 300
CANVAS = 900


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("dcc")
    parser.add_argument("palette")
    parser.add_argument("out")
    parser.add_argument("--frame", type=int, default=0)
    args = parser.parse_args()

    dcc = load(args.dcc)
    palette = palette_rgba(Path(args.palette).read_bytes())

    canvas = Image.new("RGBA", (CANVAS, CANVAS), BACKGROUND)
    draw = ImageDraw.Draw(canvas)
    cx = cy = CANVAS // 2

    for step in range(16):
        sector = step * 4
        index = asset_direction(sector, 16)
        direction = dcc.directions[index]
        frame = direction.frames[args.frame]
        image = frame_image(frame.image(direction), frame.width, frame.height, palette)

        # 0 = north (up the screen), increasing clockwise.
        angle = math.radians(sector * (360.0 / 64.0))
        px = cx + RING_RADIUS * math.sin(angle)
        py = cy - RING_RADIUS * math.cos(angle)

        # Guide line showing the heading the sprite is supposed to face.
        draw.line((cx, cy, px, py), fill=(70, 70, 90), width=1)
        canvas.alpha_composite(image, (int(px - frame.width / 2), int(py - frame.height / 2)))

        label = f"{compass_name(sector)}  dcc {index}"
        draw.text((px - 34, py + 40), label, fill=LABEL)

    draw.ellipse((cx - 4, cy - 4, cx + 4, cy + 4), fill=(200, 80, 60))
    canvas.convert("RGB").save(args.out)
    print(f"wrote {args.out}")
    print()
    print(" sector  compass   dcc index")
    for step in range(16):
        sector = step * 4
        print(f"  {sector:>5}  {compass_name(sector):>7}   {asset_direction(sector, 16):>3}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
