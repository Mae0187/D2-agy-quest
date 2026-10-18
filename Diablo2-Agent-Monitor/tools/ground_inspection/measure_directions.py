"""Show the measured drawn angle for each direction of an asset.

    python tools/measure_directions.py <file.dcc> [--palette pal.dat]

The point of this tool is to answer one question: *can* the drawn angle be
measured for this kind of sprite?

It works for an elongated sprite such as a missile, where the silhouette's
principal axis genuinely is the direction of travel. It does not work for a
humanoid, whose silhouette is roughly as tall as it is wide and whose
orientation is carried by which limbs are where - neither of which a principal
axis or a lit-pixel split can recover. Printing the sequence makes that
obvious: a usable measurement rises or falls monotonically with the direction
index, and a meaningless one jumps around.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "asset-builder"))

from dcc import load as load_dcc  # noqa: E402
from dcc.sprite_angle import lit_pixels, measure_heading  # noqa: E402

sys.path.insert(0, str(Path(__file__).resolve().parent))
from render_dcc import palette_rgba  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("dcc")
    parser.add_argument("--palette", default="assets/raw-cache/pal.dat")
    args = parser.parse_args()

    dcc = load_dcc(args.dcc)
    palette = palette_rgba(Path(args.palette).read_bytes())

    print(f"{Path(args.dcc).name}: {dcc.direction_count} directions")
    print(f"{'dir':>3} {'drawn heading':>14} {'confidence':>11} {'lit px':>8}")
    headings = []
    for index, direction in enumerate(dcc.directions):
        heading, confidence = measure_heading(direction, palette)[:2]
        headings.append(heading)
        frame = direction.frames[0]
        lit = len(lit_pixels(frame.image(direction), frame.width, frame.height, palette))
        print(f"{index:>3} {heading:>13.1f}° {confidence:>11.2f} {lit:>8}")

    # A usable measurement must advance in one direction only as the direction
    # index goes round. It is NOT a test of even spacing: the direction index
    # follows the *world* compass, and the 2:1 isometric projection turns evenly
    # spaced world directions into screen angles between about 20 and 134
    # degrees apart. Testing for even steps rejects a perfectly good
    # measurement, which is what an earlier version of this tool did.
    steps = [((headings[(i + 1) % len(headings)] - headings[i] + 540) % 360) - 180
             for i in range(len(headings))]
    forwards = sum(1 for step in steps if step > 0)
    backwards = sum(1 for step in steps if step < 0)
    print()
    print("step between consecutive directions, signed:")
    print("  " + "  ".join(f"{step:+.0f}" for step in steps))
    print(f"  {forwards} forwards, {backwards} backwards")
    spread = (max(steps) - min(steps)) if steps else 0
    if forwards and backwards:
        print("  -> the sequence reverses; this measurement is NOT usable here")
        print("     (a humanoid's principal axis follows the body's height, not its facing)")
    else:
        print(f"  -> advances in one direction throughout (spread {spread:.0f}°, "
              f"the isometric projection's doing); usable")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
