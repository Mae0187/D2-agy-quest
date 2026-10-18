#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Diablo II 技能沙盒自動化驗收腳本 (verify_sandbox.py)
用途：無頭測試沙盒頁面、切換技能分頁、模擬施法打擊、捕獲主控台 0 報錯並儲存實機截圖。
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
    print(f"[*] 開始對 {url} 進行 Playwright 自動化實機巡檢...")

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
            print(f"[!] 頁面連線失敗: {e}")
            browser.close()
            return False

        time.sleep(1.0)
        print("[*] 頁面載入成功，開始技能切換巡檢...")

        # 點擊主要技能分頁 (若有)
        for tab_name in ["Cold", "Fire", "Lightning"]:
            try:
                btn = page.locator(f"button:has-text('{tab_name}')")
                if btn.count() > 0:
                    btn.first.click()
                    time.sleep(0.3)
                    print(f"[*] 切換至 {tab_name} 分頁")
            except Exception:
                pass

        # 模擬點擊畫布出招
        canvas = page.locator("canvas")
        if canvas.count() > 0:
            box = canvas.bounding_box()
            if box:
                cx = box["x"] + box["width"] / 2
                cy = box["y"] + box["height"] / 2

                # 朝右上、左上、中央假人施法
                test_points = [
                    (cx + 200, cy - 150, "ne"),
                    (cx - 200, cy - 150, "nw"),
                    (cx + 100, cy, "dummy"),
                ]

                for tx, ty, label in test_points:
                    page.mouse.click(tx, ty)
                    time.sleep(0.4)

                # 截取全螢幕實機截圖
                shot_file = out_path / f"verify_port_{port}_complete.png"
                page.screenshot(path=str(shot_file))
                print(f"[+] 實機驗證截圖已儲存至: {shot_file}")

        browser.close()

    if errors:
        print(f"[!] 驗證失敗，發現 {len(errors)} 個錯誤:")
        for err in errors:
            print(f"    - {err}")
        return False

    print("[+] 實機自動化巡檢通過！主控台 0 JavaScript 報錯！")
    return True

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8765, help="目標沙盒埠號 (8765~8771)")
    parser.add_argument("--out", type=str, default="testimages", help="截圖輸出目錄")
    args = parser.parse_args()

    success = verify_sandbox(port=args.port, output_dir=args.out)
    sys.exit(0 if success else 1)
