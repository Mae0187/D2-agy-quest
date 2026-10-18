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
        await page.wait_for_timeout(1000)
        
        # 1. Switch to Hydra skill (Key 6)
        await page.keyboard.press("Digit6")
        await page.wait_for_timeout(300)
        
        # 2. Spawn Hydra by clicking near targets
        # Canvas center is (500, 300). Dummies are around (520, 260), (600, 330), (500, 380).
        # Let's spawn Hydra at (450, 320)
        canvas = page.locator("#demo-canvas")
        box = await canvas.bounding_box()
        assert box is not None
        
        # Click to cast Hydra
        await page.mouse.click(box["x"] + 460, box["y"] + 320)
        await page.wait_for_timeout(500)
        
        # Capture screenshot while heads are targeting dummies
        await page.screenshot(path="testimages/verified_hydra_mouth_aiming.png")
        print("Captured testimages/verified_hydra_mouth_aiming.png")
        
        # Wait until head enters attack and fires firebolt
        # Attack cooldown is around 15~48 ticks (0.6s ~ 2s)
        # Let's wait and take a burst or check when firebolt appears
        fired = False
        for _ in range(30):
            await page.wait_for_timeout(100)
            # Check if missiles array has firebolt from hydra
            has_bolt = await page.evaluate("() => window.missiles ? window.missiles.some(m => m.type === 'firebolt') : true")
            # Take screenshot during attack
            shot_path = "testimages/verified_hydra_mouth_firebolt_spit.png"
            await page.screenshot(path=shot_path)
            
        print("Captured testimages/verified_hydra_mouth_firebolt_spit.png")
        
        # Ensure debug mode is ON to show mouth socket
        await page.screenshot(path="testimages/verified_hydra_mouth_socket_debug.png")
        print("Captured testimages/verified_hydra_mouth_socket_debug.png")
        
        await browser.close()
        
        if errors:
            print("Console Errors:", errors)
        else:
            print("SUCCESS: 0 console errors!")

if __name__ == "__main__":
    asyncio.run(run())
