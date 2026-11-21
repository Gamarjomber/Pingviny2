import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-gl=swiftshader","--enable-unsafe-swiftshader"])
        pg = await b.new_page(viewport={"width":1280,"height":720})
        errs=[]
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto("file:///home/claude/gra/dist/index.html")
        await pg.wait_for_timeout(1000)
        await pg.mouse.click(300,360)
        await pg.keyboard.down("g") if False else None
        for _ in range(12): await pg.keyboard.press("e")
        # безсмертя, щоб бачити натовп
        await pg.click("button[data-act=god]")
        await pg.mouse.move(800,300)
        await pg.wait_for_timeout(8000)
        print(await pg.inner_text("#panel .stats"))
        await pg.screenshot(path="/home/claude/gra/s3.png", clip={"x":0,"y":0,"width":1010,"height":720})
        print(errs)
        await b.close()
asyncio.run(main())
