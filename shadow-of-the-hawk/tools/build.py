#!/usr/bin/env python3
"""Збирає dist/<name>.html з src/template.html + assets/ (все вшивається назад у base64)."""
import base64, json, re, sys, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
name = sys.argv[1] if len(sys.argv) > 1 else 'shadow-of-the-hawk.html'
manifest = json.loads((root / 'assets' / 'manifest.json').read_text(encoding='utf8'))
tpl = (root / 'src' / 'template.html').read_text(encoding='utf8')
def sub(m):
    e = manifest[m.group(1)]
    data = (root / 'assets' / e['file']).read_bytes()
    return f"data:{e['mime']};base64,{base64.b64encode(data).decode()}"
out = re.sub(r'@@ASSET:([0-9a-f]{12})@@', sub, tpl)
(root / 'dist').mkdir(exist_ok=True)
(root / 'dist' / name).write_text(out, encoding='utf8')
print(f'dist/{name}: {len(out)/1e6:.2f} МБ')
