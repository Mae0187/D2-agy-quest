import asyncio
from playwright.async_api import async_playwright
import os
from pathlib import Path

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1050, "height": 750})
        
        demo_url = Path(r"C:\Users\DUCK\Desktop\D2-agy-quest\verification_sandbox\demo.html").as_uri()
        print(f"Navigating to {demo_url}")
        
        errors = []
        page.on("pageerror", lambda err: errors.append(err))
        page.on("console", lambda msg: print(f"Browser console: {msg.text}"))
        
        await page.goto(demo_url)
        await page.wait_for_timeout(500)
        
        # 點擊畫布發射火球
        canvas = page.locator("#demo-canvas")
        await canvas.click(position={"x": 650, "y": 180})
        await page.wait_for_timeout(300)
        
        # 發射骨魂 (按 2)
        await page.keyboard.press("2")
        await canvas.click(position={"x": 300, "y": 200})
        await page.wait_for_timeout(300)
        
        # 發射充能彈 (按 3)
        await page.keyboard.press("3")
        await canvas.click(position={"x": 520, "y": 260})
        await page.wait_for_timeout(300)
        
        # 狂暴連發 35 發 (按空白鍵)
        await page.keyboard.press("Space")
        await page.wait_for_timeout(500)
        
        out_png = Path(r"C:\Users\DUCK\Desktop\D2-agy-quest\testimages\demo_missile_live.png")
        out_png.parent.mkdir(parents=True, exist_ok=True)
        await page.screenshot(path=str(out_png))
        print(f"Screenshot saved to {out_png}")
        
        if errors:
            print("Errors encountered:", errors)
        else:
            print("Demo executed with 0 browser errors!")
            
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
