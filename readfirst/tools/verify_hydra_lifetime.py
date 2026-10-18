#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys
import time
from playwright.sync_api import sync_playwright

errors = []
with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    page = b.new_page(viewport={"width": 1000, "height": 650})
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto("http://127.0.0.1:8765/sandbox.html")
    page.wait_for_load_state("networkidle")
    time.sleep(1)
    page.keyboard.press("6")
    page.locator("#demo-canvas").click(position={"x": 450, "y": 330})
    time.sleep(9.7)
    page.screenshot(path="testimages/verified_hydra_ending.png")
    time.sleep(1.3)
    page.screenshot(path="testimages/verified_hydra_expired.png")
    b.close()
print("errors:", errors)
sys.exit(1 if errors else 0)
