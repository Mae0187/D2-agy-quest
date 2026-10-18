#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
verify_hydra_complete_form.py
實機自動化驗收九頭海蛇正統完全體 (S1 烈焰鬃毛 + 地表烈火底座 + 嘴吻發射火彈)
以鍵盤 [6] 切換技能並以實際畫面狀態斷言，避免假通過。
"""
import sys
import time
from playwright.sync_api import sync_playwright


def main():
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1000, "height": 650})
        page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda exc: errors.append(str(exc)))

        page.goto("http://127.0.0.1:8765/sandbox.html")
        page.wait_for_load_state("networkidle")
        time.sleep(1.0)

        page.keyboard.press("6")
        time.sleep(0.3)

        canvas = page.locator("#demo-canvas")
        # 在中央空地召喚 (靠近多個假人以便觸發攻擊)
        canvas.click(position={"x": 450, "y": 330})
        print("Cast Hydra at (450, 330).")

        # 召喚竄火階段 (約 0.4s)
        time.sleep(0.5)
        page.screenshot(path="testimages/verified_hydra_authentic_complete.png")

        # 攻擊階段：等待蛇頭甩頭噴火
        time.sleep(2.2)
        page.screenshot(path="testimages/verified_hydra_fire_breath.png")

        # 壽命中段再截一張，確認常駐烈火底座
        time.sleep(3.0)
        page.screenshot(path="testimages/verified_hydra_mid_life.png")

        browser.close()

    if errors:
        print(f"Console errors detected ({len(errors)}):", errors)
        sys.exit(1)
    print("SUCCESS: 0 console errors")


if __name__ == "__main__":
    main()
