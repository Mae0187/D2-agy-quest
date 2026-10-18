"""Measure where a sprite actually touches the ground, per direction.

    python tools/check_ground_contact.py --manifest OLD/companions_manifest.json \
        --root diablo2_normalized_assets

A sprite sheet places each frame in a fixed cell, and the anchor says which row
of that cell is the ground line. If the artwork's lowest opaque pixel does not
sit on the anchor row, the creature hovers above its shadow - and because one
anchor is shared by every direction, the amount differs per facing, which no
single correction can fix.

This measures the artwork rather than trusting the anchor, so it can say whether
a sprite set is placed correctly without reading the code that placed it.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
from repack_ground_aligned import largest_component_bottom  # noqa: E402

# The manifest is a JS file wrapping a JSON object; this pulls the object out.
def load_manifest(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    start = text.index("{")
    end = text.rindex("}")
    return json.loads(text[start:end + 1])


def bottom_row(cell: Image.Image) -> int | None:
    """Lowest row containing an opaque pixel, or None for an empty cell."""
    alpha = cell.getchannel("A")
    bbox = alpha.getbbox()
    return None if bbox is None else bbox[3] - 1


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--root", default=".", help="where the file paths are relative to")
    parser.add_argument("--only", default=None, help="one companion key")
    parser.add_argument("--tolerance", type=int, default=2)
    args = parser.parse_args()

    manifest = load_manifest(Path(args.manifest))
    root = Path(args.root)

    # Two shapes exist. A per-character manifest has "actions" at the top level;
    # the companion manifest is keyed by creature with "actions" inside each.
    # Accepting both means one tool covers every sheet set in the project.
    if "actions" in manifest:
        label = manifest.get("character") or manifest.get("name") or Path(args.manifest).parent.name
        tier = manifest.get("armor_tier")
        entries = {f"{label}/{tier}" if tier else label: manifest}
    else:
        entries = manifest

    problems = 0
    rows = []
    for key, entry in entries.items():
        if args.only and key != args.only:
            continue
        for action_name, action in (entry.get("actions") or {}).items():
            path = root / action["file"]
            if not path.exists():
                # The old manifest points at its own asset tree; ours may differ.
                continue

            image = Image.open(path).convert("RGBA")
            cell_w = action["cell_width"]
            cell_h = action["cell_height"]
            directions = action["directions"]
            frames = action["frames"]

            floats = []
            for d in range(directions):
                best = None
                for f in range(frames):
                    box = (f * cell_w, d * cell_h, (f + 1) * cell_w, (d + 1) * cell_h)
                    if box[2] > image.width or box[3] > image.height:
                        continue
                    row = bottom_row(image.crop(box))
                    if row is None:
                        continue
                    # The lowest the artwork reaches in this direction.
                    best = row if best is None else max(best, row)
                if best is not None:
                    floats.append(action["anchor_y"] - (best + 1))

            if not floats:
                continue

            spread = max(floats) - min(floats)
            worst = max(abs(v) for v in floats)
            bad = worst > args.tolerance or spread > args.tolerance
            if bad:
                problems += 1
            rows.append((f"{key}/{action_name}", floats, action["anchor_y"], bad))

    width = max(len(r[0]) for r in rows) if rows else 10
    print(f"{'action':<{width}}  {'anchor':>6}  {'float per direction':<34} spread")
    print("-" * (width + 52))
    for name, floats, anchor, bad in rows:
        shown = ",".join(str(v) for v in floats)
        if len(shown) > 32:
            shown = shown[:29] + "..."
        spread = max(floats) - min(floats)
        mark = "  <-- " + ("inconsistent" if spread > args.tolerance else "offset")
        if max(abs(v) for v in floats) <= args.tolerance:
            mark = ""
        print(f"{name:<{width}}  {anchor:>6}  {shown:<34} {spread:>4}{mark if bad else ''}")

    print(f"\nfloat = anchor_y - (lowest opaque row + 1).  0 means the artwork sits "
          f"exactly on its ground line.")
    print(f"{problems} action(s) off by more than {args.tolerance} px"
          f"{' or uneven across directions' if problems else ''}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
