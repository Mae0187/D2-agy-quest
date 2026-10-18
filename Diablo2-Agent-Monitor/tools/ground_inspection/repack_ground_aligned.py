"""Re-align a sprite sheet so every direction's feet land on the anchor row.

    python tools/repack_ground_aligned.py --manifest M.json --root DIR
    python tools/repack_ground_aligned.py --manifest M.json --root DIR --apply

The manifests declare one `anchor_y` per action, shared by every direction. That
is only correct if the packer aligned the raster to it, and in this asset set it
did not: the same action's lowest opaque row varies by up to 17 pixels between
directions, so some facings sink and some float.

This fixes the raster rather than the number, because a single anchor cannot
describe a baseline that moves. For each direction it finds the lowest content
row across that row's frames and shifts the whole row so it lands on `anchor_y`.
Frames whose leg is lifted stay lifted relative to their own row, which is what
`規格文件.md` §67.3 asks for.

Only Y is touched. The horizontal placement is currently consistent and shifting
it would fix nothing.

Safety:
  - dry run unless `--apply` is passed
  - every modified file is copied to the backup directory first
  - a shift that would push content out of its cell is reported and the cell is
    left alone, because clipping is worse than misalignment
  - a direction needing an unusually large shift is flagged: it usually means
    the lowest pixel is a weapon tip rather than a foot, and aligning on it would
    lift the character off the ground
"""

from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path

import numpy as np
from PIL import Image

# A shift bigger than this is more likely to be a weapon than a baseline error.
SUSPICIOUS_SHIFT = 12

# Finding the ground contact from "the lowest opaque pixel" is wrong when the
# cell contains anything detached from the character. Two cases were measured on
# the barbarian: a 3-pixel dot ten rows below the feet, and a small object drawn
# beside the boots. Taking either as the contact would have lifted the character
# 9-14 pixels into the air, and the artwork that was already correct would have
# been broken by the fix.
#
# So the contact is the bottom of the **largest connected component** - the
# character itself - found by unioning runs that overlap between adjacent rows.
# scipy is not available here, so this is done directly; it is exact, and a
# 160x110 cell has only a few hundred runs.
def load_manifest(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    return json.loads(text[text.index("{"):text.rindex("}") + 1])


def row_runs(mask: np.ndarray) -> list[tuple[int, int]]:
    """Opaque runs in a boolean row, as (start, end_exclusive)."""
    out = []
    start = None
    for index, value in enumerate(mask):
        if value and start is None:
            start = index
        elif not value and start is not None:
            out.append((start, index))
            start = None
    if start is not None:
        out.append((start, len(mask)))
    return out


def largest_component_bottom(cell: np.ndarray) -> int | None:
    """Bottom row of the biggest connected blob in a cell."""
    alpha = cell[:, :, 3] > 0
    parent: dict[int, int] = {}
    spans: list[tuple[int, int, int, int]] = []   # run id -> (row, start, end, size)

    def find(a: int) -> int:
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    def union(a: int, b: int) -> None:
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[rb] = ra

    previous: list[int] = []
    for row in range(alpha.shape[0]):
        current = []
        for start, end in row_runs(alpha[row]):
            rid = len(spans)
            parent[rid] = rid
            spans.append((row, start, end, end - start))
            current.append(rid)
            # Anything in the row above that overlaps horizontally is the same blob.
            for other in previous:
                _r, ostart, oend, _s = spans[other]
                if ostart < end and start < oend:
                    union(rid, other)
        previous = current

    if not spans:
        return None

    # Total pixels per root, then the bottom row of the winning root.
    totals: dict[int, int] = {}
    for rid, (_row, _s, _e, size) in enumerate(spans):
        root = find(rid)
        totals[root] = totals.get(root, 0) + size
    winner = max(totals, key=lambda k: totals[k])

    bottom = None
    for rid, (row, _s, _e, _size) in enumerate(spans):
        if find(rid) == winner and (bottom is None or row > bottom):
            bottom = row
    return bottom


def analyse(sheet: np.ndarray, action: dict) -> dict:
    """Per direction: the deepest content row, and the frames that contribute."""
    cell_h, cell_w = action["cell_height"], action["cell_width"]
    bottoms = []
    for d in range(action["directions"]):
        rows = []
        for f in range(action["frames"]):
            cell = sheet[d * cell_h:(d + 1) * cell_h, f * cell_w:(f + 1) * cell_w]
            if cell.size == 0:
                continue
            low = largest_component_bottom(cell)
            if low is not None:
                rows.append(low)
        bottoms.append(max(rows) if rows else None)
    return {"bottoms": bottoms}


def shift_rows(sheet: np.ndarray, action: dict, shifts: list[int]) -> tuple[np.ndarray, list[str]]:
    """Return a new sheet with each direction row moved by its own shift."""
    cell_h, cell_w = action["cell_height"], action["cell_width"]
    out = np.zeros_like(sheet)
    notes = []
    for d in range(action["directions"]):
        dy = shifts[d]
        for f in range(action["frames"]):
            cell = sheet[d * cell_h:(d + 1) * cell_h, f * cell_w:(f + 1) * cell_w]
            if dy == 0:
                out[d * cell_h:(d + 1) * cell_h, f * cell_w:(f + 1) * cell_w] = cell
                continue
            moved = np.zeros_like(cell)
            if dy > 0:
                moved[dy:, :] = cell[:cell_h - dy, :]
            else:
                moved[:cell_h + dy, :] = cell[-dy:, :]
            # Refuse to clip: if content would leave the cell, keep the original.
            if dy > 0:
                lost = cell[cell_h - dy:, :, 3].sum()
            else:
                lost = cell[:-dy, :, 3].sum()
            if lost:
                notes.append(f"direction {d}: shift {dy:+d} would clip {int(lost)} alpha "
                             f"units, left unchanged")
                moved = cell
            out[d * cell_h:(d + 1) * cell_h, f * cell_w:(f + 1) * cell_w] = moved
    return out, notes


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--root", default=".")
    parser.add_argument("--apply", action="store_true",
                        help="write the changes; without this it is a dry run")
    parser.add_argument("--backup", default="assets/_anchor_backup")
    parser.add_argument("--skip", nargs="*", default=[],
                        help="action names to leave alone, e.g. an orphan asset")
    args = parser.parse_args()

    manifest_path = Path(args.manifest)
    manifest = load_manifest(manifest_path)
    root = Path(args.root)
    actions = manifest["actions"] if "actions" in manifest else \
        next(iter(manifest.values()))["actions"]
    label = manifest.get("character") or root.parent.name

    print(f"{label}   {'APPLY' if args.apply else 'dry run'}")
    print(f"  {'action':<14} {'anchor':>6} {'shifts (per direction)':<46} {'notes'}")

    total_changed = 0
    for name, action in actions.items():
        if name in args.skip:
            print(f"  {name:<14} {'-':>6} {'skipped'}")
            continue
        path = root / action["file"]
        if not path.exists():
            continue

        image = Image.open(path).convert("RGBA")
        sheet = np.asarray(image)
        info = analyse(sheet, action)
        ay = action["anchor_y"]

        shifts = []
        for bottom in info["bottoms"]:
            shifts.append(0 if bottom is None else ay - bottom)

        residual = [b + s for b, s in zip(info["bottoms"], shifts) if b is not None]
        spread = (max(residual) - min(residual)) if residual else 0
        suspicious = [i for i, s in enumerate(shifts) if abs(s) > SUSPICIOUS_SHIFT]

        note = ""
        if spread == 0 and all(s == 0 for s in shifts):
            note = "already aligned"
        elif suspicious:
            note = f"large shift on direction(s) {suspicious} - weapon tip, not a foot?"
        shown = ",".join(str(s) for s in shifts)
        if len(shown) > 44:
            shown = shown[:41] + "..."
        print(f"  {name:<14} {ay:>6} {shown:<46} {note}")

        if args.apply and any(s != 0 for s in shifts):
            backup = Path(args.backup) / root.name
            backup.mkdir(parents=True, exist_ok=True)
            shutil.copy2(path, backup / path.name)
            new_sheet, clip_notes = shift_rows(sheet, action, shifts)
            Image.fromarray(new_sheet).save(path)
            total_changed += 1
            for line in clip_notes:
                print(f"        {line}")

    if args.apply:
        print(f"\n  {total_changed} sheet(s) rewritten; originals in {args.backup}/")
    else:
        print(f"\n  dry run: nothing written. Add --apply to rewrite the sheets.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
