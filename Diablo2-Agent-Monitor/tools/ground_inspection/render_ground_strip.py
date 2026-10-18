"""Draw a row of rebuilt characters so their feet can be judged by eye.

Every frame is drawn at `ground_y - anchorY`, which is exactly what the engine
does, so a character whose anchor is wrong shows up here as feet that float
above or sink below the line. The line is drawn across the whole strip.

Usage:
    python tools/render_ground_strip.py sorceress:light sorceress:heavy ...
    python tools/render_ground_strip.py --one-per-class
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
CHARS = ROOT / 'assets' / 'characters'

CLASSES = ['sorceress', 'amazon', 'barbarian', 'paladin', 'necromancer',
           'druid', 'assassin']
TIERS = ['light', 'medium', 'heavy']

TILE = 26
HALF_TILE_W = 26
GROUND = 0
SCALE = 3
BACKGROUND = (46, 44, 56, 255)
GROUND_COLOUR = (255, 90, 90, 255)
LABEL_COLOUR = (230, 230, 240, 255)


def load_idle(className: str, tier: str):
    sheet = json.loads(
        (CHARS / f'{className}_{tier}_idle.json').read_text(encoding='utf-8'))
    image = Image.open(CHARS / sheet['atlas']).convert('RGBA')
    animation = list(sheet['animations'].values())[0]
    return image, animation


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('pairs', nargs='*', metavar='CLASS:TIER')
    parser.add_argument('--one-per-class', action='store_true')
    parser.add_argument('--direction', type=int, default=0)
    parser.add_argument('--out', default='out/ground_strip.png')
    args = parser.parse_args()

    if args.one_per_class:
        pairs = [(cls, 'light') for cls in CLASSES]
    elif args.pairs:
        pairs = [tuple(pair.split(':')) for pair in args.pairs]
    else:
        pairs = [(cls, tier) for cls in CLASSES for tier in TIERS]

    # Lay the characters out as if on a row of isometric tiles, so the ground
    # line is shared and the comparison is meaningful.
    drawn = []
    for index, (className, tier) in enumerate(pairs):
        image, animation = load_idle(className, tier)
        row = animation['framesData'][args.direction]
        # The frame that reaches lowest is the one that should touch the line.
        boxes = [box for row_data in animation['framesData'] for box in row_data]
        lowest = max(box['anchorY'] for box in boxes)
        frame = next((box for box in row if box['anchorY'] == lowest), row[0])
        crop = image.crop((frame['x'], frame['y'],
                           frame['x'] + frame['width'],
                           frame['y'] + frame['height']))
        drawn.append((f'{className[:4]}/{tier[:1]}', crop, frame))

    padding = 20
    width = sum(crop.width + padding for _label, crop, _frame in drawn) + padding
    height = max(crop.height for _label, crop, _frame in drawn) + 90
    ground_y = height - 40

    strip = Image.new('RGBA', (width, height), BACKGROUND)
    draw = ImageDraw.Draw(strip)
    draw.line([(0, ground_y), (width, ground_y)], fill=GROUND_COLOUR, width=1)

    x = padding
    for label, crop, frame in drawn:
        # Exactly the engine's placement: screenY - anchorY puts the anchor row
        # on the ground line.
        strip.alpha_composite(crop, (x, ground_y - frame['anchorY']))
        draw.text((x, ground_y + 6), label, fill=LABEL_COLOUR)
        x += crop.width + padding

    if SCALE != 1:
        strip = strip.resize((strip.width * SCALE, strip.height * SCALE),
                             Image.NEAREST)
    out = ROOT / args.out
    out.parent.mkdir(parents=True, exist_ok=True)
    strip.save(out)
    print(f'{out.relative_to(ROOT)}  ({len(drawn)} 個角色，地面線在 y={ground_y})')
    print('每張圖都畫在 ground_y - anchorY，與引擎相同；腳應該貼在紅線上。')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
