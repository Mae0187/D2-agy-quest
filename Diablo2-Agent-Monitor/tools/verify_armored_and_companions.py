import os
import sys
import time
import subprocess
import http.server
import socketserver
import threading
from playwright.sync_api import sync_playwright

PORT = 8789
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from run_app import CustomHTTPHandler, WEB_DIR, ThreadedHTTPServer

def start_server():
    server = ThreadedHTTPServer(("127.0.0.1", PORT), CustomHTTPHandler)
    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()
    return server

def run_tests():
    server = start_server()
    print(f"HTTP Server started on http://127.0.0.1:{PORT}/ with root {WEB_DIR}")

    errors = []
    logs = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()

        def handle_console(msg):
            logs.append(f"[{msg.type}] {msg.text}")
            if msg.type == "error":
                if "favicon.ico" not in msg.text:
                    errors.append(msg.text)

        page.on("console", handle_console)
        page.on("pageerror", lambda exc: errors.append(str(exc)))
        page.on("response", lambda resp: print(f"[HTTP {resp.status}] {resp.url}") if resp.status >= 400 else None)

        print("1. 導航至測試頁面...")
        page.goto(f"http://127.0.0.1:{PORT}/", wait_until="domcontentloaded")
        time.sleep(1)

        # 1. 營火選角測試：點選德魯伊 (Druid) 並進入地牢
        print("2. 營火大廳點選德魯伊...")
        page.click("#slot-druid")
        time.sleep(0.5)

        print("3. 點擊 PLAY 進入地牢沙盒...")
        page.click("#btn-play")
        time.sleep(1.5)

        # 驗證地牢畫布存在且顯示
        canvas = page.locator("#dungeon-canvas")
        assert canvas.is_visible(), "地牢畫布未正常顯示"

        # 驗證德魯伊出征英雄
        hud_hero = page.locator("#hud-hero").inner_text()
        print(f"  -> 出征英雄 HUD: {hud_hero}")
        assert "DRUID" in hud_hero.upper() or "德魯伊" in hud_hero, f"預期德魯伊，實際: {hud_hero}"

        # 驗證德魯伊夥伴召喚 (灰熊、狂狼、自然之靈)
        comp_count = page.evaluate("() => window.d2CombatDirector ? window.d2CombatDirector.companions.length : 0")
        comp_names = page.evaluate("() => window.d2CombatDirector ? window.d2CombatDirector.companions.map(c => c.name) : []")
        print(f"  -> 德魯伊召喚夥伴數量: {comp_count}, 名單: {comp_names}")
        assert comp_count == 3, f"德魯伊夥伴數量應為 3，實際為 {comp_count}"

        # 4. 裝甲形態熱切換測試 (Light -> Medium -> Heavy)
        print("4. 測試 [T] 鍵裝甲形態切換...")
        armor_before = page.evaluate("() => window.dungeonSandbox.character.armorTier")
        hud_armor_1 = page.locator("#hud-armor").inner_text()
        print(f"  -> 初始裝甲: {armor_before}, HUD: {hud_armor_1}")

        page.keyboard.press("KeyT")
        time.sleep(0.5)
        armor_mid = page.evaluate("() => window.dungeonSandbox.character.armorTier")
        hud_armor_2 = page.locator("#hud-armor").inner_text()
        print(f"  -> 第一次切換後裝甲: {armor_mid}, HUD: {hud_armor_2}")
        assert armor_mid == "medium", f"預期 medium，實際: {armor_mid}"

        page.keyboard.press("KeyT")
        time.sleep(0.5)
        armor_heavy = page.evaluate("() => window.dungeonSandbox.character.armorTier")
        hud_armor_3 = page.locator("#hud-armor").inner_text()
        print(f"  -> 第二次切換後裝甲: {armor_heavy}, HUD: {hud_armor_3}")
        assert armor_heavy == "heavy", f"預期 heavy，實際: {armor_heavy}"

        page.keyboard.press("KeyT")
        time.sleep(0.5)
        armor_light = page.evaluate("() => window.dungeonSandbox.character.armorTier")
        hud_armor_4 = page.locator("#hud-armor").inner_text()
        print(f"  -> 第三次切換後裝甲: {armor_light}, HUD: {hud_armor_4}")
        assert armor_light == "light", f"預期 light，實際: {armor_light}"

        # 5. 測試切換至死靈法師 (Necromancer) 並驗證其夥伴 (骷髏、石魔)
        print("5. 測試切換至死靈法師...")
        page.evaluate("() => window.dungeonSandbox.switchHero('necromancer')")
        time.sleep(1.0)

        necro_comp_count = page.evaluate("() => window.d2CombatDirector.companions.length")
        necro_comp_names = page.evaluate("() => window.d2CombatDirector.companions.map(c => c.name)")
        print(f"  -> 死靈法師夥伴數量: {necro_comp_count}, 名單: {necro_comp_names}")
        assert necro_comp_count == 3, f"死靈夥伴數量應為 3，實際為 {necro_comp_count}"

        # 6. 遍歷全 7 大職業及輕中重裝切換驗證
        all_heroes = ['paladin', 'amazon', 'assassin', 'barbarian', 'druid', 'necromancer', 'sorceress']
        print("6. 遍歷 7 大職業輕/中/重裝切換與技能施放...")
        for h in all_heroes:
            page.evaluate(f"() => window.dungeonSandbox.switchHero('{h}')")
            time.sleep(0.4)
            for tier in ['light', 'medium', 'heavy']:
                page.evaluate(f"() => window.dungeonSandbox.character.setArmorTier('{tier}')")
                time.sleep(0.2)
                is_loaded = page.evaluate("() => window.dungeonSandbox.character.isLoaded")
                assert is_loaded, f"{h} [{tier}] 未能正常載入精靈圖集"

            # 觸發普攻與施法
            page.keyboard.press("Digit4")
            time.sleep(0.2)
            page.keyboard.press("Digit5")
            time.sleep(0.2)

        # 截圖存證
        os.makedirs(os.path.join(WEB_DIR, "screenshots"), exist_ok=True)
        screenshot_path = os.path.join(WEB_DIR, "screenshots", "e2e_verification.png")
        page.screenshot(path=screenshot_path)
        print(f"7. 截圖已儲存至: {screenshot_path}")

        print("8. 檢查執行期主控台錯誤...")
        if errors:
            print(f"發現主控台錯誤 ({len(errors)} 個):")
            for err in errors:
                print(f"  - {err}")
            raise RuntimeError("主控台存在不可忽視之錯誤")
        else:
            print("全部測試通過！無任何主控台錯誤！")

        browser.close()
    server.shutdown()

if __name__ == "__main__":
    run_tests()
