import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1280, "height": 720})
        
        errors = []
        page.on("pageerror", lambda err: errors.append(str(err)))
        page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
        
        await page.goto("http://127.0.0.1:8765/sandbox.html", wait_until="networkidle")
        await page.wait_for_timeout(600)
        
        canvas = page.locator("#demo-canvas")
        box = await canvas.bounding_box()
        assert box is not None
        
        # 1. Cast Firewall (Key 4)
        await page.keyboard.press("Digit4")
        await page.wait_for_timeout(100)
        await page.mouse.click(box["x"] + 480, box["y"] + 360)
        await page.wait_for_timeout(300)
        
        # 2. Cast Meteor (Key 5)
        await page.keyboard.press("Digit5")
        await page.wait_for_timeout(100)
        await page.mouse.click(box["x"] + 520, box["y"] + 240)
        await page.wait_for_timeout(300)
        
        # 3. Cast Hydra (Key 6)
        await page.keyboard.press("Digit6")
        await page.wait_for_timeout(100)
        await page.mouse.click(box["x"] + 430, box["y"] + 310)
        await page.wait_for_timeout(400)
        
        # Capture screenshot: NO skill announcement text popped up!
        shot_path = "testimages/verified_no_skill_text_popup.png"
        await page.screenshot(path=shot_path)
        print("Captured", shot_path)
        
        # Wait for Meteor to impact and spawn medium residual fire
        await page.wait_for_timeout(1600)
        meteor_shot = "testimages/verified_meteor_residual_fire_med.png"
        await page.screenshot(path=meteor_shot)
        print("Captured", meteor_shot)
        
        # Check floating texts array on page to ensure no announcement text exists
        texts = await page.evaluate("() => window.floatingTexts ? window.floatingTexts.map(t => t.text) : []")
        print("Active floating texts on screen:", texts)
        for t in texts:
            # All texts must be damage numbers starting with -, +, or digits
            assert t.startswith(("-", "+")) or t[0].isdigit(), f"Found forbidden skill text: {t}"
        
        await browser.close()
        
        if errors:
            print("Console Errors:", errors)
        else:
            print("SUCCESS: 0 console errors, all skill texts suppressed per user instruction!")

if __name__ == "__main__":
    asyncio.run(run())
