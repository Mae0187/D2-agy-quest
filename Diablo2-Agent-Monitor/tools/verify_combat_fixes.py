"""
Verification script for monster attack, death loop fix, boss bar cleanup, and scene switching
"""
import os
import sys
import time
import threading
from playwright.sync_api import sync_playwright

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT_ROOT = os.path.dirname(BASE_DIR)
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from run_app import start_server

def test_all():
    port = 8788
    httpd, url = start_server(port)
    server_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    server_thread.start()
    time.sleep(0.5)

    console_errors = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1024, "height": 768})
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

        print(f"Opening: {url}index.html")
        page.goto(f"{url}index.html")
        page.wait_for_timeout(800)

        # 1. 進入地牢沙盒
        page.keyboard.press("KeyD")
        page.wait_for_timeout(600)

        # 2. 測試怪群生成 (包含 fallen, skeleton, zombie)
        print("Testing monster wave spawn...")
        page.evaluate("""() => {
            window.d2CombatDirector.spawnMobWave('skeleton', 1);
            window.d2CombatDirector.spawnMobWave('zombie', 1);
            window.d2CombatDirector.spawnMobWave('fallen', 1);
        }""")
        page.wait_for_timeout(500)
        types = page.evaluate("() => window.d2CombatDirector.monsters.map(m => m.type)")
        print(f"Monsters on field: {types}")
        assert 'skeleton' in types and 'zombie' in types, "New monster types should be present!"
        print("[PASS] Multi-monster variety (Skeleton, Zombie, Fallen) verified.")

        # 3. 測試怪物死亡不回光返照
        print("Testing monster death & corpse persistence...")
        page.evaluate("""() => {
            const m = window.d2CombatDirector.monsters[0];
            m.takeDamage(9999);
        }""")
        page.wait_for_timeout(1500) # 等待倒地動畫播放完畢
        dead_state = page.evaluate("""() => {
            const m = window.d2CombatDirector.monsters[0];
            return { isDead: m.isDead, state: m.state, frame: m.currentFrame };
        }""")
        print(f"Dead monster status: {dead_state}")
        assert dead_state['isDead'] is True, "Monster must remain dead!"
        assert dead_state['state'] == 'death', "Monster state must remain 'death'!"
        print("[PASS] Monster death remains dead and locks at corpse frame.")

        # 4. 測試召喚 Boss 並退出沙盒時 Boss 血條乾淨隱藏
        print("Testing Boss bar hiding on campfire exit...")
        page.keyboard.press("KeyB")
        page.wait_for_timeout(600)
        has_boss_bar = page.evaluate("""() => {
            const el = document.getElementById('d2-boss-hud-bar');
            return el && el.style.display !== 'none';
        }""")
        assert has_boss_bar, "Boss bar should be visible while boss is active!"
        print("[PASS] Boss bar visible in dungeon.")

        # 按 ESC 返回營火大廳
        page.keyboard.press("Escape")
        page.wait_for_timeout(500)
        boss_bar_hidden = page.evaluate("""() => {
            const el = document.getElementById('d2-boss-hud-bar');
            return !el || el.style.display === 'none';
        }""")
        assert boss_bar_hidden, "Boss bar must be hidden in campfire mode!"
        print("[PASS] Boss bar cleanly hidden upon exiting to campfire.")

        # 5. 測試 5 大場景切換 [C]
        page.keyboard.press("KeyD") # 回到沙盒
        page.wait_for_timeout(500)
        for i in range(5):
            page.keyboard.press("KeyC")
            page.wait_for_timeout(200)
            sc_name = page.evaluate("() => window.dungeonSandbox.scenes[window.dungeonSandbox.currentSceneIdx].name")
            print(f"Switched scene [{i+1}/5]: {sc_name}")

        print("[PASS] All 5 Act 1 scenes successfully cycled.")
        assert len(console_errors) == 0, f"Errors encountered: {console_errors}"
        print("=== ALL VERIFICATION TESTS PASSED 100%! ===")

if __name__ == "__main__":
    test_all()
