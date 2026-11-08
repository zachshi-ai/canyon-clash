# 把多文件 assets 打包成单文件 HTML：内联 CSS/JS，图片转 data URI。
# 目的：规避 Android WebView 对 file:// 页面加载外部资源的限制（白屏根因）。
import base64
import json
import os
import re

BASE = '/root/.openclaw/workspace/userdata/159359199733915648/apk/app/src/main/assets'
OUT = os.path.join(BASE, 'canyon.html')

html = open(os.path.join(BASE, 'index.html'), encoding='utf-8').read()


def inline_css(m):
    path = os.path.join(BASE, m.group(1))
    with open(path, encoding='utf-8') as f:
        return '<style>\n' + f.read() + '\n</style>'


def inline_js(m):
    path = os.path.join(BASE, m.group(1))
    with open(path, encoding='utf-8') as f:
        return '<script>\n' + f.read() + '\n</script>'


html = re.sub(r'<link rel="stylesheet" href="([^"]+)">', inline_css, html)
html = re.sub(r'<script src="([^"]+)"></script>', inline_js, html)

img_dir = os.path.join(BASE, 'img')
imgs = {}
for fn in sorted(os.listdir(img_dir)):
    if not fn.endswith('.png'):
        continue
    hid = fn[len('hero_'):-len('.png')]
    with open(os.path.join(img_dir, fn), 'rb') as f:
        imgs[hid] = 'data:image/png;base64,' + base64.b64encode(f.read()).decode()

# HTML 里静态引用的图片也替换成 data URI
for hid, uri in imgs.items():
    html = html.replace('src="img/hero_%s.png"' % hid, 'src="%s"' % uri)

inject = '<script>window.IMG=' + json.dumps(imgs, ensure_ascii=False) + ';</script>\n'
# 必须在其它脚本之前定义 IMG，因此插在第一个 <script> 之前
idx = html.find('<script>')
html = html[:idx] + inject + html[idx:]

with open(OUT, 'w', encoding='utf-8') as f:
    f.write(html)

print('wrote', OUT, round(os.path.getsize(OUT) / 1024 / 1024, 2), 'MB',
      '| 外链残留:', len(re.findall(r'(?:src|href)="(?:js|css|img)/', html)))
