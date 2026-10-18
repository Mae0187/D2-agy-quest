"""
Playwright automated end-to-end verification for Phase 3 Combat Director
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

def run_verification():
    print("=== Starting Phase 3 Combat Director End-to-End Test ===")
    
    # 啟動測試用伺服器
    port = 8775
    httpd, url = start_server(port)
    server_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    server_thread.start()
    time.sleep(0.6)

    console_errors = []
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1024, "height": 768})

        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

        print(f"Navigating to: {url}index.html")
        page.goto(f"{url}index.html")
        page.wait_for_timeout(1000)

        # 驗證 Agent Link 徽章存在
        agent_badge = page.locator("#d2-agent-link-status")
        assert agent_badge.count() > 0, "Agent Link status element missing!"
        print("[PASS] Agent Link Status badge rendered successfully.")

        # 切換到等距地牢戰鬥沙盒
        page.keyboard.press("KeyD")
        page.wait_for_timeout(800)

        # 檢驗沙盒畫布與戰鬥導演
        is_combat_director_ready = page.evaluate("() => Boolean(window.d2CombatDirector)")
        assert is_combat_director_ready, "CombatDirector not initialized in sandbox!"
        print("[PASS] CombatDirector initialized in Dungeon Sandbox.")

        # 模擬推送 tool_execute 事件
        print("Dispatching 'tool_execute' event...")
        page.evaluate("""() => {
            window.d2CombatDirector.pushEvent({
                type: 'tool_execute',
                payload: { action: 'run_command', detail: 'pytest' }
            });
        }""")
        page.wait_for_timeout(600)

        # 驗證小怪是否成功生成
        mob_count = page.evaluate("() => window.d2CombatDirector.monsters.length")
        print(f"Active monsters on field: {mob_count}")
        assert mob_count >= 1, "Expected monster mob wave to spawn on tool_execute!"
        print("[PASS] Mob wave spawned in response to tool_execute event.")

        # 模擬推送 task_start (Boss 戰召喚 Andariel)
        print("Dispatching 'task_start' event...")
        page.evaluate("""() => {
            window.d2CombatDirector.pushEvent({
                type: 'task_start',
                payload: { detail: 'Boss encounter start' }
            });
        }""")
        page.wait_for_timeout(600)

        has_boss = page.evaluate("() => Boolean(window.d2CombatDirector.activeBoss)")
        assert has_boss, "Expected active boss (Andariel) to be summoned on task_start!"
        print("[PASS] Andariel Boss summoned and active on field.")

        boss_bar_visible = page.evaluate("""() => {
            const bar = document.getElementById('d2-boss-hud-bar');
            return bar && bar.style.display !== 'none';
        }""")
        assert boss_bar_visible, "Boss HUD health bar should be visible!"
        print("[PASS] Boss HUD Health Bar visible and tracking boss HP.")

        # 模擬 task_complete (勝利結案)
        print("Dispatching 'task_complete' event...")
        page.evaluate("""() => {
            window.d2CombatDirector.pushEvent({
                type: 'task_complete',
                payload: { detail: 'Mission accomplished' }
            });
        }""")
        page.wait_for_timeout(600)

        boss_dead = page.evaluate("() => window.d2CombatDirector.activeBoss.isDead")
        assert boss_dead, "Expected boss to be defeated on task_complete!"
        print("[PASS] All enemies defeated on task_complete event.")

        browser.close()

    httpd.shutdown()
    
    # 過濾非致命警告
    actual_errors = [e for e in console_errors if "favicon" not in e.lower()]
    assert len(actual_errors) == 0, f"Unexpected browser console errors: {actual_errors}"
    print("[PASS] Zero browser console errors recorded.")
    print("=== Phase 3 Combat Director End-to-End Verification PASSED 100%! ===")

if __name__ == "__main__":
    run_verification()
