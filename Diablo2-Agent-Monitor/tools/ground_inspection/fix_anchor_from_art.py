"""Set each action's `anchor_y` to the row the artwork actually touches.

    python tools/fix_anchor_from_art.py --manifest M.json [--apply]

The manifests declare one `anchor_y` per action, and in three places in this
asset set that number disagrees with the art: `barbarian/heavy` idle/walk/run
say 80 while the feet are at 89, and `barbarian/medium` cast says 90 while the
feet are at 99. The artwork is fine; the number is wrong.

Only the manifest is touched. Moving the raster instead would clip, because the
content of those sheets already reaches the top of its cell - which is why the
shift-based repacker refused and why this is the correct fix for them.

Actions whose directions disagree with each other get the most common row and a
warning. A single anchor cannot be right for all of them, but the majority wins
and the alternative - re-laying-out the sheet - needs the original exporter.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from repack_ground_aligned import largest_component_bottom  # noqa: E402


def load_manifest(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    return json.loads(text[text.index("{"):text.rindex("}") + 1])


def contacts(sheet: np.ndarray, action: dict) -> list[int]:
    cw, ch = action["cell_width"], action["cell_height"]
    out = []
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
            out.append(best)
    return out


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--dry-run", action="store_true", help=argparse.SUPPRESS)
    args = parser.parse_args()

    path = Path(args.manifest)
    manifest = load_manifest(path)
    actions = manifest["actions"]

    changed = 0
    print(f"{path}   {'APPLY' if args.apply else 'dry run'}")
    print(f"  {'action':<14} {'anchor':>6} {'measured':>8} {'dirs agreeing':>14}  verdict")

    for name, action in actions.items():
        sheet_path = path.parent / action["file"]
        if not sheet_path.exists():
            continue
        sheet = np.asarray(Image.open(sheet_path).convert("RGBA"))
        rows = contacts(sheet, action)
        if not rows:
            continue

        common, count = Counter(rows).most_common(1)[0]
        spread = max(rows) - min(rows)
        current = action["anchor_y"]

        if current == common and spread == 0:
            verdict = "ok"
        elif current == common:
            verdict = f"ok, {len(rows) - count} direction(s) off by up to {spread}px"
        elif spread == 0:
            verdict = f"FIX {current} -> {common}"
        else:
            verdict = f"FIX {current} -> {common}   ({len(rows) - count} direction(s) still off)"
        print(f"  {name:<14} {current:>6} {common:>8} {count:>7}/{len(rows):<6}  {verdict}")

        if current != common:
            action["anchor_y"] = common
            changed += 1

    if args.apply and changed:
        path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
                        encoding="utf-8")
        # The .js twin is what the browser actually loads for this asset set, so
        # writing only the .json would leave the running page unchanged.
        js_path = path.with_suffix(".js")
        if js_path.exists():
            text = js_path.read_text(encoding="utf-8")
            start = text.index("{")
            end = text.rindex("}")
            js_path.write_text(text[:start]
                               + json.dumps(manifest, indent=2, ensure_ascii=False)
                               + text[end:], encoding="utf-8")
            print(f"\n  updated {path.name} and {js_path.name} ({changed} action(s))")
        else:
            print(f"\n  updated {path.name} ({changed} action(s))")
    elif args.apply:
        print("\n  nothing to change")
    else:
        print(f"\n  dry run: {changed} action(s) would change. Add --apply.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
