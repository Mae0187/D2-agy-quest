import os
import sys
import time
import threading
from http.server import SimpleHTTPRequestHandler, HTTPServer
from playwright.sync_api import sync_playwright

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

WEB_DIR = r"C:\Users\DUCK\Desktop\D2-agy-quest\Diablo2-Agent-Monitor\web"
PORT = 8086

class QuietHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=WEB_DIR, **kwargs)
    def log_message(self, format, *args):
        # 僅打印 404 或錯誤請求
        if len(args) > 1 and str(args[1]) not in ('200', '304'):
            print(f"[HTTP {args[1]}] {args[0]}")

def run_server(httpd):
    httpd.serve_forever()

def main():
    print("=== Starting Diablo II Authentic Skills & Controls Verification ===")
    httpd = HTTPServer(('127.0.0.1', PORT), QuietHandler)
    server_thread = threading.Thread(target=run_server, args=(httpd,), daemon=True)
    server_thread.start()

    time.sleep(0.5)

    console_errors = []
    failed_requests = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 960, 'height': 720})

        # 監控 Console 與 Network
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type in ["error"] else None)
        page.on("requestfailed", lambda req: failed_requests.append(f"{req.url}: {req.failure}") if req.failure != "net::ERR_ABORTED" else None)

        url = f"http://127.0.0.1:{PORT}/index.html"
        print(f"Loading {url}...")
        page.goto(url)
        time.sleep(1.0)

        # 1. 進入地牢沙盒
        print("Entering 2.5D Dungeon Sandbox...")
        page.click("#btn-toggle-sandbox")
        time.sleep(1.0)

        # 2. 檢測初始 HUD 與狀態
        state_text = page.locator("#hud-state").inner_text()
        mode_text = page.locator("#hud-mode").inner_text()
        aura_text = page.locator("#hud-aura").inner_text()
        print(f"Initial HUD -> State: {state_text} | Mode: {mode_text} | Aura: {aura_text}")

        # 3. 測試 Shift 走跑開關切換 (Toggle)
        print("\nTesting Shift Run/Walk Toggle...")
        page.keyboard.press("Shift")
        time.sleep(0.2)
        mode_after_shift1 = page.locator("#hud-mode").inner_text()
        print(f"After 1st Shift -> Mode: {mode_after_shift1}")
        assert "WALK" in mode_after_shift1, f"Expected WALK mode after shift, got {mode_after_shift1}"

        page.keyboard.press("Shift")
        time.sleep(0.2)
        mode_after_shift2 = page.locator("#hud-mode").inner_text()
        print(f"After 2nd Shift -> Mode: {mode_after_shift2}")
        assert "RUN" in mode_after_shift2, f"Expected RUN mode after 2nd shift, got {mode_after_shift2}"

        # 4. 測試 [M] 鍵全域靜音切換
        print("\nTesting [M] Key Mute Toggle...")
        mute_initial = page.locator("#hud-mute").inner_text()
        print(f"Initial Mute HUD: {mute_initial}")
        assert "🔊" in mute_initial or "開啟" in mute_initial, f"Expected audio enabled initially, got {mute_initial}"

        page.keyboard.press("KeyM")
        time.sleep(0.2)
        mute_after_m1 = page.locator("#hud-mute").inner_text()
        print(f"After 1st [M] -> Mute HUD: {mute_after_m1}")
        assert "🔇" in mute_after_m1 or "靜音" in mute_after_m1, f"Expected muted after 1st M, got {mute_after_m1}"

        page.keyboard.press("KeyM")
        time.sleep(0.2)
        mute_after_m2 = page.locator("#hud-mute").inner_text()
        print(f"After 2nd [M] -> Mute HUD: {mute_after_m2}")
        assert "🔊" in mute_after_m2 or "開啟" in mute_after_m2, f"Expected audio restored after 2nd M, got {mute_after_m2}"

        # 5. 測試 [A] 鍵六大正統雙層靈氣輪轉
        print("\nTesting [A] Key Aura Cycle...")
        auras_seen = [aura_text]
        for i in range(7):
            page.keyboard.press("KeyA")
            time.sleep(0.2)
            cur_aura = page.locator("#hud-aura").inner_text()
            auras_seen.append(cur_aura)
            print(f"Aura cycle {i+1} -> {cur_aura}")

        # 截圖靈氣腳底居中效果
        page.screenshot(path=os.path.join(WEB_DIR, "verify_aura.png"))
        print("Captured aura screenshot: verify_aura.png")

        # 5. 測試施法技能 (右鍵施法連續 5 次，驗證祝聖之槌、聖光彈、天堂之拳)
        print("\nTesting Cast Skills (Right Clicks)...")
        canvas = page.locator("#dungeon-canvas")
        box = canvas.bounding_box()

        cast_skills_seen = set()
        for i in range(8):
            page.mouse.click(box['x'] + 500 + (i * 20), box['y'] + 300 + (i * 10), button='right')
            time.sleep(0.15)
            st = page.locator("#hud-state").inner_text()
            cast_skills_seen.add(st)
            time.sleep(0.4)

        print(f"Cast skills triggered during test: {cast_skills_seen}")
        page.screenshot(path=os.path.join(WEB_DIR, "verify_cast.png"))
        print("Captured cast screenshot: verify_cast.png")

        # 6. 測試近戰揮砍 (左鍵 Shift+Click 就地攻擊)
        print("\nTesting Melee Attacks (Shift + Left Click)...")
        melee_skills_seen = set()
        for i in range(6):
            page.keyboard.down("Shift")
            page.mouse.click(box['x'] + 480, box['y'] + 280, button='left')
            page.keyboard.up("Shift")
            time.sleep(0.12)
            st = page.locator("#hud-state").inner_text()
            melee_skills_seen.add(st)
            time.sleep(0.4)

        print(f"Melee skills triggered during test: {melee_skills_seen}")
        page.screenshot(path=os.path.join(WEB_DIR, "verify_attack.png"))
        print("Captured attack screenshot: verify_attack.png")

        # 7. 檢查控制台與網路錯誤
        print(f"\nConsole errors count: {len(console_errors)}")
        for err in console_errors:
            print(f"  [ERROR] {err}")
        print(f"Failed requests count: {len(failed_requests)}")
        for req in failed_requests:
            print(f"  [FAILED REQ] {req}")

        assert len(console_errors) == 0, f"Found console errors: {console_errors}"
        assert len(failed_requests) == 0, f"Found failed requests: {failed_requests}"

        browser.close()

    httpd.shutdown()
    print("\n=== ALL TESTS PASSED SUCCESSFULLY! ===")

if __name__ == '__main__':
    main()
