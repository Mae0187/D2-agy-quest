"""Measure the ground contact at two alpha thresholds, to separate feet from shadow.

    python tools/check_ground_solid.py --manifest M.json --root DIR

A sprite's lowest *opaque* pixel may be a painted drop shadow rather than the
foot. Shadow sits below the foot, is faint, and is present in every direction;
a foot is solid and moves between directions. Reporting both numbers says which
one is making the anchor look wrong, and the fix is different for each:

  - solid content below the anchor  -> the art really is sunk
  - only faint content below it     -> a shadow the anchor should ignore
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
from repack_ground_aligned import largest_component_bottom  # noqa: E402


def load_manifest(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    return json.loads(text[text.index("{"):text.rindex("}") + 1])


def lowest_row(alpha: np.ndarray, threshold: int) -> int | None:
    """Bottom of the cell's largest connected blob.

    This used to be "the lowest row with any pixel above the threshold", which
    is wrong: a sheet can contain a detached object below the feet - a weapon
    drawn beside the boots, or a stray speck - and reading that as the ground
    contact reports a 10-20 px error on artwork that is placed correctly. It
    reported the whole barbarian set as 10-15 px sunk when 14 of its 16 walk
    directions were exactly on the anchor.

    The blob decides; the threshold is kept only so callers can pass one.
    """
    mask = alpha > 0
    if not mask.any():
        return None
    cell = np.zeros((mask.shape[0], mask.shape[1], 4), dtype=np.uint8)
    cell[:, :, 3] = mask.astype(np.uint8) * 255
    return largest_component_bottom(cell)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--root", default=".")
    parser.add_argument("--solid", type=int, default=200)
    parser.add_argument("--action", default=None)
    args = parser.parse_args()

    manifest = load_manifest(Path(args.manifest))
    actions = manifest["actions"] if "actions" in manifest else \
        next(iter(manifest.values()))["actions"]

    label = manifest.get("character") or Path(args.manifest).parent.name
    tier = manifest.get("armor_tier", "")
    print(f"{label}/{tier}")
    print(f"  {'action':<14} {'anchor':>6} {'any-opaque':>12} {'solid>200':>12}  verdict")

    for name, action in actions.items():
        if args.action and name != args.action:
            continue
        path = Path(args.root) / action["file"]
        if not path.exists():
            continue
        sheet = np.asarray(Image.open(path).convert("RGBA"))
        cw, ch = action["cell_width"], action["cell_height"]
        ay = action["anchor_y"]

        any_rows, solid_rows = [], []
        for d in range(action["directions"]):
            for f in range(action["frames"]):
                cell = sheet[d * ch:(d + 1) * ch, f * cw:(f + 1) * cw]
                if cell.size == 0:
                    continue
                alpha = cell[:, :, 3]
                a = lowest_row(alpha, 0)
                s = lowest_row(alpha, args.solid)
                if a is not None:
                    any_rows.append(a)
                if s is not None:
                    solid_rows.append(s)

        if not any_rows:
            continue
        # The deepest reach, as a distance below (positive) or above the anchor.
        any_below = max(any_rows) + 1 - ay
        solid_below = (max(solid_rows) + 1 - ay) if solid_rows else None
        spread = max(any_rows) - min(any_rows)

        if solid_below is None:
            verdict = "no solid content?"
        elif abs(solid_below) <= 2 and spread <= 2:
            verdict = "ok"
        elif solid_below > 2:
            verdict = f"SOLID {solid_below}px below the line"
        elif solid_below < -2:
            verdict = f"solid ends {abs(solid_below)}px above the line (floats)"
        else:
            verdict = f"spread {spread}px across directions"
        print(f"  {name:<14} {ay:>6} {any_below:>12} "
              f"{solid_below if solid_below is not None else '-':>12}  {verdict}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
