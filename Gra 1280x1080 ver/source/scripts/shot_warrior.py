import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-gl=swiftshader","--enable-unsafe-swiftshader"])
        pg = await b.new_page(viewport={"width":1280,"height":720})
        errs=[]
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("console", lambda m: errs.append(m.text) if m.type=="error" else None)
        await pg.goto("file:///home/claude/gra/dist/index.html")
        await pg.wait_for_timeout(1000)
        await pg.mouse.click(300,360)
        await pg.keyboard.press("e")
        await pg.mouse.move(900,360)
        await pg.wait_for_timeout(2500)
        await pg.keyboard.press("f")
        await pg.wait_for_timeout(700)
        await pg.screenshot(path="/home/claude/gra/shot_w.png", clip={"x":300,"y":150,"width":700,"height":420})
        await pg.keyboard.press("v")
        await pg.wait_for_timeout(300)
        print("errors:", errs)
        await b.close()
asyncio.run(main())
