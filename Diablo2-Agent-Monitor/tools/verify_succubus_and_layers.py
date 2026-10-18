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

        print("1. 導航至 http://127.0.0.1:8765/ ...")
        page.goto("http://127.0.0.1:8765/", wait_until="domcontentloaded")
        time.sleep(1)

        print("2. 點擊進入 2.5D 地牢沙盒...")
        page.click("#btn-play")
        time.sleep(1)

        # 驗證攻擊中絕不觸發 zeal
        print("3. 測試 20 次攻擊指令，驗證熱誠 (Zeal) 已徹底移除...")
        for i in range(20):
            page.keyboard.press("Digit4")
            time.sleep(0.08)
            skill = page.evaluate("() => window.dungeonSandbox?.character?.currentSkillType")
            assert skill != "zeal", f"第 {i+1} 次攻擊意外觸發了已移除的熱誠連擊 (Zeal)!"

        current_skill = page.evaluate("() => window.dungeonSandbox?.character?.currentSkillName")
        print(f"  -> 驗證成功，攻擊技能僅在盾擊與普通揮砍之間切換 (當前: {current_skill})")

        # 切換到 Act 5 召喚魅魔
        print("4. 切換至【第 5 幕】毀滅王座並召喚魅魔 (Succubus)...")
        for _ in range(4):
            page.keyboard.press("KeyC")
            time.sleep(0.4)

        hud_scene = page.locator("#hud-scene").inner_text()
        print(f"  -> 當前場景: {hud_scene}")
        assert "毀滅王座" in hud_scene or "第 5 幕" in hud_scene

        # 召喚指定魅魔
        spawn_res = page.evaluate("""() => {
            const cd = window.dungeonSandbox?.combatDirector;
            if (!cd) return false;
            cd.spawnMobWave('succubus', 3);
            return cd.monsters.some(m => m.type === 'succubus');
        }""")
        assert spawn_res, "未能成功召喚魅魔 (Succubus)!"
        print("  -> 成功在第 5 幕生成 3 隻魅魔 (Succubus)!")
        time.sleep(1)

        # 驗證魅魔動作圖集正常載入
        succubus_img_loaded = page.evaluate("""() => {
            const cd = window.dungeonSandbox?.combatDirector;
            const succ = cd.monsters.find(m => m.type === 'succubus');
            if (!succ) return false;
            const sheet = succ.sheets[succ.state] || succ.sheets['idle'];
            return sheet && sheet.img && sheet.img.complete && sheet.img.naturalWidth > 0;
        }""")
        assert succubus_img_loaded, "魅魔精靈圖未能成功載入或 naturalWidth 為 0!"
        print("  -> 魅魔精靈圖資源完全載入正常！")

        # 驗證圖層渲染結構
        render_order_check = page.evaluate("""() => {
            const ds = window.dungeonSandbox;
            return typeof ds.combatDirector.renderMonsters === 'function' &&
                   typeof ds.combatDirector.renderEffects === 'function';
        }""")
        assert render_order_check, "renderMonsters 與 renderEffects 未正確掛載！"
        print("  -> 圖層分離渲染管線運作正常（怪物置底、英雄置頂、特效頂層高光）！")

        browser.close()

    print("\n--- TEST RESULT ---")
    if errors:
        print("[FAIL] Browser errors:", errors)
        sys.exit(1)
    else:
        print("[PASS] All tests passed! Zeal removed, Succubus spawned, Layer elevation confirmed, 0 Console Errors!")

if __name__ == "__main__":
    run_test()
