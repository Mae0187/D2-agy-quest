#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Diablo II Skill Sandbox Automated Verification Script (verify_sandbox.py)
Purpose: Headless testing of the sandbox page, switching skill tabs, simulating casts, asserting zero console errors, and capturing runtime screenshots.
"""

import sys
import time
import argparse
from pathlib import Path
from playwright.sync_api import sync_playwright

def verify_sandbox(port: int = 8765, output_dir: str = "testimages"):
    out_path = Path(output_dir)
    out_path.mkdir(parents=True, exist_ok=True)

    url = f"http://localhost:{port}/v2_sandbox.html"
    print(f"[*] Starting Playwright automated verification inspection against {url}...")

    errors = []
    logs = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()

        page.on("console", lambda msg: errors.append(f"Console {msg.type}: {msg.text}") if msg.type in ["error"] else logs.append(msg.text))
        page.on("pageerror", lambda err: errors.append(f"PageError: {err}"))

        try:
            page.goto(url, wait_until="networkidle", timeout=10000)
        except Exception as e:
            print(f"[!] Page connection failed: {e}")
            browser.close()
            return False

        time.sleep(1.0)
        print("[*] Page loaded successfully, beginning skill tab inspection...")

        # Click primary skill tabs (if present)
        for tab_name in ["Cold", "Fire", "Lightning"]:
            try:
                btn = page.locator(f"button:has-text('{tab_name}')")
                if btn.count() > 0:
                    btn.first.click()
                    time.sleep(0.3)
                    print(f"[*] Switched to {tab_name} tab")
            except Exception:
                pass

        # Simulate canvas click casts
        canvas = page.locator("canvas")
        if canvas.count() > 0:
            box = canvas.bounding_box()
            if box:
                cx = box["x"] + box["width"] / 2
                cy = box["y"] + box["height"] / 2

                # Cast towards northeast, northwest, and center dummies
                test_points = [
                    (cx + 200, cy - 150, "ne"),
                    (cx - 200, cy - 150, "nw"),
                    (cx + 100, cy, "dummy"),
                ]

                for tx, ty, label in test_points:
                    page.mouse.click(tx, ty)
                    time.sleep(0.4)

                # Capture full runtime screenshot
                shot_file = out_path / f"verify_port_{port}_complete.png"
                page.screenshot(path=str(shot_file))
                print(f"[+] Runtime verification screenshot saved to: {shot_file}")

        browser.close()

    if errors:
        print(f"[!] Verification failed, found {len(errors)} errors:")
        for err in errors:
            print(f"    - {err}")
        return False

    print("[+] Runtime automated inspection passed! Zero console JavaScript errors!")
    return True

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8765, help="Target sandbox port (8765-8771)")
    parser.add_argument("--out", type=str, default="testimages", help="Screenshot output directory")
    args = parser.parse_args()

    success = verify_sandbox(port=args.port, output_dir=args.out)
    sys.exit(0 if success else 1)
