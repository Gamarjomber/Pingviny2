import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-gl=swiftshader","--enable-unsafe-swiftshader"])
        pg = await b.new_page(viewport={"width":1280,"height":720})
        errs=[]
        pg.on("console", lambda m: errs.append(m.text) if m.type=="error" else None)
        pg.on("pageerror", lambda e: errs.append("PAGEERROR "+str(e)))
        await pg.goto("file:///home/claude/gra/dist/index.html")
        await pg.wait_for_timeout(1200)
        await pg.mouse.click(300,360)
        await pg.keyboard.press("e"); await pg.keyboard.press("e")
        await pg.mouse.move(700,300)
        await pg.wait_for_timeout(6000)
        await pg.screenshot(path="/home/claude/gra/s1.png", clip={"x":200,"y":60,"width":780,"height":600})
        await pg.keyboard.down("d"); await pg.wait_for_timeout(2500); await pg.keyboard.up("d")
        await pg.wait_for_timeout(2500)
        await pg.screenshot(path="/home/claude/gra/s2.png")
        print(await pg.inner_text("#panel .stats"))
        print("ERRORS:", errs[:6])
        await b.close()
asyncio.run(main())
