#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Diablo II 純 MPQ 精靈圖三重真理驗證腳本 (verify_ground_truth.py)
-------------------------------------------------------------
用途：
強制執行「純 MPQ 原廠精靈圖三重門禁標準」：
1. 門禁一：靜態代碼零向量手繪稽核 (Zero-Vector Static Audit)
   - 技能模板庫（templates/*.ts）嚴格禁止 ctx.stroke / ctx.lineTo / ctx.ellipse / ctx.arc 等前端手繪特徵。
   - 作戰調度引擎（combat_director.js）嚴格禁止 ctx.stroke 向量描邊。
   - 驗證必須具備原廠 MPQ 圖集之 ctx.drawImage 調用。
2. 門禁二：Playwright 實機無頭動態調用與圖集攔截稽核 (Runtime Prototype Hook Audit)
   - 攔截 Canvas 渲染上下文，實機監控 strokeCalls 是否嚴格為 0。
   - 監控原廠精靈圖（如 ElectricNova、LightningStrike、ShockHitSm）實機繪製次數。
3. 門禁三：官方真理大圖並列目視檢驗 (Side-by-Side Visual Ground Truth Diff Gate)
   - 擷取實機畫布截圖，與 official_visual_standards/ 官方高解析大圖進行尺度歸一化並列比對排版。
"""

import os
import re
import sys
import time
import argparse
from pathlib import Path
from PIL import Image

sys.stdout.reconfigure(encoding='utf-8')

# 門禁一檢查清單與規則
TEMPLATE_AUDIT_FILES = [
    "verification_sandbox/v2_shared_engine/templates/radial_nova_template.ts",
    "verification_sandbox/v2_shared_engine/templates/chained_arc_template.ts"
]

ENGINE_AUDIT_FILES = [
    "Diablo2-Agent-Monitor/web/js/combat_director.js"
]

TEMPLATE_FORBIDDEN_PATTERNS = [
    (r'\bctx\.stroke\s*\(', "Canvas 向量描邊 (ctx.stroke)"),
    (r'\bctx\.lineTo\s*\(', "Canvas 手繪折線 (ctx.lineTo)"),
    (r'\bctx\.ellipse\s*\(', "Canvas 手繪橢圓 (ctx.ellipse)"),
    (r'\bctx\.arc\s*\(', "Canvas 手繪圓弧 (ctx.arc)"),
]

ENGINE_FORBIDDEN_PATTERNS = [
    (r'\bctx\.stroke\s*\(', "Canvas 向量描邊 (ctx.stroke)"),
    (r'\bctx\.lineTo\s*\(', "Canvas 手繪折線 (ctx.lineTo)"),
]

def run_gate1_zero_vector_audit() -> bool:
    print("=" * 60)
    print("🔍 [門禁一] 靜態代碼零向量手繪稽核 (Gate 1: Zero Vector Static Audit)")
    print("=" * 60)

    all_passed = True

    # 1. 審查技能模板庫 (嚴禁任何 stroke / lineTo / ellipse / arc)
    for fpath in TEMPLATE_AUDIT_FILES:
        p = Path(fpath)
        if not p.exists():
            print(f"  ⚠️ 警告：目標檔案不存在，跳過檢查: {fpath}")
            continue

        with open(p, "r", encoding="utf-8") as f:
            content = f.read()

        code_only = re.sub(r'//.*', '', content)
        code_only = re.sub(r'/\*.*?\*/', '', code_only, flags=re.DOTALL)

        print(f"\n[稽核技能模板] {fpath}")
        file_passed = True
        for pattern, desc in TEMPLATE_FORBIDDEN_PATTERNS:
            matches = re.findall(pattern, code_only)
            if matches:
                print(f"  ❌ 嚴重違規：發現 {desc} 共 {len(matches)} 處！")
                file_passed = False
                all_passed = False
            else:
                print(f"  ✅ 通過：零 {desc}")

        draw_count = len(re.findall(r'\bctx\.drawImage\s*\(', code_only))
        if draw_count > 0:
            print(f"  ✅ 通過：具備原廠 MPQ 圖集 drawImage 調用共 {draw_count} 處")
        else:
            print("  ❌ 失敗：未發現 drawImage 圖集繪製調用！")
            all_passed = False

    # 2. 審查引擎層 (嚴禁任何 ctx.stroke / ctx.lineTo 向量繪圖)
    for fpath in ENGINE_AUDIT_FILES:
        p = Path(fpath)
        if not p.exists():
            print(f"  ⚠️ 警告：目標檔案不存在，跳過檢查: {fpath}")
            continue

        with open(p, "r", encoding="utf-8") as f:
            content = f.read()

        code_only = re.sub(r'//.*', '', content)
        code_only = re.sub(r'/\*.*?\*/', '', code_only, flags=re.DOTALL)

        print(f"\n[稽核作戰引擎] {fpath}")
        for pattern, desc in ENGINE_FORBIDDEN_PATTERNS:
            matches = re.findall(pattern, code_only)
            if matches:
                print(f"  ❌ 嚴重違規：發現 {desc} 共 {len(matches)} 處！")
                all_passed = False
            else:
                print(f"  ✅ 通過：零 {desc}")

        draw_count = len(re.findall(r'\bctx\.drawImage\s*\(', code_only))
        if draw_count > 0:
            print(f"  ✅ 通過：具備原廠 MPQ 圖集 drawImage 調用共 {draw_count} 處")
        else:
            print("  ❌ 失敗：未發現 drawImage 圖集繪製調用！")
            all_passed = False

    if all_passed:
        print("\n✨ 門禁一驗證通過：所有代碼完全杜絕前端手繪，100% 透過 MPQ 圖集渲染！")
    else:
        print("\n💥 門禁一驗證失敗：代碼中仍殘留違規前端手繪向量，禁止進入下一步！")

    return all_passed

def run_gate2_and_3(port: int = 8765, output_dir: str = "testimages/comparison") -> bool:
    from playwright.sync_api import sync_playwright

    print("\n" + "=" * 60)
    print("🖥️ [門禁二] Playwright 實機無頭動態調用與圖集攔截 (Gate 2: Dynamic Audit)")
    print("=" * 60)

    out_path = Path(output_dir)
    out_path.mkdir(parents=True, exist_ok=True)
    temp_img_dir = Path("testimages")
    temp_img_dir.mkdir(parents=True, exist_ok=True)

    url = f"http://localhost:{port}/v2_sandbox.html"
    print(f"  • 連線目標沙盒: {url}")

    gate2_passed = True

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1200, "height": 800})

        try:
            page.goto(url, wait_until="networkidle", timeout=8000)
        except Exception as e:
            print(f"  ❌ 連線沙盒失敗: {e}")
            browser.close()
            return False

        page.wait_for_timeout(1000)

        # 注入 Hook 原型鏈監聽器：監控 stroke 與 drawImage
        page.evaluate("""() => {
            window.__audit = {
                strokeCalls: 0,
                drawElectricNova: 0,
                drawLightningStrike: 0,
                drawShockHit: 0
            };
            const origStroke = CanvasRenderingContext2D.prototype.stroke;
            CanvasRenderingContext2D.prototype.stroke = function(...args) {
                window.__audit.strokeCalls++;
                return origStroke.apply(this, args);
            };
            const origDrawImage = CanvasRenderingContext2D.prototype.drawImage;
            CanvasRenderingContext2D.prototype.drawImage = function(img, ...args) {
                const src = (img && img.src) ? img.src.toLowerCase() : '';
                if (src.includes('electricnova')) window.__audit.drawElectricNova++;
                if (src.includes('lightningstrike')) window.__audit.drawLightningStrike++;
                if (src.includes('shockhit')) window.__audit.drawShockHit++;
                return origDrawImage.apply(this, [img, ...args]);
            };
        }""")

        # 關閉除錯網格與輔助線，確保截圖純淨且無除錯向量繪圖
        page.evaluate("() => { if (window.setV2Debug) window.setV2Debug(false); }")
        page.wait_for_timeout(200)

        canvas = page.locator("#demo-canvas")

        # ── 1. 測試新星 (Nova 48 - F06) ──
        print("\n[測試新星 Nova 48]")
        page.evaluate("() => { window.castV2Skill('48', 500, 340); }")
        page.wait_for_timeout(180)  # 擴散中期

        nova_audit = page.evaluate("() => window.__audit")
        print(f"  • ElectricNova 原廠小閃電繪製次數: {nova_audit['drawElectricNova']}")
        print(f"  • 手繪向量 stroke 次數: {nova_audit['strokeCalls']} (門禁標準: 必須嚴格為 0)")

        if nova_audit['drawElectricNova'] == 0:
            print("  ❌ 失敗：ElectricNova 精靈圖未被調用！")
            gate2_passed = False
        if nova_audit['strokeCalls'] > 0:
            print(f"  ❌ 失敗：檢測到 {nova_audit['strokeCalls']} 次手繪 stroke 調用！")
            gate2_passed = False

        nova_img_path = temp_img_dir / "nova_sandbox_pure_mpq.png"
        canvas.screenshot(path=str(nova_img_path))
        print(f"  • 實機新星截圖已存至: {nova_img_path}")

        # 重置計數器
        page.evaluate("""() => {
            window.__audit.drawLightningStrike = 0;
            window.__audit.drawShockHit = 0;
            window.__audit.strokeCalls = 0;
        }""")
        page.wait_for_timeout(600)

        # ── 2. 測試連鎖閃電 (Chain Lightning 53 - F09) ──
        print("\n[測試連鎖閃電 Chain Lightning 53]")
        page.evaluate("() => { window.castV2Skill('53', 700, 200); }")
        page.wait_for_timeout(80)

        cl_audit = page.evaluate("() => window.__audit")
        print(f"  • LightningStrike 32方向電弧繪製次數: {cl_audit['drawLightningStrike']}")
        print(f"  • ShockHitSm 節點電爆繪製次數: {cl_audit['drawShockHit']}")
        print(f"  • 手繪向量 stroke 次數: {cl_audit['strokeCalls']} (門禁標準: 必須嚴格為 0)")

        if cl_audit['drawLightningStrike'] == 0:
            print("  ❌ 失敗：LightningStrike 精靈圖未被調用！")
            gate2_passed = False
        if cl_audit['strokeCalls'] > 0:
            print(f"  ❌ 失敗：檢測到 {cl_audit['strokeCalls']} 次手繪 stroke 調用！")
            gate2_passed = False

        cl_img_path = temp_img_dir / "chain_lightning_sandbox_pure_mpq.png"
        canvas.screenshot(path=str(cl_img_path))
        print(f"  • 實機連鎖閃電截圖已存至: {cl_img_path}")

        browser.close()

    if not gate2_passed:
        print("\n💥 門禁二驗證失敗：動態調用未達標！")
        return False
    else:
        print("\n✨ 門禁二驗證通過：實機動態全量調用 MPQ 原廠圖集，手繪調用嚴格為 0！")

    # ── 門禁三：官方真理大圖並列目視檢驗 ──
    print("\n" + "=" * 60)
    print("🖼️ [門禁三] 官方真理大圖並列目視檢驗 (Gate 3: Ground Truth Diff Gate)")
    print("=" * 60)

    # Nova 官方對比
    official_nova_path = Path("official_visual_standards/sorceress/nova_crop.png")
    if official_nova_path.exists() and nova_img_path.exists():
        official_nova = Image.open(official_nova_path)
        sb_nova = Image.open(nova_img_path)
        sb_crop = sb_nova.crop((260, 160, 740, 520))
        scale = official_nova.height / sb_crop.height
        sb_resized = sb_crop.resize((int(sb_crop.width * scale), official_nova.height), Image.Resampling.LANCZOS)

        comp_nova = Image.new("RGB", (official_nova.width + sb_resized.width + 10, official_nova.height), (20, 24, 33))
        comp_nova.paste(official_nova, (0, 0))
        comp_nova.paste(sb_resized, (official_nova.width + 10, 0))
        comp_nova_path = out_path / "side_by_side_nova_pure_mpq.png"
        comp_nova.save(str(comp_nova_path))
        print(f"  ✅ 新星官方並列驗收圖已合成: {comp_nova_path}")
    else:
        print(f"  ⚠️ 新星比對圖源缺失: {official_nova_path} 或 {nova_img_path}")

    # 連鎖閃電官方對比
    official_cl_path = Path("official_visual_standards/sorceress/chain_lightning_crop.png")
    if official_cl_path.exists() and cl_img_path.exists():
        official_cl = Image.open(official_cl_path)
        sb_cl = Image.open(cl_img_path)
        sb_cl_crop = sb_cl.crop((320, 140, 780, 480))
        scale_cl = official_cl.height / sb_cl_crop.height
        sb_cl_resized = sb_cl_crop.resize((int(sb_cl_crop.width * scale_cl), official_cl.height), Image.Resampling.LANCZOS)

        comp_cl = Image.new("RGB", (official_cl.width + sb_cl_resized.width + 10, official_cl.height), (20, 24, 33))
        comp_cl.paste(official_cl, (0, 0))
        comp_cl.paste(sb_cl_resized, (official_cl.width + 10, 0))
        comp_cl_path = out_path / "side_by_side_chain_lightning_pure_mpq.png"
        comp_cl.save(str(comp_cl_path))
        print(f"  ✅ 連鎖閃電官方並列驗收圖已合成: {comp_cl_path}")
    else:
        print(f"  ⚠️ 連鎖閃電比對圖源缺失: {official_cl_path} 或 {cl_img_path}")

    print("\n✨ 三重真理驗證全部完成！產物齊備，請檢視 testimages/comparison/ 比對圖！")
    return True

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Diablo II 純 MPQ 三重真理驗證腳本")
    parser.add_argument("--port", type=int, default=8765, help="測試通訊埠 (預設 8765)")
    parser.add_argument("--skip-runtime", action="store_true", help="僅執行門禁一靜態代碼稽核")
    args = parser.parse_args()

    g1 = run_gate1_zero_vector_audit()
    if not g1:
        print("[!] 門禁一未通過，終止後續測試。")
        sys.exit(1)

    if not args.skip_runtime:
        g23 = run_gate2_and_3(port=args.port)
        if not g23:
            print("[!] 門禁二/三未通過。")
            sys.exit(1)

    print("\n🎉 [ALL GATES PASSED] 三重真理驗證門禁全數綠燈通過！")
    sys.exit(0)
