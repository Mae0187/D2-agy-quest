"""Numerically verify the 64 -> 16 direction mapping against the artwork.

    python tools/verify_directions.py <file.dcc> <pal.dat>

The flame is brightest at its leading edge and fades into the trail, so the
luminance centroid of a sprite sits toward the heading it was drawn for.  For
each compass sector this tool compares that implied heading with the heading
the mapping table claims, and reports the agreement.

A mapping that is merely rotated or mirrored shows up immediately: every
sector leans the same wrong way, or the sign flips at a seam.  This is the
check spec section 86 calls the highest-risk part of the whole project.
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "asset-builder"))

from dcc import load  # noqa: E402
from dcc.dir_tables import asset_direction, compass_name  # noqa: E402

sys.path.insert(0, str(Path(__file__).resolve().parent))
from render_dcc import palette_rgba  # noqa: E402


def luminance_centroid(indices: bytes, width: int, height: int, palette) -> tuple[float, float, float]:
    """Return (dx, dy, weight) of the sprite's brightness, in pixels."""
    total = 0.0
    sum_x = 0.0
    sum_y = 0.0
    for y in range(height):
        row = y * width
        for x in range(width):
            r, g, b, a = palette[indices[row + x]]
            if a == 0:
                continue
            weight = 0.299 * r + 0.587 * g + 0.114 * b
            total += weight
            sum_x += weight * x
            sum_y += weight * y
    if total == 0:
        return 0.0, 0.0, 0.0
    return sum_x / total - (width - 1) / 2, sum_y / total - (height - 1) / 2, total


def main() -> int:
    dcc = load(sys.argv[1])
    palette = palette_rgba(Path(sys.argv[2]).read_bytes())

    print(f"{'sector':>6}  {'compass':>7}  {'dcc':>3}  {'lean(dx,dy)':>16}  {'screen heading':>15}  {'dot':>6}")
    agreements = 0
    dots = []

    for step in range(16):
        sector = step * 4
        index = asset_direction(sector, 16)
        direction = dcc.directions[index]
        frame = direction.frames[0]
        dx, dy, _ = luminance_centroid(frame.image(direction), frame.width, frame.height, palette)

        # 0 = north (up the screen), increasing clockwise.
        angle = math.radians(sector * (360.0 / 64.0))
        ex, ey = math.sin(angle), -math.cos(angle)
        length = math.hypot(dx, dy)
        dot = (dx * ex + dy * ey) / length if length else 0.0
        dots.append(dot)
        if dot > 0:
            agreements += 1

        print(
            f"{sector:>6}  {compass_name(sector):>7}  {index:>3}  "
            f"({dx:>6.1f},{dy:>6.1f})  ({ex:>5.2f},{ey:>5.2f})  {dot:>6.2f}"
        )

    mean = sum(dots) / len(dots)
    print()
    print(f"sectors whose flame leans outward : {agreements}/16")
    print(f"mean dot product                  : {mean:+.3f}")
    if agreements == 16:
        print("=> mapping and artwork agree on this convention (head points along the heading)")
    elif agreements == 0:
        print("=> artwork is flipped 180 degrees relative to this convention (tail points along it)")
    else:
        print("=> INCONSISTENT: the mapping has a seam - do not trust it yet")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
