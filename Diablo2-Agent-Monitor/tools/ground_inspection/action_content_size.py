"""Report how much of each cell an action's artwork actually occupies.

    python tools/action_content_size.py --manifest M.json --root DIR

An action whose content is a fraction of the size of its siblings was not
produced by the same exporter as the rest - it is an orphan file. Re-aligning an
orphan fixes where it sits but not what it is, so this has to be checked before
spending time on it.

Reports the mean content width and height per action, in pixels, plus the
fraction of the cell that is non-transparent.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image


def load_manifest(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    return json.loads(text[text.index("{"):text.rindex("}") + 1])


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--root", default=".")
    parser.add_argument("--action", default=None)
    args = parser.parse_args()

    manifest = load_manifest(Path(args.manifest))
    actions = manifest["actions"] if "actions" in manifest else \
        next(iter(manifest.values()))["actions"]
    label = manifest.get("character") or Path(args.manifest).parent.parent.name

    print(f"{label}")
    print(f"  {'action':<14} {'cells':>6} {'mean W':>7} {'mean H':>7} "
          f"{'median H':>9} {'filled':>8}")
    widths = {}
    for name, action in actions.items():
        if args.action and name != args.action:
            continue
        path = Path(args.root) / action["file"]
        if not path.exists():
            continue
        sheet = np.asarray(Image.open(path).convert("RGBA"))
        cw, ch = action["cell_width"], action["cell_height"]

        ws, hs, filled = [], [], []
        for d in range(action["directions"]):
            for f in range(action["frames"]):
                cell = sheet[d * ch:(d + 1) * ch, f * cw:(f + 1) * cw]
                if cell.size == 0:
                    continue
                alpha = cell[:, :, 3]
                rows = np.nonzero((alpha > 0).any(axis=1))[0]
                cols = np.nonzero((alpha > 0).any(axis=0))[0]
                if len(rows) == 0:
                    continue
                ws.append(cols[-1] - cols[0] + 1)
                hs.append(rows[-1] - rows[0] + 1)
                filled.append(float((alpha > 0).mean()))
        if not ws:
            print(f"  {name:<14} {'EMPTY':>6}")
            continue
        widths[name] = float(np.mean(ws))
        print(f"  {name:<14} {len(ws):>6} {np.mean(ws):>7.1f} {np.mean(hs):>7.1f} "
              f"{np.median(hs):>9.0f} {np.mean(filled) * 100:>7.1f}%")

    if widths:
        typical = float(np.median(list(widths.values())))
        odd = {k: v for k, v in widths.items() if v < typical * 0.6}
        if odd:
            print(f"\n  actions far smaller than the typical {typical:.0f} px width - "
                  f"likely not from the same exporter:")
            for name, value in sorted(odd.items(), key=lambda kv: kv[1]):
                print(f"      {name:<14} {value:>6.1f} px  ({value / typical * 100:.0f}% of typical)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
