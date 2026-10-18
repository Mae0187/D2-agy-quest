"""Draw a strip of cells with the anchor line marked, to see the ground contact.

    python tools/render_anchor_strip.py --manifest M.json --root DIR --action idle \
        --out assets/preview/anchor_idle.png

A number says the artwork's lowest opaque pixel is 10 rows below the anchor. It
does not say whether that is the character sunk into the floor or a shadow
painted under the feet, and those need opposite fixes. A red line drawn across
each cell answers it in one look.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter


def load_manifest(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    return json.loads(text[text.index("{"):text.rindex("}") + 1])


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--root", default=".")
    parser.add_argument("--action", default="idle")
    parser.add_argument("--out", default="assets/preview/anchor_strip.png")
    parser.add_argument("--max-cells", type=int, default=8)
    parser.add_argument("--scale", type=int, default=2)
    parser.add_argument("--by", choices=("direction", "frame"), default="direction",
                        help="lay the strip out across directions, or across the "
                             "frames of a single direction")
    parser.add_argument("--direction", type=int, default=0,
                        help="which direction to lay frames out for, with --by frame")
    parser.add_argument("--background", default="#14141a",
                        help="backdrop colour. Use something light for dark artwork: "
                             "a dark boot on a dark backdrop is invisible, and the "
                             "gap above the line then looks like floating")
    parser.add_argument("--outline", action="store_true",
                        help="draw a 1px outline around every opaque pixel, which "
                             "makes the silhouette readable on any backdrop")
    args = parser.parse_args()

    manifest = load_manifest(Path(args.manifest))
    if "actions" in manifest:
        actions = manifest["actions"]
    else:
        first = next(iter(manifest.values()))
        actions = first["actions"]

    action = actions[args.action]
    image = Image.open(Path(args.root) / action["file"]).convert("RGBA")
    cw, ch = action["cell_width"], action["cell_height"]
    directions, frames = action["directions"], action["frames"]
    anchor_y = action["anchor_y"]

    across_directions = args.by == "direction"
    count = min(args.max_cells, directions if across_directions else frames)
    scale = args.scale
    backdrop = tuple(int(args.background.lstrip("#")[i:i + 2], 16) for i in (0, 2, 4))
    strip = Image.new("RGBA", (cw * count * scale, ch * scale), backdrop + (255,))
    draw = ImageDraw.Draw(strip)

    for index in range(count):
        if across_directions:
            box = (0, index * ch, cw, (index + 1) * ch)
            caption = f"d{index}"
        else:
            box = (index * cw, args.direction * ch,
                   (index + 1) * cw, (args.direction + 1) * ch)
            caption = f"f{index}"
        cell = image.crop(box)

        if args.outline:
            # A dark boot on a dark backdrop cannot be judged by eye. Outlining
            # the silhouette makes the foot position readable either way.
            alpha = cell.getchannel("A")
            grown = alpha.filter(ImageFilter.MaxFilter(3))
            edge = ImageChops.subtract(grown, alpha)
            cell = cell.copy()
            outline_layer = Image.new("RGBA", cell.size, (255, 90, 200, 255))
            cell.paste(outline_layer, (0, 0), edge)

        cell = cell.resize((cw * scale, ch * scale), Image.NEAREST)
        strip.alpha_composite(cell, (index * cw * scale, 0))
        draw.text((index * cw * scale + 4, 4), caption, fill=(210, 210, 130, 255))

    for index in range(count):
        x0 = index * cw * scale
        y = anchor_y * scale
        # The ground line the animation claims. Artwork sitting on it is right;
        # artwork below it is sunk; artwork above it floats.
        draw.line([(x0, y), (x0 + cw * scale - 1, y)], fill=(255, 60, 60, 220), width=1)
        draw.line([(x0, 0), (x0, ch * scale)], fill=(70, 70, 90, 255), width=1)

    label = (f"{action.get('name', args.action)}  anchor_y {anchor_y}"
             if across_directions else
             f"{action.get('name', args.action)}  direction {args.direction}  "
             f"anchor_y {anchor_y}")
    draw.text((4, ch * scale - 14), label, fill=(150, 220, 150, 255))

    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    strip.convert("RGB").save(args.out)
    what = (f"directions 0..{count - 1} of {directions}, frame 0"
            if across_directions else
            f"frames 0..{count - 1} of {frames}, direction {args.direction}")
    print(f"{args.out}  {strip.size}  {what}, anchor_y={anchor_y} (red line)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
