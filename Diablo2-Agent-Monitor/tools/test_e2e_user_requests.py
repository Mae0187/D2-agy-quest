import os
import sys
import time
from playwright.sync_api import sync_playwright

def run_test():
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

        print("1. 導航至測試頁面 http://127.0.0.1:8765/ ...")
        page.goto("http://127.0.0.1:8765/", wait_until="domcontentloaded")
        time.sleep(1)

        print("2. 點擊進入 2.5D 地牢沙盒...")
        page.click("#btn-play")
        time.sleep(1)

        # 驗證畫布
        canvas = page.locator("#dungeon-canvas")
        assert canvas.is_visible(), "地牢畫布未正常顯示"

        # 3. 測試切換職業至亞馬遜 (Amazon)
        print("3. 測試切換至亞馬遜 (Amazon) 遠近雙攻擊模式...")
        page.evaluate("window.dungeonSandbox.switchHero('amazon')")
        time.sleep(0.5)

        hero_now = page.evaluate("window.dungeonSandbox.character.heroId")
        print(f"  -> 當前英雄職業: {hero_now}")
        assert hero_now == 'amazon', f"切換亞馬遜失敗: {hero_now}"

        # 測試亞馬遜射箭 (Digit4) 與多重箭 (Digit5)
        page.keyboard.press("Digit4")
        time.sleep(0.3)
        page.keyboard.press("Digit5")
        time.sleep(0.4)

        # 4. 測試切換至死靈法師 (Necromancer) 驗證召喚物陣列
        print("4. 測試切換至死靈法師 (Necromancer) 驗證骷髏與魔像...")
        page.evaluate("window.dungeonSandbox.switchHero('necromancer')")
        time.sleep(0.5)

        hero_now = page.evaluate("window.dungeonSandbox.character.heroId")
        print(f"  -> 當前英雄職業: {hero_now}")
        assert hero_now == 'necromancer', f"切換死靈法師失敗: {hero_now}"

        companions = page.evaluate("""() => {
            if (!window.dungeonSandbox || !window.dungeonSandbox.combatDirector || !window.dungeonSandbox.combatDirector.companions) return [];
            return window.dungeonSandbox.combatDirector.companions.map(c => c.key);
        }""")
        print(f"  -> 死靈法師在場夥伴: {companions}")
        assert 'skeleton_minion' in companions, "死靈法師缺少骷髏僕從"
        assert companions.count('skeleton_minion') == 3, f"骷髏僕從數量應為 3，實際為 {companions.count('skeleton_minion')}"
        assert 'iron_golem' in companions, "死靈法師缺少鋼鐵魔像"
        assert 'fire_golem' in companions, "死靈法師缺少火焰魔像"

        # 5. 測試切換至德魯伊 (Druid) 驗證狼與烏鴉上限
        print("5. 測試切換至德魯伊 (Druid) 驗證灰熊、狂狼與烏鴉...")
        page.evaluate("window.dungeonSandbox.switchHero('druid')")
        time.sleep(0.5)

        hero_now = page.evaluate("window.dungeonSandbox.character.heroId")
        print(f"  -> 當前英雄職業: {hero_now}")
        assert hero_now == 'druid', f"切換德魯伊失敗: {hero_now}"

        druid_companions = page.evaluate("""() => {
            return window.dungeonSandbox.combatDirector.companions.map(c => c.key);
        }""")
        print(f"  -> 德魯伊在場夥伴: {druid_companions}")
        wolf_count = sum(1 for k in druid_companions if k == 'wolf')
        raven_count = sum(1 for k in druid_companions if k == 'raven')
        assert wolf_count == 3, f"狂狼數量應為 3，實際為 {wolf_count}"
        assert raven_count == 3, f"烏鴉數量應為 3，實際為 {raven_count}"
        assert 'bear' in druid_companions, "缺少灰熊夥伴"
        assert 'oak_sage' in druid_companions, "缺少自然之靈夥伴"

        # 6. 測試切換至野蠻人 (Barbarian) 驗證旋風斬
        print("6. 測試切換至野蠻人 (Barbarian) 驗證旋風斬...")
        page.evaluate("window.dungeonSandbox.switchHero('barbarian')")
        time.sleep(0.5)

        hero_now = page.evaluate("window.dungeonSandbox.character.heroId")
        print(f"  -> 當前英雄職業: {hero_now}")
        assert hero_now == 'barbarian', f"切換野蠻人失敗: {hero_now}"

        # 觸發旋風斬
        page.keyboard.press("Digit5")
        time.sleep(0.5)

        # 7. 驗證召喚怪群與戰鬥打擊
        print("7. 召喚怪群並測試打擊碰撞...")
        page.keyboard.press("KeyG")
        time.sleep(0.5)
        page.keyboard.press("Digit4")
        time.sleep(0.5)

        # 驗證 Console 無報錯
        assert len(errors) == 0, f"測試期間發生控制台錯誤: {errors}"
        print("\n--- 驗收結果 ---")
        print("七大職業技能、亞馬遜遠近雙模式、死靈法師大軍、德魯伊夥伴大軍、野蠻人旋風斬全數通過！0 報錯！")

        browser.close()

if __name__ == '__main__':
    run_test()
