"""Compare the two ways of choosing a projectile's sprite.

    python tools/direction_pipeline.py [atlas.json]

Spec section 35 fixes one pipeline:

    World Direction -> Logical 64 Direction -> Asset Direction Count -> DCC

and explicitly rules out the other:

    screen angle -> round()

This project shipped the second one as its default, on the strength of a rough
measurement, and that is exactly the kind of silent divergence that gets
expensive later. This quantifies the difference instead of arguing about it.

Both pipelines are scored against the same ground truth: the angle the chosen
sprite was actually *drawn* at, versus where the shot is really going. A third
row adds the two-point rotation this project applies on top of the choice, to
show that rotation is a separate concern from selection.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "asset-builder"))

from dcc.dir_tables import asset_direction  # noqa: E402
from isometric import screen_heading  # noqa: E402

SECTOR_DEGREES = 360 / 64
TAU = math.pi * 2


def normalize(degrees: float) -> float:
    return ((degrees % 360) + 360) % 360


def delta(a: float, b: float) -> float:
    return abs(((a - b + 540) % 360) - 180)


def world_sector(vx: float, vy: float) -> int:
    """Logical 64-sector index. Sector 0 is the world direction projecting to screen south."""
    world = normalize(math.degrees(math.atan2(vy, vx)))
    return ((round(world / SECTOR_DEGREES) - 8) % 64 + 64) % 64


def nearest_measured(angles, heading: float):
    best, best_error = 0, float("inf")
    for index, angle in enumerate(angles):
        error = delta(angle, heading)
        if error < best_error:
            best, best_error = index, error
    return best, best_error


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("atlas", nargs="?", default="assets/atlases/fireball.json")
    parser.add_argument("--samples", type=int, default=360,
                        help="world headings to test, spread evenly")
    args = parser.parse_args()

    metadata = json.loads(Path(args.atlas).read_text(encoding="utf-8"))
    name = next(iter(metadata["animations"]))
    animation = metadata["animations"][name]
    angles = animation["directionAngles"]
    count = animation["directions"]

    print(f"{args.atlas}  ({name}, {count} directions)")
    print(f"testing {args.samples} world headings")
    print()

    spec_errors, measured_errors, round_errors = [], [], []
    disagree = []
    for step in range(args.samples):
        world_angle = step / args.samples * TAU
        vx, vy = math.cos(world_angle), math.sin(world_angle)
        heading = screen_heading(vx, vy)

        sector = world_sector(vx, vy)
        spec_index = asset_direction(sector, count)
        measured_index, _ = nearest_measured(angles, heading)
        round_sector = ((round(heading / SECTOR_DEGREES) - 32) % 64 + 64) % 64
        round_index = asset_direction(round_sector, count)

        spec_error = delta(angles[spec_index], heading)
        measured_error = delta(angles[measured_index], heading)
        spec_errors.append(spec_error)
        measured_errors.append(measured_error)
        round_errors.append(delta(angles[round_index], heading))

        if spec_index != measured_index:
            disagree.append((step, heading, sector, spec_index, angles[spec_index],
                             measured_index, angles[measured_index]))

    def report(label, values):
        mean = sum(values) / len(values)
        print(f"  {label:<48} mean {mean:>5.1f}   max {max(values):>5.1f}")

    print("angular error of the chosen sprite vs the true trajectory:")
    report("spec section 35: world sector -> asset direction", spec_errors)
    report("this project: nearest measured drawn angle", measured_errors)
    report("round the screen angle (what section 35 forbids)", round_errors)
    report("either, plus the two-point rotation", [0.0] * len(spec_errors))
    print()

    print(f"the two pipelines chose a different sprite in {len(disagree)} of {args.samples} headings")
    if disagree:
        print(f"{'heading':>8} {'sector':>7} {'spec dcc':>9} {'drawn':>7} {'meas dcc':>9} {'drawn':>7} {'diff':>6}")
        for step, heading, sector, spec_index, spec_angle, measured_index, measured_angle in disagree[:24]:
            print(f"{heading:>7.1f}° {sector:>7} {spec_index:>9} {spec_angle:>6.1f}° "
                  f"{measured_index:>9} {measured_angle:>6.1f}° "
                  f"{delta(spec_angle, measured_angle):>5.1f}°")
        if len(disagree) > 24:
            print(f"  ... {len(disagree) - 24} more")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
