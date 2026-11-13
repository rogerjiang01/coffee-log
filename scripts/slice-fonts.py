# 把台北黑體（Taipei Sans TC Beta）切成 woff2 子集，並產生對應的 @font-face（《03》§8）。
# 一次性的工具，**只在本機跑**；字型換版或要改切法時才需要重跑。
#
# 用法（在專案根目錄）：
#   python3 -m venv /tmp/fonttools && /tmp/fonttools/bin/pip install fonttools brotli
#   /tmp/fonttools/bin/python scripts/slice-fonts.py
#
# fonttools 與 brotli 不是專案的相依套件，不進 package.json。
#
# 輸入：fonts-src/TaipeiSansTCBeta-{Light,Regular,Bold}.ttf
#       原始檔三個共 62 MB，**不進版本庫**（.gitignore 的 fonts-src/）。
#       來源：翰字鑄造 JT Foundry，SIL Open Font License 1.1（NOTICE.md）。
# 輸出：public/fonts/taipei-sans/v1/{light,regular,bold}-<n>.woff2（共 324 個）
#       public/fonts/taipei-sans/v1/fonts.css（@font-face，nuxt.config.ts 用 <link> 載入）
#
# **樣式表放在 public/ 而不是 assets/css/。** 放進 assets 的話它會併入全站的 CSS，
# 而 Nuxt 把全站的 CSS 直接寫進每一頁的 HTML（inlineStyles）——324 條 @font-face 約 330 KB
# （gzip 後約 100 KB），每開一頁都要重新下載一次，瀏覽器沒辦法快取。
# 獨立成檔之後只下載一次。
#
# 切法：照 Google Fonts 對 Noto Sans TC 的 unicode-range 分片（scripts/font-slices.txt，
# 108 片，取自 Google 的樣式表）。瀏覽器只下載頁面用到的那幾片，
# 而且和備援的 Noto Sans TC 是同一套分片，同一個字不會落在兩邊不同的片裡。
# 這 108 片涵蓋 12,930 個漢字；台北黑體另有約 14,600 個罕用漢字不在裡面，會走備援字型。
#
# **輸出的目錄帶版本號（v1）。** /fonts/ 底下的檔案設了一年的不可變快取（vercel.json），
# 重切之後內容不同就要換目錄名，否則已經快取的人拿不到新檔。
# 改這裡的 VERSION，並同步改 nuxt.config.ts 裡 fonts.css 的路徑。

import os
import sys

from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VERSION = 'v1'
FAMILY = 'Taipei Sans TC Beta'
WEIGHTS = [('Light', 300), ('Regular', 400), ('Bold', 700)]
OUT_DIR = os.path.join(ROOT, 'public', 'fonts', 'taipei-sans', VERSION)


def parse(unicode_range):
    cps = set()
    for part in unicode_range.split(','):
        part = part.strip().replace('U+', '')
        if '-' in part:
            a, b = part.split('-')
            cps.update(range(int(a, 16), int(b, 16) + 1))
        elif '?' in part:
            cps.update(range(int(part.replace('?', '0'), 16), int(part.replace('?', 'f'), 16) + 1))
        else:
            cps.add(int(part, 16))
    return cps


def compact(cps):
    """碼位集合 → unicode-range 字串。只宣告這一片真的有的字，沒有的字直接交給備援字型。"""
    out = []
    run = []
    for cp in sorted(cps):
        if run and cp == run[-1] + 1:
            run.append(cp)
            continue
        if run:
            out.append(run)
        run = [cp]
    if run:
        out.append(run)
    return ', '.join(f'U+{r[0]:x}' if len(r) == 1 else f'U+{r[0]:x}-{r[-1]:x}' for r in out)


def subset(src, cps, out):
    # recalcTimestamp=False：不改寫修改時間，同樣的輸入重跑會得到一模一樣的檔案
    font = TTFont(src, lazy=True, recalcTimestamp=False)
    keep = cps & set(font.getBestCmap())
    if not keep:
        return keep
    options = Options()
    options.flavor = 'woff2'
    options.hinting = False
    options.layout_features = ['*']
    # 0 著作權、13 授權、14 授權網址：OFL 要求每一份副本都帶著
    options.name_IDs = [0, 1, 2, 4, 6, 13, 14]
    options.notdef_outline = True
    subsetter = Subsetter(options)
    subsetter.populate(unicodes=sorted(keep))
    subsetter.subset(font)
    font.flavor = 'woff2'
    font.save(out)
    return keep


def main():
    with open(os.path.join(ROOT, 'scripts', 'font-slices.txt'), encoding='utf8') as f:
        slices = [parse(line) for line in f if line.strip()]
    os.makedirs(OUT_DIR, exist_ok=True)

    rules = []
    for name, weight in WEIGHTS:
        src = os.path.join(ROOT, 'fonts-src', f'TaipeiSansTCBeta-{name}.ttf')
        if not os.path.exists(src):
            sys.exit(f'找不到 {src}')
        total = 0
        for i, cps in enumerate(slices):
            file = f'{name.lower()}-{i}.woff2'
            out = os.path.join(OUT_DIR, file)
            keep = subset(src, cps, out)
            if not keep:
                continue
            total += os.path.getsize(out)
            rules.append(
                '@font-face {\n'
                f'  font-family: "{FAMILY}";\n'
                '  font-style: normal;\n'
                f'  font-weight: {weight};\n'
                '  font-display: swap;\n'
                f'  src: url("{file}") format("woff2");\n'
                f'  unicode-range: {compact(keep)};\n'
                '}\n'
            )
        print(name, round(total / 1024), 'KB')

    header = (
        '/* 台北黑體（Taipei Sans TC Beta）的 @font-face。\n'
        '   **由 scripts/slice-fonts.py 產生，不要手改**——要改切法或字重，改腳本後重跑。\n'
        '   url() 是相對路徑，woff2 和這個檔案放在同一個目錄。\n'
        '\n'
        '   三個字重（Light 300、Regular 400、Bold 700）各切成 108 片，瀏覽器依 unicode-range\n'
        '   只下載頁面用到的那幾片。沒有 500：Medium 用的是 Noto Sans TC（tokens.css 的\n'
        '   --font-body-medium），因為台北黑體沒有這個字重。\n'
        '   字型授權：SIL Open Font License 1.1（NOTICE.md、public/fonts/taipei-sans/OFL.txt）。 */\n\n'
    )
    with open(os.path.join(OUT_DIR, 'fonts.css'), 'w', encoding='utf8') as f:
        f.write(header + '\n'.join(rules))
    print('rules', len(rules))


if __name__ == '__main__':
    main()
