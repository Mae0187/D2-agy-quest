import os
import time
import subprocess
import threading
from http.server import SimpleHTTPRequestHandler, HTTPServer
from playwright.sync_api import sync_playwright

WEB_DIR = r"C:\Users\DUCK\Desktop\D2-agy-quest\Diablo2-Agent-Monitor\web"
PORT = 8085

class QuietHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=WEB_DIR, **kwargs)
    def log_message(self, format, *args):
        pass

def run_server(httpd):
    httpd.serve_forever()

def main():
    print("Starting local HTTP server on port", PORT)
    httpd = HTTPServer(('127.0.0.1', PORT), QuietHandler)
    server_thread = threading.Thread(target=run_server, args=(httpd,), daemon=True)
    server_thread.start()

    time.sleep(0.5)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 900, 'height': 700})
        
        url = f"http://127.0.0.1:{PORT}/index.html"
        print("Navigating to", url)
        page.goto(url)
        time.sleep(1.0)

        # 1. 截取營火大廳 (包含切換沙盒按鈕)
        campfire_preview = os.path.join(WEB_DIR, "preview_phase2_lobby.png")
        page.screenshot(path=campfire_preview)
        print("Saved lobby preview to", campfire_preview)

        # 2. 點擊進入 2.5D 地牢戰鬥沙盒
        print("Clicking enter sandbox...")
        page.click("#btn-toggle-sandbox")
        time.sleep(1.5) # 等待貼圖與 Canvas 初始化

        # 截取待命狀態
        idle_preview = os.path.join(WEB_DIR, "sandbox_idle_preview.png")
        page.screenshot(path=idle_preview)
        print("Saved sandbox idle preview to", idle_preview)

        # 3. 測試行走與奔跑 (點擊右下方 600, 450)
        print("Triggering movement...")
        # 點擊畫布
        canvas = page.locator("#dungeon-canvas")
        box = canvas.bounding_box()
        # 點擊相對於 canvas 的座標 (600, 420)
        page.mouse.click(box['x'] + 600, box['y'] + 420)
        time.sleep(0.4) # 奔跑中截圖

        run_preview = os.path.join(WEB_DIR, "sandbox_run_preview.png")
        page.screenshot(path=run_preview)
        print("Saved sandbox run preview to", run_preview)

        # 4. 測試揮劍攻擊 (Attack)
        print("Triggering attack...")
        page.click("#act-btn-attack")
        time.sleep(0.25) # 攻擊揮劍中途截圖

        attack_preview = os.path.join(WEB_DIR, "sandbox_attack_preview.png")
        page.screenshot(path=attack_preview)
        print("Saved sandbox attack preview to", attack_preview)

        # 5. 測試施法靈氣 (Cast)
        print("Triggering cast...")
        page.click("#act-btn-cast")
        time.sleep(0.3) # 施法靈氣綻放時截圖

        cast_preview = os.path.join(WEB_DIR, "sandbox_cast_preview.png")
        page.screenshot(path=cast_preview)
        print("Saved sandbox cast preview to", cast_preview)

        browser.close()

    httpd.shutdown()
    print("Verification completed successfully!")

if __name__ == '__main__':
    main()
