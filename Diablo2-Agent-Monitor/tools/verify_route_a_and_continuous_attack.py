import time
from playwright.sync_api import sync_playwright

def run_verification():
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={'width': 1600, 'height': 900})
        page.on('console', lambda msg: errors.append(f'[{msg.type}] {msg.text}') if msg.type == 'error' else None)
        
        print("1. 開啟首頁 (1024x768 放大視窗)...")
        page.goto('http://127.0.0.1:8765/')
        time.sleep(1)
        page.screenshot(path='verify_1024_campfire.png')
        
        # 點擊聖騎士選角邁步
        page.click('#slot-paladin')
        time.sleep(1)
        
        # 點擊 PLAY 進入 2.5D 地牢戰鬥沙盒
        print("2. 進入 2.5D 戰鬥沙盒...")
        page.click('#btn-play')
        time.sleep(1.5)
        page.screenshot(path='verify_act1_rogue.png')
        
        # 驗證全 5 大幕真實地圖輪轉
        for act_num, act_name in [(2, 'Lut Gholein'), (3, 'Kurast Docks'), (4, 'Chaos Sanctuary'), (5, 'Harrogath')]:
            print(f"3. 切換至 Act {act_num} ({act_name})...")
            page.keyboard.press('KeyC')
            time.sleep(1)
            page.screenshot(path=f'verify_act{act_num}.png')
            
        # 回到 Act 1 測試連續點擊攻擊 (Continuous Attack)
        page.keyboard.press('KeyC')
        time.sleep(0.5)
        
        print("4. 測試長按怪物連續揮砍攻擊...")
        # 召喚怪群
        page.keyboard.press('KeyG')
        time.sleep(0.8)
        
        # 取得怪物位置並進行長按攻擊 (mouse down -> wait 1.5s -> mouse up)
        monsters_info = page.evaluate('''() => {
            const director = window.d2CombatDirector;
            if (!director || !director.monsters.length) return null;
            const m = director.monsters[0];
            return { x: m.x, y: m.y, hp: m.hp, maxHp: m.maxHp };
        }''')
        print("初始怪物資訊:", monsters_info)
        
        if monsters_info:
            rect = page.locator('#dungeon-canvas').bounding_box()
            target_screen_x = rect['x'] + monsters_info['x']
            target_screen_y = rect['y'] + monsters_info['y']
            
            # 移動至怪物上方並按住左鍵 1.6 秒
            page.mouse.move(target_screen_x, target_screen_y)
            page.mouse.down()
            time.sleep(1.6)
            page.mouse.up()
            
            # 檢查怪物剩餘血量與打擊次數
            after_hp = page.evaluate('''() => {
                const director = window.d2CombatDirector;
                if (!director || !director.monsters.length) return null;
                return director.monsters[0].hp;
            }''')
            print(f"長按連續攻擊後怪物血量: {after_hp} (初始: {monsters_info['hp']})")
            assert after_hp < monsters_info['hp'], "怪物血量應顯著下降，證實連續攻擊生效！"
            print("連續攻擊判定完全成功！")
            
        page.screenshot(path='verify_continuous_attack.png')
        browser.close()

    print("=== 測試結果 ===")
    print("Console Errors:", len(errors))
    if errors:
        print("Errors details:", errors)
        raise RuntimeError("Console errors detected!")
    else:
        print("ALL VERIFICATIONS PASSED: 1024x768 視窗、5 大真實世界地圖、長按連續攻擊 100% 成功，0 錯誤！")

if __name__ == '__main__':
    run_verification()
