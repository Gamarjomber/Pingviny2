import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-gl=swiftshader","--enable-unsafe-swiftshader"])
        pg = await b.new_page(viewport={"width":1280,"height":720})
        await pg.goto("file:///home/claude/gra/dist/index.html")
        await pg.wait_for_timeout(1200)
        await pg.mouse.click(300,360)   # фокус на канвас
        await pg.keyboard.press("F1")
        await pg.mouse.move(900,500)
        await pg.wait_for_timeout(1500)
        await pg.screenshot(path="/home/claude/gra/shot3.png", clip={"x":300,"y":150,"width":600,"height":420})
        await b.close()
asyncio.run(main())
