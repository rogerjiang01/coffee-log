// 全域 CSS 裡幾條「刪掉不會報錯」的規則。
//
// 這是文字比對，不是行為驗證。收在測試裡的理由是失效方式太安靜：
// 規則被順手刪掉時畫面不會 crash、console 不會有訊息，
// 只是所有浮層默默跑到左上角。

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { createReport } from '../helpers/report.mjs'

export default function run() {
  const r = createReport('全域 CSS 的關鍵規則')
  const css = readFileSync(new URL('../../assets/css/main.css', import.meta.url), 'utf8')

  r.section('浮層置中')
  // 註解裡也會出現「dialog:modal」這幾個字，要抓的是真正的規則區塊
  const at = css.search(/dialog:modal\s*\{/)
  r.check(at !== -1, 'main.css 裡有 dialog:modal 規則')
  const rule = at === -1 ? '' : css.slice(at, css.indexOf('}', at))

  // 這裡刻意不用 margin: auto 置中。那個機制有三個前提（瀏覽器補齊四邊
  // inset、height 是確定值、margin 沒被蓋掉），preflight 打掉第三項，
  // 瀏覽器差異打掉前兩項，結果是「左右置中、上下貼齊上緣」。
  // 改成 dialog 自己撐滿視窗當置中容器，只用普遍支援的屬性。
  r.check(/display:\s*flex/.test(rule), 'flex 置中——不依賴 margin auto 的餘量分配')
  r.check(/align-items:\s*center/.test(rule), '垂直置中')
  r.check(/justify-content:\s*center/.test(rule), '水平置中')
  r.check(/height:\s*100%/.test(rule),
    'height: 100% 撐滿視窗——對 position: fixed 而言相對視窗，不需要瀏覽器補 inset')
  r.check(!/margin:\s*auto/.test(rule) && !/fit-content/.test(rule),
    '不再依賴 margin: auto 與 fit-content——那兩者正是先前失敗的原因')
  r.check(/background:\s*transparent/.test(rule), 'dialog 本身透明，卡片樣式在內層')

  const innerAt = css.search(/dialog:modal\s*>\s*\*\s*\{/)
  const inner = innerAt === -1 ? '' : css.slice(innerAt, css.indexOf('}', innerAt))
  r.check(/max-height:\s*100%/.test(inner), '內層卡片不超過容器高度')
  r.check(/overflow:\s*auto/.test(inner), '內層卡片自己捲——超長內容不會被裁掉')

  r.section('全螢幕面板')
  const sheetAt = css.search(/dialog:modal\.sheet\s*\{/)
  r.check(sheetAt !== -1, '.sheet 變體存在——器材選擇器靠它取得焦點鎖定與 Esc')

  r.section('焦點可見（§7）')
  // 不依賴瀏覽器預設的 focus ring：各家畫法不同，在暖底色上有的幾乎看不出來
  const fv = css.search(/(?<![.\w-]):focus-visible\s*\{/)
  r.check(fv !== -1, '有全站的 :focus-visible 規則')
  const fvRule = fv === -1 ? '' : css.slice(fv, css.indexOf('}', fv))
  r.check(/outline:\s*2px solid var\(--accent\)/.test(fvRule), '焦點框用強調色，不是瀏覽器預設')
  r.check(/outline-offset/.test(fvRule),
    '有 outline-offset——沒有這道縫，疊在 --accent 底色上的按鈕焦點框會融進去')

  r.section('動態偏好')
  r.check(/prefers-reduced-motion/.test(css),
    'prefers-reduced-motion 的全域規則還在（《03》§6 要求）')

  r.section('提示色是三層裡的中間那層（《03》§4.1）')
  // --danger 只代表「這樣送不出去」，--text-muted 是一直都在的參考資訊。
  // 針對輸入值出現、但存得起來的提示需要自己一層，否則不是被當成錯誤，
  // 就是混進參考資訊裡被自動略過。
  const tokens = readFileSync(new URL('../../assets/css/tokens.css', import.meta.url), 'utf8')
  r.check(/--notice:\s*var\(--sand-700\)/.test(tokens), '--notice 取 sand-700')
  r.check(/--color-notice:\s*var\(--notice\)/.test(css), '接到 Tailwind theme 上')
  r.check(!/--notice:\s*var\(--(red|ink)/.test(tokens), '不是紅色也不是中性灰')

  const grind = readFileSync(new URL('../../components/GrindSettingInput.vue', import.meta.url), 'utf8')
  r.section('刻度提示的位置與顏色')
  const referenceLine = (grind.match(/<FormNote v-if="showReference"[\s\S]*?<\/FormNote>/) || [''])[0]
  r.check(/v-if="notice"/.test(referenceLine),
    '提示在參考資訊那一行裡面——分開一行就跟參考資訊長得一樣')
  r.check(/var\(--notice\)/.test(referenceLine), '用 --notice')
  r.check(!/var\(--danger\)/.test(grind),
    '不用 --danger——這個值存得起來，紅色會讓人以為存不起來')
  r.check(/whitespace-nowrap/.test(referenceLine),
    '整段不斷行：中文預設可在任兩字之間換行，會斷成「超出磨豆機刻」＋「度範圍」')
  r.check(!/這台的刻度到|這台的刻度從/.test(grind), '舊的定義句文案已經拿掉')

  r.section('間隔不符與範圍提示同位置、同顏色')
  r.check(!/incrementNotice|rangeNotice/.test(grind), '不再分兩種提示各自擺放')
  r.check((grind.match(/<FormNote\b/g) || []).length === 2,
    '只剩參考資訊與型錄備註兩個段落——間隔不符不再獨立一行')

  r.section('換到第二行時貼齊左緣')
  // ml-3 會跟著換行的那段一起走，只有提示縮排 12px。
  // column-gap 只作用在同一行的兩段之間
  // 2026-11-16：這一行改由 .form-note 排（卡片下方的小字），同樣是 flex-wrap 加 column-gap
  r.check(/\.form-note \{[^}]*flex-wrap: wrap;[^}]*column-gap: 0\.5rem;/.test(css), '.form-note 用 flex-wrap ＋ column-gap')
  r.check(!/ml-\d/.test(referenceLine), '第一行裡沒有任何 ml-*')

  r.section('字體：台北黑體沒有 500，Medium 要連字體一起換（《03》§2.4）')
  // 只設 font-weight: 500 的話，瀏覽器會在台北黑體裡挑最接近的 400，畫面上完全沒有變化，
  // 也不會報錯——比較表的差異標記、分頁列的目前分頁都靠這個字重。
  r.check(/--font-body:\s*"Taipei Sans TC Beta",\s*"Noto Sans TC"/.test(tokens), '--font-body 以台北黑體為首，Noto Sans TC 補字')
  r.check(/--font-body-medium:\s*"Noto Sans TC"/.test(tokens), '--font-body-medium 是 Noto Sans TC')
  r.check(/--font-heading:\s*var\(--font-body-medium\)/.test(tokens) && !/Noto Serif/.test(tokens.replace(/\/\*[\s\S]*?\*\//g, '')),
    '--font-heading 指到 Noto Sans TC Medium，不再有 Noto Serif TC')
  r.check(/@utility font-medium\s*\{\s*font-family:\s*var\(--font-body-medium\)/.test(css), 'font-medium 同時切換字體')
  r.check(!/font-serif/.test(css), 'main.css 不再有 font-serif 的對應與規則（41 處都換成 Figma 的文字樣式了）')
  const vue = dir => readdirSync(new URL(`../../${dir}`, import.meta.url), { recursive: true })
    .filter(name => String(name).endsWith('.vue')).map(name => `${dir}/${name}`)
  const bare = [...vue('components'), ...vue('pages'), 'app.vue', 'error.vue'].flatMap((path) => {
    const lines = readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8').split('\n')
    return lines.flatMap((line, i) =>
      /font-?[wW]eight:\s*[^,;}\n]*\b500\b/.test(line) && !/font-body-medium/.test(`${line}\n${lines[i + 1] ?? ''}\n${lines[i + 2] ?? ''}`)
        ? [`${path}:${i + 1}`]
        : [])
  })
  r.check(bare.length === 0, `直接寫字重 500 的地方都一起指定了 --font-body-medium${bare.length ? `（漏掉：${bare.join('、')}）` : ''}`)

  r.section('字型載入（《03》§8）')
  const config = readFileSync(new URL('../../nuxt.config.ts', import.meta.url), 'utf8')
  const google = config.match(/fonts\.googleapis\.com\/css2\?[^'"]*/)?.[0] ?? ''
  r.check(/family=Noto\+Sans\+TC:wght@500&display=swap$/.test(google), 'Google Fonts 只載入 Noto Sans TC 500，display=swap')
  r.check(!/Serif/.test(google), '不再載入 Noto Serif TC')
  const sheet = config.match(/href:\s*'(\/fonts\/taipei-sans\/[^']+\/fonts\.css)'/)?.[1]
  r.check(sheet !== undefined, '台北黑體的 @font-face 用 <link> 載入（不併進全站 CSS：那份會被寫進每一頁的 HTML）')
  const sheetUrl = new URL(`../../public${sheet ?? '/missing'}`, import.meta.url)
  r.check(existsSync(sheetUrl), `${sheet} 存在`)
  const faces = existsSync(sheetUrl) ? readFileSync(sheetUrl, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').split('@font-face').slice(1) : []
  r.check(faces.length === 324, `324 條 @font-face（三個字重各 108 片），實際 ${faces.length}`)
  r.check(faces.every(face => /font-display:\s*swap/.test(face)), '每一條都是 font-display: swap')
  r.check(faces.every((face) => {
    const file = face.match(/url\("([^"]+)"\)/)?.[1]
    return file !== undefined && existsSync(new URL(file, sheetUrl))
  }), '每一條指到的 woff2 都存在')
  r.check(!/@font-face/.test(css) && !/fonts\.css/.test(css), 'main.css 沒有把 @font-face 併進來')
  const vercel = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'))
  r.check((vercel.headers ?? []).some(h => h.source === '/fonts/(.*)' && h.headers.some(x => /immutable/.test(x.value))),
    '/fonts/ 設了不可變快取——沒有的話每次開頁面都要重新驗證字型檔，字會閃一次')

  r.section('字型原始檔不進版本庫')
  const ignore = readFileSync(new URL('../../.gitignore', import.meta.url), 'utf8')
  r.check(/^fonts-src\/$/m.test(ignore), '.gitignore 有 fonts-src/')
  const raw = readdirSync(new URL('../../public', import.meta.url), { recursive: true }).filter(name => /\.(ttf|otf|ttc)$/i.test(String(name)))
  r.check(raw.length === 0, `public/ 底下沒有 TTF／OTF 原始檔${raw.length ? `（${raw.join('、')}）` : ''}`)

  r.section('文字輸入的游標用強調色（《03》§4.1）')
  r.check(/input,\s*textarea,\s*\[contenteditable\]\s*\{\s*caret-color:\s*var\(--accent\)/.test(css), 'caret-color: var(--accent)')

  r.section('綠底模式（《03》§2.2）')
  const green = tokens.slice(tokens.search(/\n\.theme-green\s*\{/))
  r.check(/--bg:\s*var\(--green-500\)/.test(green) && /--accent:\s*var\(--sand-50\)/.test(green) && /--on-accent:\s*var\(--green-800\)/.test(green),
    '.theme-green 重新定義底色、強調色與強調色上的文字')
  for (const page of ['pages/login.vue', 'pages/signup.vue']) {
    r.check(/useHead\(\{ htmlAttrs: \{ class: 'theme-green' \} \}\)/.test(readFileSync(new URL(`../../${page}`, import.meta.url), 'utf8')),
      `${page} 把 theme-green 掛在 <html> 上`)
  }

  r.section('開場與登入頁（《03》§6 的開場動畫）')
  const splash = readFileSync(new URL('../../composables/useSplash.ts', import.meta.url), 'utf8')
  const app = readFileSync(new URL('../../app.vue', import.meta.url), 'utf8')
  const overlay = readFileSync(new URL('../../components/AppSplash.vue', import.meta.url), 'utf8')
  const shell = readFileSync(new URL('../../components/AuthShell.vue', import.meta.url), 'utf8')
  r.check(/if \(!import\.meta\.server\) return null/.test(splash) && /path === '\/' \? 'app' : path === '\/login' \? 'login' : null/.test(splash),
    '只在打開 App 時出現：由伺服器看網址決定，/ 與 /login 以外都沒有')
  r.check(/COVER_COUNT = 4/.test(splash) && /`\/splash\/v1\/cover-\$\{index\}\.webp`/.test(splash), '首圖四張，放在帶版本號的目錄')
  r.check(/rel: 'preload', as: 'image', href: coverUrl\(splash\.cover\.value\)/.test(app), '伺服器把挑到的那一張預先載入')
  r.check(/<AppSplash v-if="splash\.mode\.value === 'app'" \/>/.test(app), '已登入的開場蓋在總覽上')
  r.check(/const MIN_MS = 300/.test(overlay) && /const MAX_MS = 800/.test(overlay), '已登入：最少 0.3 秒、最多 0.8 秒')
  r.check(/splashReady\.value = true/.test(readFileSync(new URL('../../pages/index.vue', import.meta.url), 'utf8')), '總覽的資料到了就通知開場可以淡出')
  r.check(/const intro = ref\(mode\.value === 'login'\)/.test(shell) && /@media \(prefers-reduced-motion: reduce\)[\s\S]*translate: none/.test(shell),
    '未登入：登入頁自己演；減少動態時不做位移')
  r.check(/\.splash-fade \{\s*transition-duration: 200ms !important;/.test(css), '減少動態時保留淡入淡出')
  r.check(/--splash-bg:\s*var\(--green-800\)/.test(tokens) && /html\.splash-on \{\s*background-color: var\(--splash-bg\)/.test(css), '開場期間頁面底色是深綠，避免白閃')
  r.check(!/#[0-9a-f]{3,6}\b/i.test(overlay + shell + readFileSync(new URL('../../components/BrandLogo.vue', import.meta.url), 'utf8')), '沒有寫死的色碼')
  r.check(vercel.headers.some(h => h.source === '/(splash|brand)/(.*)' && h.headers.some(x => /immutable/.test(x.value))), '首圖與 logo 設了不可變快取')

  return r.finish()
}
