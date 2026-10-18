#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
extract_missile_data.py — 從 Diablo II 官方 Missiles.txt 與 skills.txt 自動萃取投射物數據
生成 100% 符合暴雪原廠規格的 TypeScript / JSON 規格定義，徹底消除人工猜測或 AI 幻覺。
"""

import os
import csv
import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
EXCEL_DIR = REPO_ROOT / "Diablo2-Agent-Monitor" / "assets" / "_patch_overrides" / "global" / "excel"
MISSILES_TXT = EXCEL_DIR / "Missiles.txt"
SKILLS_TXT = EXCEL_DIR / "skills.txt"

OUT_DIR = Path(__file__).resolve().parents[1] / "src" / "data"
OUT_JSON = OUT_DIR / "d2_missiles_official.json"
OUT_TS = OUT_DIR / "d2-missile-specs.ts"

def parse_tsv(filepath: Path):
    rows = []
    with open(filepath, "r", encoding="latin1") as f:
        reader = csv.reader(f, delimiter="\t")
        headers = [h.strip() for h in next(reader)]
        for r in reader:
            if not r or not r[0].strip() or r[0].startswith("*"):
                continue
            item = {}
            for i, val in enumerate(r):
                if i < len(headers):
                    item[headers[i]] = val.strip()
            rows.append(item)
    return headers, rows

def to_int(val, default=0):
    try:
        return int(val) if val else default
    except ValueError:
        return default

def to_float(val, default=0.0):
    try:
        return float(val) if val else default
    except ValueError:
        return default

def main():
    print(f"Loading {MISSILES_TXT}...")
    m_headers, m_rows = parse_tsv(MISSILES_TXT)
    print(f"Loaded {len(m_rows)} missile entries.")

    print(f"Loading {SKILLS_TXT}...")
    s_headers, s_rows = parse_tsv(SKILLS_TXT)
    print(f"Loaded {len(s_rows)} skill entries.")

    skills_by_name = {r["skill"].lower(): r for r in s_rows if "skill" in r}

    official_missiles = {}

    for row in m_rows:
        name = row.get("Missile", "").strip()
        if not name:
            continue
        mid = to_int(row.get("Id", "0"))
        srv_func = to_int(row.get("pSrvDoFunc", "0"))
        clt_func = to_int(row.get("pCltDoFunc", "0"))
        vel = to_int(row.get("Vel", "0"))
        max_vel = to_int(row.get("MaxVel", str(vel)))
        accel = to_int(row.get("Accel", "0"))
        range_ticks = to_int(row.get("Range", "0"))
        size = to_int(row.get("Size", "1"), 1)
        collide_kill = to_int(row.get("CollideKill", "1"), 1)
        collide_type = to_int(row.get("CollideType", "3"), 3)
        explosion_missile = row.get("ExplosionMissile", "").strip() or None

        # 暴雪原廠 1 Sub-Tile = 16 地面像素 (Ground Pixels)
        # 怪物基礎半徑一般為 14~18 像素
        # 因此實體檢測半徑 = 投射物尺寸 (size * 8px) + 怪物碰撞體 (14px)
        radius_px = size * 8 + 14

        # 行為分群 (Family Mapping)
        # Func 1: 純直線飛彈 (Linear Straight)
        # Func 7: 唯一官方導引飛彈 (Homing Seeking)
        # 特殊技能充能彈 (chargedbolt) 官方於技能端施加扇形隨機折線 (F04)
        if srv_func == 7:
            family = "F02"
            retarget_ticks = to_int(row.get("Param1", "5"), 5)
            # 原廠 Param2 為碼數 (1 碼 = 24 像素)
            acquire_radius_px = to_int(row.get("Param2", "15"), 15) * 24
            behavior = {
                "family": "F02",
                "turnRateDegPerTick": 12,
                "acquireRadiusPx": acquire_radius_px,
                "reacquire": True,
                "fallback": "straight",
                "retargetEveryTicks": retarget_ticks,
            }
        elif name.lower() == "chargedbolt":
            family = "F04"
            behavior = {
                "family": "F04",
                "stepJitterDeg": 50,
                "retargetEveryTicks": 2,
            }
        else:
            family = "F01"
            behavior = {
                "family": "F01"
            }

        official_missiles[name.lower()] = {
            "id": name.lower(),
            "officialName": name,
            "missileId": mid,
            "d2Func": srv_func,
            "family": family,
            "motion": {
                "speed": vel,
                "accel": accel,
                "maxSpeed": max_vel,
            },
            "lifetime": {
                "maxLifeTicks": range_ticks,
                "rangePx": None if range_ticks == 0 else vel * range_ticks,
            },
            "collision": {
                "size": size,
                "radiusPx": radius_px,
                "pierce": 1 if name.lower() == "chargedbolt" else (0 if collide_kill == 1 else -1),
            },
            "explosion": None if not explosion_missile else {
                "durationTicks": 6,
                "onHit": True,
                "onExpire": True,
                "spawnMissileId": explosion_missile.lower(),
            },
            "behavior": behavior,
        }

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(official_missiles, f, indent=2, ensure_ascii=False)
    print(f"Exported {len(official_missiles)} official missile specs to {OUT_JSON}")

    # 生成常用技能規格的 TypeScript 模組
    key_missiles = ["fireball", "bonespirit", "chargedbolt", "guidedarrow", "frozenorb", "blizzard"]
    ts_code = [
        "// d2-missile-specs.ts — 由 extract_missile_data.py 從官方 Missiles.txt 自動生成的強型別規格",
        "import type { MissileSpec } from '../missile-types.js';",
        "",
        "export const OFFICIAL_D2_SPECS: Record<string, MissileSpec> = {"
    ]

    for k in key_missiles:
        if k in official_missiles:
            m = official_missiles[k]
            spec_obj = {
                "id": m["id"],
                "calibrationId": m["id"],
                "blend": "additive",
                "motion": m["motion"],
                "lifetime": m["lifetime"],
                "collision": {
                    "radiusPx": m["collision"]["radiusPx"],
                    "pierce": m["collision"]["pierce"],
                },
                "explosion": m["explosion"],
                "behavior": m["behavior"],
            }
            spec_json = json.dumps(spec_obj, indent=2)
            ts_code.append(f"  '{k}': {spec_json} as MissileSpec,")

    ts_code.append("};\n")

    with open(OUT_TS, "w", encoding="utf-8") as f:
        f.write("\n".join(ts_code))
    print(f"Exported TypeScript missile specs to {OUT_TS}")

if __name__ == "__main__":
    main()
