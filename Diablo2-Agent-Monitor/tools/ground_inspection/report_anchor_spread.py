"""Report the ground-contact row per direction and how much it varies.

    python tools/report_anchor_spread.py [--root diablo2_normalized_assets/characters]

This decides which fix an action needs, and the two fixes are very different in
cost:

  spread 0    every direction's feet already agree. Only the manifest's
              `anchor_y` is wrong. Fix it by setting the anchor to the measured
              row - a one-number change, no image touched.

  spread > 0  the directions disagree with each other. No single anchor can be
              right, so the artwork has to be re-laid-out: the cell grown and
              the frames re-pasted against one baseline. That is the original
              exporter's job and cannot be done by shifting, because the content
              already reaches the top of its cell.

Contact is the bottom of the largest connected blob, so a detached speck or a
weapon drawn beside the boots does not count.
"""

from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path

import numpy as np
from PIL import Image

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
from repack_ground_aligned import largest_component_bottom  # noqa: E402


def load_manifest(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    return json.loads(text[text.index("{"):text.rindex("}") + 1])


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default="diablo2_normalized_assets/characters")
    parser.add_argument("--tier", default=None, help="restrict to one armour tier")
    args = parser.parse_args()

    root = Path(args.root)
    fixable = 0
    needs_recell = 0

    for manifest_path in sorted(root.rglob("manifest.json")):
        manifest = load_manifest(manifest_path)
        if args.tier and manifest.get("armor_tier") != args.tier:
            continue
        actions = manifest["actions"]
        label = f"{manifest.get('character')}/{manifest.get('armor_tier')}"
        lines = []
        for name, action in actions.items():
            path = manifest_path.parent / action["file"]
            if not path.exists():
                continue
            sheet = np.asarray(Image.open(path).convert("RGBA"))
            cw, ch, ay = action["cell_width"], action["cell_height"], action["anchor_y"]

            contacts = []
            for d in range(action["directions"]):
                best = None
                for f in range(action["frames"]):
                    cell = sheet[d * ch:(d + 1) * ch, f * cw:(f + 1) * cw]
                    if cell.size == 0:
                        continue
                    bottom = largest_component_bottom(cell)
                    if bottom is not None and (best is None or bottom > best):
                        best = bottom
                if best is not None:
                    contacts.append(best)

            if not contacts:
                continue
            spread = max(contacts) - min(contacts)
            common = Counter(contacts).most_common(1)[0]
            if spread == 0:
                fixable += 1
                verdict = f"anchor {ay} -> {contacts[0]}   (manifest only)"
            else:
                needs_recell += 1
                verdict = (f"spread {spread}   most common row {common[0]} "
                           f"({common[1]}/{len(contacts)} dirs)   needs re-cell")
            lines.append(f"    {name:<14} anchor {ay:>3}   {verdict}")

        if lines:
            print(label)
            for line in lines:
                print(line)

    print(f"\n{fixable} action(s) fixable by changing the manifest only")
    print(f"{needs_recell} action(s) need the artwork re-laid-out")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
