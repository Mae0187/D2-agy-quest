import os
import time
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

        # 進入 2.5D 地牢沙盒
        print("Entering 2.5D sandbox...")
        page.click("#btn-toggle-sandbox")
        time.sleep(1.5)

        # 1. 測試向右移動 (D 鍵)
        print("Testing right movement (D key)...")
        page.keyboard.down("KeyD")
        time.sleep(0.3)
        right_walk_preview = os.path.join(WEB_DIR, "sandbox_walk_right.png")
        page.screenshot(path=right_walk_preview)
        page.keyboard.up("KeyD")
        time.sleep(0.2)

        # 2. 測試向左移動 (A 鍵)
        print("Testing left movement (A key)...")
        page.keyboard.down("KeyA")
        time.sleep(0.3)
        left_walk_preview = os.path.join(WEB_DIR, "sandbox_walk_left.png")
        page.screenshot(path=left_walk_preview)
        page.keyboard.up("KeyA")
        time.sleep(0.2)

        # 3. 測試施法技能動畫 (右鍵施法 -> 祝聖之槌飛旋)
        print("Testing Blessed Hammer cast skill...")
        canvas = page.locator("#dungeon-canvas")
        box = canvas.bounding_box()
        # 右鍵點擊畫布
        page.mouse.click(box['x'] + 450, box['y'] + 250, button="right")
        time.sleep(0.35) # 等待第 4 幀飛槌拋射並螺旋展開

        cast_hammer_preview = os.path.join(WEB_DIR, "sandbox_blessed_hammer_preview.png")
        page.screenshot(path=cast_hammer_preview)
        print("Saved Blessed Hammer preview to", cast_hammer_preview)

        browser.close()

    httpd.shutdown()
    print("Phase 2 regression tests completed!")

if __name__ == '__main__':
    main()
