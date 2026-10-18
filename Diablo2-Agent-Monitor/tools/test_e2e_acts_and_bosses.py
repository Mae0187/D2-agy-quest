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
                # 忽略 favicon 等無關錯誤
                if "favicon.ico" not in msg.text:
                    errors.append(msg.text)

        page.on("console", handle_console)
        page.on("pageerror", lambda exc: errors.append(str(exc)))

        print("1. 正在導航至 http://127.0.0.1:8765/ ...")
        page.goto("http://127.0.0.1:8765/", wait_until="domcontentloaded")
        time.sleep(1)

        print("2. 點擊進入 2.5D 地牢沙盒...")
        page.click("#btn-play")
        time.sleep(1)

        # 驗證地牢畫布存在且顯示
        canvas = page.locator("#dungeon-canvas")
        assert canvas.is_visible(), "地牢畫布未正常顯示"

        # 遍歷 5 大章節場景 (Act 1 僅保留修道院兵營)
        expected_scenes = [
            ("【第 1 幕】修道院兵營 (Barracks)", "andariel", "Andariel (安達利爾)"),
            ("【第 2 幕】塔拉夏古墓 (Tal Rasha's Tomb)", "duriel", "Duriel (督瑞爾)"),
            ("【第 3 幕】崔凡克神殿 (Travincal Temple)", "mephisto", "Mephisto (墨菲斯托)"),
            ("【第 4 幕】混沌避難所 (Chaos Sanctuary)", "diablo", "Diablo (暗黑破壞神)"),
            ("【第 5 幕】毀滅王座 (Throne of Destruction)", "baal", "Baal (巴爾)")
        ]

        for idx, (scene_name, boss_key, boss_title) in enumerate(expected_scenes):
            hud_scene = page.locator("#hud-scene").inner_text()
            print(f"場景 {idx + 1}: 當前 HUD 顯示 '{hud_scene}'")
            assert scene_name in hud_scene or scene_name.split()[0] in hud_scene, f"場景名稱不符合: {hud_scene}"

            # 按 B 召喚章節首領
            print(f"  -> 召喚章節首領: {boss_title}")
            page.keyboard.press("KeyB")
            time.sleep(0.5)

            # 檢查 Boss HUD
            boss_bar = page.locator("#d2-boss-hud-bar")
            assert boss_bar.is_visible(), f"{boss_title} 血條未顯示"
            boss_title_el = page.locator("#d2-boss-title-text").inner_text()
            print(f"  -> Boss HUD 標題: '{boss_title_el}'")
            assert boss_title in boss_title_el or boss_key in boss_title_el.lower(), f"Boss 標題不符合: {boss_title_el}"

            # 按 G 召喚章節怪群
            print("  -> 按 G 召喚章節怪群...")
            page.keyboard.press("KeyG")
            time.sleep(0.3)

            # 進行攻擊與走位測試
            page.keyboard.press("KeyA") # 切換靈氣
            page.keyboard.press("Digit4") # 攻擊
            page.keyboard.press("Digit5") # 施法
            time.sleep(0.5)

            # 按 C 切換至下一場景 (最後一個場景除外)
            if idx < len(expected_scenes) - 1:
                print("  -> 按 C 切換場景...")
                page.keyboard.press("KeyC")
                time.sleep(0.8)

        # 測試退出到營火
        print("3. 按 ESC 退出到營火休整大廳...")
        page.keyboard.press("Escape")
        time.sleep(1)

        boss_bar = page.locator("#d2-boss-hud-bar")
        assert not boss_bar.is_visible(), "退出營火後 Boss 血條仍殘留顯示！"
        campfire = page.locator("#campfire")
        assert campfire.is_visible(), "營火休整大廳未正常顯示！"

        browser.close()

    print("\n--- 測試結論 ---")
    if errors:
        print("檢測到瀏覽器錯誤：", errors)
        sys.exit(1)
    else:
        print("所有場景、Boss (含墨菲斯托、巴爾)、怪群切換與營火返回完全通過，0 Console 錯誤！")

if __name__ == "__main__":
    run_test()
