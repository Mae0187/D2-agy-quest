import asyncio
from playwright.async_api import async_playwright
from pathlib import Path

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1050, "height": 750})
        
        demo_url = Path(r"C:\Users\DUCK\Desktop\D2-agy-quest\verification_sandbox\demo.html").as_uri()
        await page.goto(demo_url)
        await page.wait_for_timeout(300)
        
        # 取得 JS 中的 manager 實例與目標
        # 在 demo-canvas 上點擊 (600, 300)
        canvas = page.locator("#demo-canvas")
        
        # 測試 1: 發射火球
        print("--- Testing Fireball (Skill 0) ---")
        res0 = await page.evaluate("""() => {
            const canvas = document.getElementById('demo-canvas');
            // 觸發左鍵點擊 (600, 200)
            const evt = new MouseEvent('mousedown', { clientX: canvas.getBoundingClientRect().left + 600, clientY: canvas.getBoundingClientRect().top + 200, button: 0 });
            canvas.dispatchEvent(evt);
        }""")
        
        # 追蹤 10 個幀
        for i in range(10):
            await page.wait_for_timeout(40)
            info = await page.evaluate("""() => {
                // 讀取當前活躍的投射物
                // 由於 manager 在閉包中，我們用 window 上暴露的或簡單檢查
                return window.__missileDebugInfo || 'no debug info';
            }""")
            
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
