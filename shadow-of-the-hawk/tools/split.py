#!/usr/bin/env python3
"""Розбирає однофайловий білд: base64-ресурси -> assets/, решта -> src/template.html з плейсхолдерами."""
import base64, hashlib, json, re, sys, pathlib
EXT = {'image/png': 'png', 'image/webp': 'webp', 'video/webm': 'webm', 'image/jpeg': 'jpg', 'image/gif': 'gif'}
MIN_LEN = 2000  # дрібні data-URI (Phaser) лишаємо в коді
root = pathlib.Path(__file__).resolve().parent.parent
src = pathlib.Path(sys.argv[1]).read_text(encoding='utf8')
pat = re.compile(r'data:([a-z]+/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)')
manifest = {}
def sub(m):
    mime, b64 = m.group(1), m.group(2)
    if len(b64) < MIN_LEN or mime not in EXT:
        return m.group(0)
    raw = base64.b64decode(b64)
    if base64.b64encode(raw).decode() != b64:
        return m.group(0)  # неканонічний base64 — не чіпаємо, щоб збірка була ідентичною
    h = hashlib.sha1(raw).hexdigest()[:12]
    name = f'{h}.{EXT[mime]}'
    (root / 'assets' / name).write_bytes(raw)
    manifest[h] = {'file': name, 'mime': mime}
    return f'@@ASSET:{h}@@'
out = pat.sub(sub, src)
(root / 'src').mkdir(exist_ok=True)
(root / 'src' / 'template.html').write_text(out, encoding='utf8')
(root / 'assets' / 'manifest.json').write_text(json.dumps(manifest, indent=1, sort_keys=True), encoding='utf8')
print(f'ассетів: {len(manifest)}, шаблон: {len(out)/1e6:.2f} МБ')
