import asyncio
import threading
import http.server
import socketserver
import os
from playwright.async_api import async_playwright
from PIL import Image

WEB_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'web'))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=WEB_DIR, **kwargs)
    def log_message(self, format, *args):
        pass

PORT = 8792
socketserver.TCPServer.allow_reuse_address = True
httpd = socketserver.TCPServer(('127.0.0.1', PORT), Handler)
thread = threading.Thread(target=httpd.serve_forever, daemon=True)
thread.start()
print('HTTP Server running on port', PORT)

async def test_all_auras():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={'width': 800, 'height': 600})
        await page.goto(f'http://127.0.0.1:{PORT}/index.html')
        await asyncio.sleep(2)
        
        # Click paladin hero
        paladin_card = await page.query_selector('.hero-card[data-hero="paladin"]')
        if paladin_card:
            await paladin_card.click()
            await asyncio.sleep(1)
            print('Clicked paladin card')
        
        # Press KeyD or click #btn-play to enter sandbox
        await page.keyboard.press('KeyD')
        await asyncio.sleep(2.5)
        print('Entered sandbox via KeyD')
        
        # Default aura (Holy Fire)
        await page.screenshot(path='sandbox_default_holyfire.png')
        im = Image.open('sandbox_default_holyfire.png')
        im.crop((320, 220, 480, 360)).save('feet_holyfire.png')
        print('Captured feet_holyfire.png')
        
        # Cycle through all auras
        cycle_names = ['might', 'concentration', 'holyshock', 'defiance', 'sanctuary', 'cleansing', 'none', 'fanatic']
        for a_name in cycle_names:
            await page.keyboard.press('KeyA')
            await asyncio.sleep(0.7)
            full_path = f'sandbox_{a_name}.png'
            feet_path = f'feet_{a_name}.png'
            await page.screenshot(path=full_path)
            im = Image.open(full_path)
            im.crop((320, 220, 480, 360)).save(feet_path)
            print(f'Captured {feet_path}')
            
        await browser.close()

try:
    asyncio.run(test_all_auras())
finally:
    httpd.shutdown()
print('All verifications finished successfully!')
