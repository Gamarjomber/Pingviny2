"""Перетворює авторські спрайти (assets-src/*_src.png, різний масштаб пікселя) у ігровий розмір.
Кадри одного персонажа ділять спільний масштаб і кадр, щоб анімація не стрибала.
Запуск: python3 scripts/build_sprites.py  → src/assets/sprites/<name>_<frame>.png"""
import glob, os, re
from collections import defaultdict
from PIL import Image

# name: цільова висота/ширина (більша сторона спільного bbox), px
TARGETS = {'warrior': 20, 'eagle': 24, 'mouse': 14}
COLORS = {}
SRC, OUT = 'assets-src', 'src/assets/sprites'
os.makedirs(OUT, exist_ok=True)

def quantize(img, colors=5):
    """Авторські спрайти мають десятки відтінків від згладжування: зводимо до кількох кольорів."""
    px = img.load()
    opaque = [(x, y) for y in range(img.height) for x in range(img.width) if px[x, y][3]]
    cols = {px[x, y][:3] for x, y in opaque}
    if len(cols) <= colors: return img
    rgb = Image.new('RGB', img.size, (0, 0, 0))
    rgb.putdata([px[x, y][:3] if px[x, y][3] else (0, 0, 0) for y in range(img.height) for x in range(img.width)])
    q = rgb.quantize(colors=colors, method=Image.MAXCOVERAGE).convert('RGB')
    qp = q.load(); out = img.copy(); op = out.load()
    for x, y in opaque: op[x, y] = (*qp[x, y], 255)
    return out


groups = defaultdict(list)
for f in sorted(glob.glob(f'{SRC}/*_src.png')):
    m = re.match(r'(.+)_(\d+)_src\.png', os.path.basename(f))
    groups[m.group(1)].append((int(m.group(2)), Image.open(f).convert('RGBA')))

for name, frames in groups.items():
    # спільний bbox усіх кадрів
    boxes = [im.getbbox() for _, im in frames]
    x0 = min(b[0] for b in boxes); y0 = min(b[1] for b in boxes)
    x1 = max(b[2] for b in boxes); y1 = max(b[3] for b in boxes)
    w, h = x1 - x0, y1 - y0
    k = TARGETS[name] / max(w, h)
    S = TARGETS[name]
    nw, nh = max(1, round(w * k)), max(1, round(h * k))
    palette = sorted({p[:3] for _, im in frames for p in im.getdata() if p[3] > 200})
    for idx, im in frames:
        crop = im.crop((x0, y0, x1, y1))
        small = crop.resize((nw, nh), Image.BOX)
        out = Image.new('RGBA', (S, S), (0, 0, 0, 0))
        px = small.load(); op = out.load()
        ox, oy = (S - nw) // 2, S - nh  # низ спрайта на низі кадру
        for y in range(nh):
            for x in range(nw):
                r, g, b, a = px[x, y]
                if a < 128: continue
                best = min(palette, key=lambda c: (c[0]-r)**2 + (c[1]-g)**2 + (c[2]-b)**2)
                op[ox + x, oy + y] = (*best, 255)
        out = quantize(out, COLORS.get(name, 5))
        out.save(f'{OUT}/{name}_{idx}.png')
        print(name, idx, (nw, nh), '->', S)


# ---------------------------------------------------------------- варіанти (перефарбування)
def load(n): return Image.open(f'{OUT}/{n}.png').convert('RGBA')

def recolor(img, mapping):
    out = img.copy(); px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            c = px[x, y]
            if c[3] and c[:3] in mapping: px[x, y] = (*mapping[c[:3]], 255)
    return out

def hexc(h): return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

# ---------------------------------------------------------------- коти: рідні 64x64 + перефарбування
import colorsys
CATS = ['knight', 'swordsman', 'archer', 'mage', 'priest']
# зсуви відтінку (частка кола) для двох додаткових варіантів на клас
HUE_SHIFTS = {'knight': (0.33, -0.28), 'swordsman': (0.12, -0.35), 'archer': (0.45, -0.2), 'mage': (0.55, 0.3), 'priest': (0.25, -0.4)}

def hue_shift(img, d):
    out = img.copy(); px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if not a: continue
            h, sat, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if sat < 0.12 or v < 0.22: continue  # сірі (ніж, щит), очі лишаються
            r2, g2, b2 = colorsys.hsv_to_rgb((h + d) % 1.0, min(1, sat * 1.15), v)
            px[x, y] = (round(r2 * 255), round(g2 * 255), round(b2 * 255), a)
    return out

for n in CATS:
    base = Image.open(f'{SRC}/cats/{n}.png').convert('RGBA')
    if n == 'archer': base = quantize(base, 18)
    base.save(f'{OUT}/{n}_0.png')
    for vi, d in enumerate(HUE_SHIFTS[n], start=1):
        hue_shift(base, d).save(f'{OUT}/{n}_v{vi}_0.png')
print('cats:', CATS)
