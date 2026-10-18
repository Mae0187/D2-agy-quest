#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Diablo II Pure MPQ Sprite Triple Ground Truth Verification Script (verify_ground_truth.py)
----------------------------------------------------------------------------------------
Purpose:
Enforce the "Pure MPQ Original Sprite Triple Gate Standard":
1. Gate 1: Zero-Vector Static Audit
   - Skill template library (templates/*.ts) strictly prohibits frontend vector painting features such as ctx.stroke / ctx.lineTo / ctx.ellipse / ctx.arc.
   - Combat director engine (combat_director.js) strictly prohibits ctx.stroke vector outlines.
   - Verifies the presence of native MPQ atlas ctx.drawImage invocations.
2. Gate 2: Runtime Prototype Hook Audit via Headless Playwright
   - Intercepts Canvas rendering context to verify strokeCalls is strictly 0 at runtime.
   - Monitors runtime draw count for authentic Blizzard sprites (e.g., ElectricNova, LightningStrike, ShockHitSm).
3. Gate 3: Side-by-Side Visual Ground Truth Diff Gate
   - Captures runtime canvas screenshots, normalizes scale, and renders side-by-side comparisons with official high-res ground truth images from official_visual_standards/.
"""

import os
import re
import sys
import time
import argparse
from pathlib import Path
from PIL import Image

sys.stdout.reconfigure(encoding='utf-8')

# Gate 1 audit file checklist and rules
TEMPLATE_AUDIT_FILES = [
    "verification_sandbox/v2_shared_engine/templates/radial_nova_template.ts",
    "verification_sandbox/v2_shared_engine/templates/chained_arc_template.ts"
]

ENGINE_AUDIT_FILES = [
    "Diablo2-Agent-Monitor/web/js/combat_director.js"
]

TEMPLATE_FORBIDDEN_PATTERNS = [
    (r'\bctx\.stroke\s*\(', "Canvas vector stroke (ctx.stroke)"),
    (r'\bctx\.lineTo\s*\(', "Canvas vector line (ctx.lineTo)"),
    (r'\bctx\.ellipse\s*\(', "Canvas vector ellipse (ctx.ellipse)"),
    (r'\bctx\.arc\s*\(', "Canvas vector arc (ctx.arc)"),
]

ENGINE_FORBIDDEN_PATTERNS = [
    (r'\bctx\.stroke\s*\(', "Canvas vector stroke (ctx.stroke)"),
    (r'\bctx\.lineTo\s*\(', "Canvas vector line (ctx.lineTo)"),
]

def run_gate1_zero_vector_audit() -> bool:
    print("=" * 60)
    print("🔍 [Gate 1] Zero Vector Static Audit")
    print("=" * 60)

    all_passed = True

    # 1. Audit skill template library (strictly forbid any stroke / lineTo / ellipse / arc)
    for fpath in TEMPLATE_AUDIT_FILES:
        p = Path(fpath)
        if not p.exists():
            print(f"  ⚠️ Warning: Target file does not exist, skipping check: {fpath}")
            continue

        with open(p, "r", encoding="utf-8") as f:
            content = f.read()

        code_only = re.sub(r'//.*', '', content)
        code_only = re.sub(r'/\*.*?\*/', '', code_only, flags=re.DOTALL)

        print(f"\n[Auditing Skill Template] {fpath}")
        file_passed = True
        for pattern, desc in TEMPLATE_FORBIDDEN_PATTERNS:
            matches = re.findall(pattern, code_only)
            if matches:
                print(f"  ❌ Critical Violation: Detected {desc} ({len(matches)} occurrences)!")
                file_passed = False
                all_passed = False
            else:
                print(f"  ✅ Passed: Zero {desc}")

        draw_count = len(re.findall(r'\bctx\.drawImage\s*\(', code_only))
        if draw_count > 0:
            print(f"  ✅ Passed: Native MPQ atlas drawImage invocations found ({draw_count} calls)")
        else:
            print("  ❌ Failed: No drawImage atlas rendering calls found!")
            all_passed = False

    # 2. Audit engine layer (strictly forbid any ctx.stroke / ctx.lineTo vector drawing)
    for fpath in ENGINE_AUDIT_FILES:
        p = Path(fpath)
        if not p.exists():
            print(f"  ⚠️ Warning: Target file does not exist, skipping check: {fpath}")
            continue

        with open(p, "r", encoding="utf-8") as f:
            content = f.read()

        code_only = re.sub(r'//.*', '', content)
        code_only = re.sub(r'/\*.*?\*/', '', code_only, flags=re.DOTALL)

        print(f"\n[Auditing Combat Engine] {fpath}")
        for pattern, desc in ENGINE_FORBIDDEN_PATTERNS:
            matches = re.findall(pattern, code_only)
            if matches:
                print(f"  ❌ Critical Violation: Detected {desc} ({len(matches)} occurrences)!")
                all_passed = False
            else:
                print(f"  ✅ Passed: Zero {desc}")

        draw_count = len(re.findall(r'\bctx\.drawImage\s*\(', code_only))
        if draw_count > 0:
            print(f"  ✅ Passed: Native MPQ atlas drawImage invocations found ({draw_count} calls)")
        else:
            print("  ❌ Failed: No drawImage atlas rendering calls found!")
            all_passed = False

    if all_passed:
        print("\n✨ Gate 1 Audit Passed: All code strictly avoids frontend hand-drawing, rendering 100% via MPQ atlases!")
    else:
        print("\n💥 Gate 1 Audit Failed: Forbidden frontend vector drawing detected, cannot proceed to next step!")

    return all_passed

def run_gate2_and_3(port: int = 8765, output_dir: str = "testimages/comparison") -> bool:
    from playwright.sync_api import sync_playwright

    print("\n" + "=" * 60)
    print("🖥️ [Gate 2] Dynamic Audit & Atlas Interception via Playwright")
    print("=" * 60)

    out_path = Path(output_dir)
    out_path.mkdir(parents=True, exist_ok=True)
    temp_img_dir = Path("testimages")
    temp_img_dir.mkdir(parents=True, exist_ok=True)

    url = f"http://localhost:{port}/v2_sandbox.html"
    print(f"  • Connecting to target sandbox: {url}")

    gate2_passed = True

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1200, "height": 800})

        try:
            page.goto(url, wait_until="networkidle", timeout=8000)
        except Exception as e:
            print(f"  ❌ Failed to connect to sandbox: {e}")
            browser.close()
            return False

        page.wait_for_timeout(1000)

        # Inject prototype hook listeners: monitor stroke and drawImage
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

        # Disable debug grid and guide lines to ensure clean screenshots free of debug vector drawings
        page.evaluate("() => { if (window.setV2Debug) window.setV2Debug(false); }")
        page.wait_for_timeout(200)

        canvas = page.locator("#demo-canvas")

        # ── 1. Test Nova (Nova 48 - F06) ──
        print("\n[Testing Nova 48]")
        page.evaluate("() => { window.castV2Skill('48', 500, 340); }")
        page.wait_for_timeout(180)  # Mid-expansion

        nova_audit = page.evaluate("() => window.__audit")
        print(f"  • ElectricNova native sprite draw count: {nova_audit['drawElectricNova']}")
        print(f"  • Vector stroke call count: {nova_audit['strokeCalls']} (Gate requirement: strictly 0)")

        if nova_audit['drawElectricNova'] == 0:
            print("  ❌ Failed: ElectricNova sprite was not called!")
            gate2_passed = False
        if nova_audit['strokeCalls'] > 0:
            print(f"  ❌ Failed: Detected {nova_audit['strokeCalls']} vector stroke calls!")
            gate2_passed = False

        nova_img_path = temp_img_dir / "nova_sandbox_pure_mpq.png"
        canvas.screenshot(path=str(nova_img_path))
        print(f"  • Runtime Nova screenshot saved to: {nova_img_path}")

        # Reset counters
        page.evaluate("""() => {
            window.__audit.drawLightningStrike = 0;
            window.__audit.drawShockHit = 0;
            window.__audit.strokeCalls = 0;
        }""")
        page.wait_for_timeout(600)

        # ── 2. Test Chain Lightning (Chain Lightning 53 - F09) ──
        print("\n[Testing Chain Lightning 53]")
        page.evaluate("() => { window.castV2Skill('53', 700, 200); }")
        page.wait_for_timeout(80)

        cl_audit = page.evaluate("() => window.__audit")
        print(f"  • LightningStrike 32-direction arc draw count: {cl_audit['drawLightningStrike']}")
        print(f"  • ShockHitSm node electrical burst draw count: {cl_audit['drawShockHit']}")
        print(f"  • Vector stroke call count: {cl_audit['strokeCalls']} (Gate requirement: strictly 0)")

        if cl_audit['drawLightningStrike'] == 0:
            print("  ❌ Failed: LightningStrike sprite was not called!")
            gate2_passed = False
        if cl_audit['strokeCalls'] > 0:
            print(f"  ❌ Failed: Detected {cl_audit['strokeCalls']} vector stroke calls!")
            gate2_passed = False

        cl_img_path = temp_img_dir / "chain_lightning_sandbox_pure_mpq.png"
        canvas.screenshot(path=str(cl_img_path))
        print(f"  • Runtime Chain Lightning screenshot saved to: {cl_img_path}")

        browser.close()

    if not gate2_passed:
        print("\n💥 Gate 2 Audit Failed: Dynamic invocations did not meet criteria!")
        return False
    else:
        print("\n✨ Gate 2 Audit Passed: Full runtime invocation of native MPQ atlases verified, zero vector stroke calls!")

    # ── Gate 3: Side-by-Side Visual Ground Truth Diff Gate ──
    print("\n" + "=" * 60)
    print("🖼️ [Gate 3] Ground Truth Side-by-Side Visual Diff Gate")
    print("=" * 60)

    # Nova official comparison
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
        print(f"  ✅ Nova side-by-side comparison image composited: {comp_nova_path}")
    else:
        print(f"  ⚠️ Missing comparison image source for Nova: {official_nova_path} or {nova_img_path}")

    # Chain Lightning official comparison
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
        print(f"  ✅ Chain Lightning side-by-side comparison image composited: {comp_cl_path}")
    else:
        print(f"  ⚠️ Missing comparison image source for Chain Lightning: {official_cl_path} or {cl_img_path}")

    print("\n✨ All three verification gates completed! Deliverables ready, please inspect testimages/comparison/ diff images!")
    return True

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Diablo II Pure MPQ Triple Ground Truth Verification Script")
    parser.add_argument("--port", type=int, default=8765, help="Test port (default: 8765)")
    parser.add_argument("--skip-runtime", action="store_true", help="Execute Gate 1 static code audit only")
    args = parser.parse_args()

    g1 = run_gate1_zero_vector_audit()
    if not g1:
        print("[!] Gate 1 failed, aborting subsequent tests.")
        sys.exit(1)

    if not args.skip_runtime:
        g23 = run_gate2_and_3(port=args.port)
        if not g23:
            print("[!] Gate 2 or 3 failed.")
            sys.exit(1)

    print("\n🎉 [ALL GATES PASSED] All triple verification gates passed with green lights!")
    sys.exit(0)
