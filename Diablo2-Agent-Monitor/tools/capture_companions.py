import os
import sys
import time
import threading
from playwright.sync_api import sync_playwright

ROOT_DIR = r"C:\Users\DUCK\Desktop\D2-agy-quest"
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)
from run_app import CustomHTTPHandler, ThreadedHTTPServer

PORT = 8792
server = ThreadedHTTPServer(("127.0.0.1", PORT), CustomHTTPHandler)
threading.Thread(target=server.serve_forever, daemon=True).start()

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 800})
    page.goto(f"http://127.0.0.1:{PORT}/")
    time.sleep(1)

    # 德魯伊出征
    page.click("#slot-druid")
    time.sleep(0.4)
    page.click("#btn-play")
    time.sleep(1.8)
    druid_shot = os.path.join(ROOT_DIR, "Diablo2-Agent-Monitor", "web", "screenshots", "verify_druid_companions.png")
    page.screenshot(path=druid_shot)
    print("Saved:", druid_shot)

    # 死靈法師出征
    page.evaluate("() => window.dungeonSandbox.switchHero('necromancer')")
    time.sleep(1.8)
    necro_shot = os.path.join(ROOT_DIR, "Diablo2-Agent-Monitor", "web", "screenshots", "verify_necro_companions.png")
    page.screenshot(path=necro_shot)
    print("Saved:", necro_shot)

    browser.close()

server.shutdown()
print("All companion screenshots successfully captured!")
