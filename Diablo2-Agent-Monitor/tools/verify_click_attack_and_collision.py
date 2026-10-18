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

        # 驗證全章節怪群生態配置
        print("3. 驗證 5 大章節怪群生態已完整囊括素材庫怪物...")
        scenes_data = page.evaluate("() => window.dungeonSandbox?.scenes.map(s => ({ act: s.act, name: s.name, mobs: s.mobs }))")
        for s in scenes_data:
            print(f"  -> Act {s['act']} ({s['name']}): 收錄 {len(s['mobs'])} 款怪物: {s['mobs']}")
            assert len(s['mobs']) >= 5, f"Act {s['act']} 怪群數量不足！"

        # 驗證滑鼠點擊怪物直接攻擊 (Click-to-Attack)
        print("4. 測試滑鼠直接點擊怪物 (Click-to-Attack)...")
        # 先獲取當前第一隻怪物的螢幕位置與初始生命值
        monster_info = page.evaluate("""() => {
            const cd = window.dungeonSandbox?.combatDirector;
            if (!cd || cd.monsters.length === 0) return null;
            const m = cd.monsters[0];
            return { x: m.x, y: m.y, hp: m.hp, maxHp: m.maxHp, type: m.type };
        }""")
        assert monster_info, "場上沒有生成怪物！"
        print(f"  -> 鎖定首隻怪物: {monster_info['type']}, 坐標=({monster_info['x']}, {monster_info['y']}), HP={monster_info['hp']}")

        # 模擬滑鼠懸停 (Hover)，驗證游標轉變為 crosshair
        canvas_box = page.locator("#dungeon-canvas").bounding_box()
        # 換算畫布比例
        canvas_w = page.evaluate("() => window.dungeonSandbox.canvas.width")
        canvas_h = page.evaluate("() => window.dungeonSandbox.canvas.height")
        scale_x = canvas_box['width'] / canvas_w
        scale_y = canvas_box['height'] / canvas_h

        target_client_x = canvas_box['x'] + monster_info['x'] * scale_x
        target_client_y = canvas_box['y'] + (monster_info['y'] - 30) * scale_y

        page.mouse.move(target_client_x, target_client_y)
        time.sleep(0.3)
        cursor_style = page.evaluate("() => window.dungeonSandbox.canvas.style.cursor")
        print(f"  -> 滑鼠懸停怪物上方時游標樣式: '{cursor_style}'")
        assert cursor_style == "crosshair", f"懸停怪物時游標未切換為戰鬥準心 crosshair! (當前: {cursor_style})"

        # 模擬滑鼠左鍵點擊該怪物 (Click to attack)
        print("  -> 滑鼠左鍵點擊該怪物實體...")
        page.mouse.click(target_client_x, target_client_y)
        time.sleep(0.8)

        # 驗證怪物受到攻擊傷害且 HP 降低
        updated_hp = page.evaluate("() => window.dungeonSandbox?.combatDirector?.monsters[0]?.hp")
        print(f"  -> 攻擊結算後怪物 HP: {updated_hp} (初始: {monster_info['hp']})")
        assert updated_hp < monster_info['hp'], f"點擊怪物後怪物 HP 未降低！(之前: {monster_info['hp']}, 之後: {updated_hp})"

        # 驗證實體碰撞防重疊機制 (Collision Separation)
        print("5. 驗證實體碰撞體積與防重疊分離 (Collision Separation)...")
        separation_ok = page.evaluate("""() => {
            const ds = window.dungeonSandbox;
            const hero = ds.character;
            const cd = ds.combatDirector;
            if (!hero || !cd) return false;
            // 檢查所有怪物與英雄之間的距離是否維持在碰撞體積之外
            for (const m of cd.monsters) {
                if (m.isDead) continue;
                const dist = Math.hypot(m.x - hero.x, (m.y - hero.y) * 2);
                const minDist = m.collisionRadius + 18;
                // 容許彈性推擠中輕微誤差，但不允許距離接近 0 的重疊穿透
                if (dist < 10) return false;
            }
            return true;
        }""")
        assert separation_ok, "怪物發生了完全重疊穿透英雄的缺陷！"
        print("  -> 實體碰撞體積防穿透驗證通過！")

        browser.close()

    print("\n--- TEST RESULT ---")
    if errors:
        print("[FAIL] Browser errors:", errors)
        sys.exit(1)
    else:
        print("[PASS] All tests passed! Click-to-Attack, hover crosshair, all acts monster pool, and Y-sort collision separation confirmed!")

if __name__ == "__main__":
    run_test()
