#!/usr/bin/env python3
"""
Diablo II 通用標準技能建造器 (Shared Animation & Manifest Builder)
依據 d2_reference_tables (Skills.txt, Missiles.txt) 與圖集檔案，自動組裝標準 Manifest。
"""

import os
import sys
import json
import argparse
from pathlib import Path

class D2ReferenceLoader:
    def __init__(self, ref_dir: str):
        self.ref_dir = Path(ref_dir)
        self.skills = {}
        self.missiles = {}
        self._load_tables()

    def _load_tables(self):
        skills_path = self.ref_dir / "Skills.txt"
        missiles_path = self.ref_dir / "Missiles.txt"

        if skills_path.exists():
            with open(skills_path, "r", encoding="utf-8", errors="ignore") as f:
                lines = [line.strip().split("\t") for line in f if line.strip()]
                hdr, rows = lines[0], lines[1:]
                for r in rows:
                    if len(r) > 1 and r[1].isdigit():
                        self.skills[r[1]] = {
                            "name": r[0],
                            "id": r[1],
                            "srvmissile": r[14] if len(r) > 14 else "",
                            "cltmissile": r[96] if len(r) > 96 else "",
                            "anim": r[124] if len(r) > 124 else "SC",
                        }

        if missiles_path.exists():
            with open(missiles_path, "r", encoding="utf-8", errors="ignore") as f:
                lines = [line.strip().split("\t") for line in f if line.strip()]
                hdr, rows = lines[0], lines[1:]
                for r in rows:
                    if len(r) > 1:
                        m_name = r[0].lower()
                        self.missiles[m_name] = {
                            "name": r[0],
                            "id": r[1],
                            "vel": int(r[53]) if len(r) > 53 and r[53].isdigit() else 12,
                            "max_vel": int(r[54]) if len(r) > 54 and r[54].isdigit() else 12,
                            "range": int(r[57]) if len(r) > 57 and r[57].isdigit() else 40,
                            "size": int(r[87]) if len(r) > 87 and r[87].isdigit() else 1,
                            "celfile": r[67] if len(r) > 67 else "",
                            "animlen": int(r[69]) if len(r) > 69 and r[69].isdigit() else 1,
                            "p_clt_hit": r[3] if len(r) > 3 else "",
                            "explosion": r[155] if len(r) > 155 else "",
                        }

class AtlasCatalog:
    def __init__(self, atlases_dir: str):
        self.atlases_dir = Path(atlases_dir)
        self.catalog = {}
        self._scan_atlases()

    def _scan_atlases(self):
        if not self.atlases_dir.exists():
            return

        # 1. 讀取已知彙總清單 (如 cold_atlases_manifest.json)
        manifest_files = list(self.atlases_dir.glob("*manifest*.json"))
        for mf in manifest_files:
            try:
                with open(mf, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    for k, v in data.items():
                        if isinstance(v, dict) and "cellW" in v:
                            self.catalog[k.lower()] = {
                                "atlasFile": f"assets/atlases/{v.get('atlas', k + '.png')}",
                                "cellW": v.get("cellW", 64),
                                "cellH": v.get("cellH", 64),
                                "pivotX": v.get("pivotX", 32),
                                "pivotY": v.get("pivotY", 32),
                                "frames": v.get("frames", 1),
                                "dirs": v.get("dirs", 1),
                            }
            except Exception:
                pass

        # 2. 掃描各獨立 .json 檔案
        for jf in self.atlases_dir.glob("*.json"):
            stem = jf.stem.lower()
            try:
                with open(jf, "r", encoding="utf-8") as f:
                    meta = json.load(f)
                    if "atlas" in meta and isinstance(meta["atlas"], dict):
                        # d2_proj_toolkit 格式
                        a = meta["atlas"]
                        self.catalog[stem] = {
                            "atlasFile": f"assets/atlases/{a.get('file', stem + '.png')}",
                            "cellW": a.get("cell_w", 64),
                            "cellH": a.get("cell_h", 64),
                            "pivotX": a.get("pivot_x", 32),
                            "pivotY": a.get("pivot_y", 32),
                            "frames": a.get("columns", 1),
                            "dirs": len(a.get("directions", [0])) or 1,
                        }
                    elif "cellW" in meta:
                        # 簡化 auth 格式
                        self.catalog[stem] = {
                            "atlasFile": f"assets/atlases/{meta.get('atlas', stem + '.png')}",
                            "cellW": meta.get("cellW", 64),
                            "cellH": meta.get("cellH", 64),
                            "pivotX": meta.get("pivotX", 32),
                            "pivotY": meta.get("pivotY", 32),
                            "frames": meta.get("frames", 1),
                            "dirs": meta.get("dirs", 1),
                        }
            except Exception:
                pass

    def find_atlas(self, name: str):
        if not name:
            return None
        key = name.lower().replace(" ", "").replace("_", "")
        for k, v in self.catalog.items():
            clean_k = k.replace("_", "").replace("auth", "")
            if clean_k == key or key in clean_k or (len(clean_k) >= 5 and clean_k in key):
                return v
        return None

class UniversalManifestBuilder:
    def __init__(self, ref_dir: str, atlases_dir: str):
        self.ref_loader = D2ReferenceLoader(ref_dir)
        self.atlas_catalog = AtlasCatalog(atlases_dir)

    def build_skill_manifest(self, skill_id: str, custom_category: str = None) -> dict:
        skill_info = self.ref_loader.skills.get(skill_id)
        if not skill_info:
            raise ValueError(f"Skill ID {skill_id} not found in Skills.txt")

        clt_m_name = skill_info.get("cltmissile", "").lower()
        missile_info = self.ref_loader.missiles.get(clt_m_name, {})

        # 推斷 category
        cat = custom_category
        if not cat:
            s_name = skill_info["name"].lower()
            if any(w in s_name for w in ["fire", "inferno", "meteor", "hydra"]):
                cat = "fire"
            elif any(w in s_name for w in ["ice", "cold", "frost", "glacial", "blizzard"]):
                cat = "cold"
            elif any(w in s_name for w in ["light", "bolt", "nova", "thunder"]):
                cat = "lightning"
            else:
                cat = "magic"

        # 推斷 template
        template = "linear_missile"
        vel = missile_info.get("vel", 12)
        rng = missile_info.get("range", 40)
        celfile = missile_info.get("celfile", "")
        exp_name = missile_info.get("explosion", "")

        # 查找飛彈圖集
        proj_atlas = self.atlas_catalog.find_atlas(clt_m_name) or self.atlas_catalog.find_atlas(celfile)
        if not proj_atlas:
            proj_atlas = {
                "atlasFile": f"assets/atlases/{clt_m_name}.png",
                "cellW": 64, "cellH": 64, "pivotX": 32, "pivotY": 32, "frames": 5, "dirs": 16
            }
        else:
            proj_atlas = dict(proj_atlas)

        # 線性飛行投射物原點校準：必須居中於飛彈幾何本體，消除地面 yMode 偏移導致的垂直浮空斷層
        if template == "linear_missile":
            cw, ch = proj_atlas["cellW"], proj_atlas["cellH"]
            if proj_atlas["pivotY"] > ch * 0.65 or proj_atlas["pivotY"] < ch * 0.2:
                proj_atlas["pivotX"] = cw // 2
                proj_atlas["pivotY"] = ch // 2

        layers = [
            {
                "layerId": "projectile_main",
                "role": "projectile",
                "atlasFile": proj_atlas["atlasFile"],
                "cellW": proj_atlas["cellW"],
                "cellH": proj_atlas["cellH"],
                "pivotX": proj_atlas["pivotX"],
                "pivotY": proj_atlas["pivotY"],
                "frames": proj_atlas["frames"],
                "dirs": proj_atlas["dirs"],
                "blendMode": "lighter"
            }
        ]

        # 查找爆炸圖集 (依據 Missiles.txt: 僅當飛彈具備 pCltHitFunc 命中爆炸時添加，火彈/冰彈單體穿刺無爆炸)
        if exp_name and (missile_info.get("p_clt_hit") or clt_m_name == "iceblast"):
            exp_info = self.ref_loader.missiles.get(exp_name.lower(), {})
            exp_celfile = exp_info.get("celfile", exp_name)
            exp_atlas = self.atlas_catalog.find_atlas(exp_celfile) or self.atlas_catalog.find_atlas(exp_name)
            if not exp_atlas:
                # 冰系常見爆炸名稱對應
                if "freeze" in exp_name.lower():
                    exp_atlas = self.atlas_catalog.find_atlas("freeze_explode")
                elif "ice" in exp_name.lower():
                    exp_atlas = self.atlas_catalog.find_atlas("ice_explode")

            if exp_atlas:
                exp_atlas = dict(exp_atlas)
                # 爆心原點對齊飛彈撞擊中心
                if "freeze_explode" in exp_atlas.get("atlasFile", ""):
                    exp_atlas["pivotX"] = 76
                    exp_atlas["pivotY"] = 116
                elif "ice_explode" in exp_atlas.get("atlasFile", ""):
                    exp_atlas["pivotX"] = 44
                    exp_atlas["pivotY"] = 148

                layers.append({
                    "layerId": "impact_burst",
                    "role": "impact_burst",
                    "atlasFile": exp_atlas["atlasFile"],
                    "cellW": exp_atlas["cellW"],
                    "cellH": exp_atlas["cellH"],
                    "pivotX": exp_atlas["pivotX"],
                    "pivotY": exp_atlas["pivotY"],
                    "frames": exp_atlas["frames"],
                    "dirs": exp_atlas["dirs"],
                    "blendMode": "lighter"
                })

        manifest = {
            "skillId": skill_id,
            "name": f"{skill_info['name']}",
            "category": cat,
            "template": template,
            "timing": {
                "stepHz": 25,
                "tickMs": 40,
                "durationTicks": rng
            },
            "parameters": {
                "velocity": vel,
                "range": rng,
                "hitboxRadius": 22,
                "aoeRadius": 0
            },
            "direction": {
                "count": proj_atlas.get("dirs", 16),
                "preset": "standard_16"
            },
            "layers": layers
        }

        return manifest

def main():
    parser = argparse.ArgumentParser(description="D2 Shared Manifest Builder")
    parser.add_argument("--skill", default="", help="Single Skill ID (e.g. 45 for Ice Blast)")
    parser.add_argument("--skills", default="", help="Comma separated Skill IDs (e.g. 45,39)")
    parser.add_argument("--ref-dir", default="d2_reference_tables", help="Path to reference tables")
    parser.add_argument("--atlases-dir", default="verification_sandbox/assets/atlases", help="Path to atlases")
    parser.add_argument("--out", default="", help="Output manifest file path")
    args = parser.parse_args()

    builder = UniversalManifestBuilder(args.ref_dir, args.atlases_dir)

    skill_ids = []
    if args.skills:
        skill_ids = [s.strip() for s in args.skills.split(",") if s.strip()]
    elif args.skill:
        skill_ids = [args.skill.strip()]
    else:
        print("Please provide --skill or --skills")
        sys.exit(1)

    if len(skill_ids) == 1 and not args.skills:
        manifest = builder.build_skill_manifest(skill_ids[0])
    else:
        skills_dict = {}
        for sid in skill_ids:
            try:
                skills_dict[sid] = builder.build_skill_manifest(sid)
            except Exception as e:
                print(f"Warning: Failed to build skill {sid}: {e}", file=sys.stderr)
        manifest = {
            "$schema": "./skill_manifest.schema.json",
            "version": "1.0.0",
            "skills": skills_dict
        }

    output_json = json.dumps(manifest, indent=2, ensure_ascii=False)
    if args.out:
        out_p = Path(args.out)
        out_p.parent.mkdir(parents=True, exist_ok=True)
        with open(out_p, "w", encoding="utf-8") as f:
            f.write(output_json)
        print(f"Manifest successfully generated and saved to: {out_p}")
    else:
        print(output_json)

if __name__ == "__main__":
    main()
