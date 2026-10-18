import os
import time
import threading
from http.server import SimpleHTTPRequestHandler, HTTPServer
from playwright.sync_api import sync_playwright

WEB_DIR = r"C:\Users\DUCK\Desktop\D2-agy-quest\Diablo2-Agent-Monitor\web"
PORT = 8086

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

        # 測試多次右鍵施法，觀察隨機技能觸發
        skills_detected = []
        for cast_idx in range(6):
            print(f"Triggering cast #{cast_idx + 1}...")
            # 隨機在角色周圍點擊右鍵
            target_x = box['x'] + 400 + (cast_idx % 3) * 60
            target_y = box['y'] + 250 + (cast_idx % 2) * 40
            page.mouse.click(target_x, target_y, button="right")
            time.sleep(0.18) # 抓取第 4 幀技能詠唱與特效爆發瞬間

            # 讀取 HUD 狀態文字
            hud_text = page.locator("#hud-state").text_content()
            skills_detected.append(hud_text)
            print(f"Cast #{cast_idx + 1} HUD text: {hud_text}")

            screenshot_path = os.path.join(WEB_DIR, f"skill_cast_test_{cast_idx + 1}.png")
            page.screenshot(path=screenshot_path)
            time.sleep(0.5) # 等待技能冷卻結束回到待命

        print("Skills detected across tests:", set(skills_detected))

        # 測試揮砍技能
        print("Triggering attack test...")
        page.keyboard.press("Digit4")
        time.sleep(0.15)
        attack_hud = page.locator("#hud-state").text_content()
        print("Attack HUD text:", attack_hud)
        attack_preview = os.path.join(WEB_DIR, "skill_attack_test.png")
        page.screenshot(path=attack_preview)

        browser.close()

    httpd.shutdown()
    print("Random skill verification complete!")

if __name__ == '__main__':
    main()
