"""
全專案動畫像素接地與抖動全量審計工具 (Animation Ground Audit Pipeline)
針對七大職業與所有召喚夥伴進行：
1. 腳掌接地線檢驗 (Alpha > 200 排除陰影)
2. 垂直晃動幅度測量 (Jitter / Spread: 檢測是否一跳一跳)
3. 浮空檢驗 (Floating: 檢測是否雙腳離地)
4. 動作切換中心漂移 (Centering Shift)
"""

import os
import sys
import json
import re
from pathlib import Path
import numpy as np
from PIL import Image

sys.stdout.reconfigure(encoding='utf-8')

ROOT = Path("Diablo2-Agent-Monitor/web")

def get_solid_bottom(cell, threshold=200):
    alpha = cell[:, :, 3]
    mask = alpha >= threshold
    if not mask.any():
        # 如果沒有 > 200，降到 100
        mask = alpha >= 100
        if not mask.any():
            return None
    rows = np.where(mask)[0]
    return int(rows.max())

def audit_action(img_path, cw, ch, dirs, frames, anchor_x, anchor_y):
    if not img_path.exists():
        return {"error": f"File not found: {img_path}"}
    
    img = Image.open(img_path).convert("RGBA")
    arr = np.array(img)
    
    dir_bottoms = []
    dir_spreads = []
    all_bottoms = []
    
    for d in range(dirs):
        frame_bottoms = []
        for f in range(frames):
            sy = d * ch
            sx = f * cw
            cell = arr[sy:sy+ch, sx:sx+cw]
            b = get_solid_bottom(cell)
            if b is not None:
                frame_bottoms.append(b)
                all_bottoms.append(b)
        if frame_bottoms:
            dir_bottoms.append(np.mean(frame_bottoms))
            dir_spreads.append(max(frame_bottoms) - min(frame_bottoms))
        else:
            dir_bottoms.append(ch - 1)
            dir_spreads.append(0)
            
    avg_bottom = float(np.mean(dir_bottoms))
    max_jitter = int(max(dir_spreads)) if dir_spreads else 0
    dir_drift = float(max(dir_bottoms) - min(dir_bottoms)) if dir_bottoms else 0
    
    # 接地偏差 (相對於 anchor_y)
    # 若腳底 bottom - anchor_y > 2: 沉入地底
    # 若腳底 bottom - anchor_y < -2: 浮空！
    offset_to_anchor = avg_bottom - anchor_y
    
    status = "OK"
    issues = []
    if offset_to_anchor < -2:
        status = "WARN"
        issues.append(f"浮空 {abs(offset_to_anchor):.1f}px")
    elif offset_to_anchor > 4:
        status = "WARN"
        issues.append(f"沉地 {offset_to_anchor:.1f}px")
        
    if max_jitter >= 8:
        status = "WARN"
        issues.append(f"單方向影格晃動大({max_jitter}px，會有一跳一跳感)")
    if dir_drift >= 10:
        status = "WARN"
        issues.append(f"方向間高低差大({dir_drift:.1f}px，轉向會跳動)")
        
    return {
        "status": status,
        "avg_bottom": round(avg_bottom, 1),
        "anchor_y": anchor_y,
        "offset": round(offset_to_anchor, 1),
        "max_jitter": max_jitter,
        "dir_drift": round(dir_drift, 1),
        "issues": issues
    }

def parse_js_manifest(p):
    text = p.read_text(encoding="utf-8")
    m = re.search(r'=\s*(\{[\s\S]*\});?\s*$', text)
    if not m:
        return None
    try:
        # 將 js 簡化 json 解析
        clean = m.group(1)
        # 去除結尾分號
        clean = clean.strip()
        if clean.endswith(';'): clean = clean[:-1]
        return json.loads(clean)
    except Exception as e:
        # 用正則抓取 actions
        return None

def main():
    print("================================================================================")
    print("🚀 暗黑破壞神 2 全專案動畫像素接地與抖動深度審計 (Full Ground & Jitter Audit)")
    print("================================================================================\n")
    
    results = {}
    
    # 1. 審計召喚夥伴 (Companions)
    comp_file = ROOT / "assets/companions/companions_manifest.json"
    comp_data = json.loads(comp_file.read_text(encoding="utf-8"))
    
    print("【召喚夥伴大軍 (Companions)】")
    for comp_key, comp_info in comp_data.items():
        name = comp_info.get("name", comp_key)
        actions = comp_info.get("actions", {})
        print(f"\n🐾 {name} ({comp_key}):")
        results[comp_key] = {}
        for act_name, act_cfg in actions.items():
            img_path = ROOT / act_cfg["file"]
            res = audit_action(
                img_path,
                act_cfg["cell_width"],
                act_cfg["cell_height"],
                act_cfg["directions"],
                act_cfg["frames"],
                act_cfg["anchor_x"],
                act_cfg["anchor_y"]
            )
            results[comp_key][act_name] = res
            flag = "✅" if res.get("status") == "OK" else "⚠️"
            issues_str = f" -> {', '.join(res['issues'])}" if res.get("issues") else ""
            print(f"  {flag} [{act_name:<7}] anchor_y={act_cfg['anchor_y']:<3} 實測腳底={res.get('avg_bottom',0):<5} 偏移={res.get('offset',0):+4.1f}px 晃動={res.get('max_jitter',0)}px 轉向差={res.get('dir_drift',0):<4.1f}px{issues_str}")

    # 2. 審計英雄 (Heroes) - 聚焦各職業三種裝甲
    heroes = ['necromancer', 'amazon', 'assassin', 'barbarian', 'druid', 'paladin', 'sorceress']
    tiers = ['light', 'medium', 'heavy']
    
    print("\n\n【七大職業出征英雄 (Heroes)】")
    for hero in heroes:
        print(f"\n⚔️ 職業：{hero.upper()}")
        for tier in tiers:
            manifest_path = ROOT / f"assets/characters/{hero}/{tier}/manifest.js"
            if not manifest_path.exists():
                manifest_path = ROOT / f"assets/characters/{hero}/manifest.js"
            if not manifest_path.exists():
                continue
            
            try:
                text = manifest_path.read_text(encoding="utf-8")
                manifest_dict = json.loads(text[text.index("{"):text.rindex("}") + 1])
                actions_dict = manifest_dict.get("actions", {})
            except Exception as e:
                continue
                
            print(f"  形態：{tier}")
            hero_key = f"{hero}_{tier}"
            results[hero_key] = {}
            for act_name, act_cfg in actions_dict.items():
                fname = act_cfg.get("file", f"{hero}_{act_name}.png")
                p1 = ROOT / f"assets/characters/{hero}/{tier}/{fname}"
                p2 = ROOT / f"assets/characters/{hero}/{fname}"
                real_p = p1 if p1.exists() else p2
                
                res = audit_action(
                    real_p,
                    act_cfg["cell_width"],
                    act_cfg["cell_height"],
                    act_cfg.get("directions", 16),
                    act_cfg.get("frames", 8),
                    act_cfg.get("anchor_x", 45),
                    act_cfg.get("anchor_y", 80)
                )
                results[hero_key][act_name] = res
                flag = "✅" if res.get("status") == "OK" else "⚠️"
                issues_str = f" -> {', '.join(res['issues'])}" if res.get("issues") else ""
                print(f"    {flag} [{act_name:<7}] anchor_y={act_cfg['anchor_y']:<3} 實測腳底={res.get('avg_bottom',0):<5} 偏移={res.get('offset',0):+4.1f}px 晃動={res.get('max_jitter',0)}px 轉向差={res.get('dir_drift',0):<4.1f}px{issues_str}")

    # 輸出完整 JSON 報告
    report_path = Path("animation_audit_summary.json")
    report_path.write_text(json.dumps(results, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\n📄 完整審計數據已保存至: {report_path.resolve()}")

if __name__ == "__main__":
    main()
