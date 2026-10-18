import os
import time
import threading
from http.server import SimpleHTTPRequestHandler, HTTPServer
from playwright.sync_api import sync_playwright

WEB_DIR = r"C:\Users\DUCK\Desktop\D2-agy-quest\Diablo2-Agent-Monitor\web"
PORT = 8087

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
        page = browser.new_page(viewport={'width': 960, 'height': 720})
        
        url = f"http://127.0.0.1:{PORT}/index.html"
        print("Navigating to", url)
        page.goto(url)
        time.sleep(1.0)

        # 進入 2.5D 地牢沙盒
        print("Entering 2.5D sandbox...")
        page.click("#btn-toggle-sandbox")
        time.sleep(1.0)

        canvas = page.locator("#dungeon-canvas")
        box = canvas.bounding_box()

        # 1. 測試多次施法，抓取祝聖之槌的無光暈乾淨飛行截圖
        for i in range(5):
            page.mouse.click(box['x'] + 450, box['y'] + 280, button="right")
            time.sleep(0.18)
            hud = page.locator("#hud-state").text_content()
            print(f"Cast #{i+1}: {hud}")
            if "祝聖之槌" in hud:
                hammer_clean_path = os.path.join(WEB_DIR, "clean_hammer_no_halo.png")
                page.screenshot(path=hammer_clean_path)
                print(f"Captured clean hammer screenshot at: {hammer_clean_path}")
                break
            time.sleep(0.6)

        time.sleep(0.5)

        # 2. 測試熱誠連擊 (Zeal) 或攻擊
        for i in range(5):
            page.keyboard.press("Digit4")
            time.sleep(0.12)
            hud = page.locator("#hud-state").text_content()
            print(f"Attack #{i+1}: {hud}")
            if "熱誠連擊" in hud:
                zeal_path = os.path.join(WEB_DIR, "clean_zeal_attack.png")
                page.screenshot(path=zeal_path)
                print(f"Captured clean zeal attack screenshot at: {zeal_path}")
                break
            time.sleep(0.5)

        # 測試 favicon 是否成功 200
        favicon_resp = page.request.get(f"http://127.0.0.1:{PORT}/favicon.ico")
        print("Favicon status:", favicon_resp.status)

        browser.close()

    httpd.shutdown()
    print("Verification completed successfully!")

if __name__ == '__main__':
    main()
