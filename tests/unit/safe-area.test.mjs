// 安全區（2026-11-25，《03》§3「安全區」）。
//
// 原本 viewport 沒有 viewport-fit=cover，env(safe-area-inset-*) 在 iPhone 上一律是 0：
// 加到主畫面全螢幕開啟時，分頁列壓在底部的橫線（home indicator）上，幾乎點不到——
// 程式裡寫了 env(safe-area-inset-bottom)，看起來有處理，其實沒有作用，畫面上也看不出原因。
//
// 加上之後頁面鋪到瀏海、home indicator 與橫向的左右兩側底下，各處要自己避開。
// Playwright 模擬不出安全區，這裡守住「每一處都有寫」，實際的樣子要在 iPhone 上看。

import { readFileSync } from 'node:fs'
import { createReport } from '../helpers/report.mjs'

const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')

export default function run() {
  const r = createReport('安全區')

  r.section('viewport-fit=cover：沒有它 env() 一律是 0')
  const config = read('nuxt.config.ts')
  r.check(/viewport: 'width=device-width, initial-scale=1, viewport-fit=cover'/.test(config), 'nuxt.config.ts 的 viewport 有 viewport-fit=cover')
  r.check(/'apple-mobile-web-app-status-bar-style', content: 'default'/.test(config),
    '狀態列維持 default：加到主畫面時頁面從狀態列下面開始（改成 black-translucent 要重新檢查頂端）')

  r.section('頁面：上與左右由 body 留，下由各頁留')
  const css = read('assets/css/main.css')
  r.check(/body \{[^}]*padding: env\(safe-area-inset-top\) env\(safe-area-inset-right\) 0 env\(safe-area-inset-left\);/.test(css),
    'body 讓出狀態列與橫向的左右兩側')
  const auth = read('components/AuthShell.vue')
  r.check(/\.auth \{\s*(?:\/\*[\s\S]*?\*\/\s*)?(?:--intro-move: [^;]+;\s*)?margin: calc\(-1 \* env\(safe-area-inset-top\)\) calc\(-1 \* env\(safe-area-inset-right\)\) 0 calc\(-1 \* env\(safe-area-inset-left\)\);/.test(auth)
    && /padding:\s*calc\(18dvh \+ env\(safe-area-inset-top\)\)\s*calc\(var\(--form-gutter\) \+ env\(safe-area-inset-right\)\)\s*calc\(2rem \+ env\(safe-area-inset-bottom\)\)\s*calc\(var\(--form-gutter\) \+ env\(safe-area-inset-left\)\);/.test(auth),
    '登入、註冊：首圖鋪滿安全區，logo 與表單往內縮')
  r.check(/paddingBottom: 'max\(2\.5rem, calc\(env\(safe-area-inset-bottom\) \+ 0\.75rem\)\)'/.test(read('pages/goal.vue')),
    '目標設定頁貼底的「開始」：安全區之上至少 12px')

  r.section('固定在畫面上的東西')
  const tokens = read('assets/css/tokens.css')
  r.check(/--tab-bar-bottom: max\(12px, calc\(env\(safe-area-inset-bottom\) - 14px\)\);/.test(tokens),
    '分頁列：iPhone（安全區 34）下緣 20，對齊 iOS 原生的浮動分頁列；沒有安全區與橫向 12')
  r.check(/--fixed-left: calc\(env\(safe-area-inset-left\) \+ max\(/.test(tokens) && /--fixed-right: calc\(env\(safe-area-inset-right\) \+ max\(/.test(tokens),
    '分頁列、浮動按鈕、分享提示的左右：避開橫向的瀏海')
  r.check(/dialog:modal \{[^}]*padding:\s*max\(1\.25rem, env\(safe-area-inset-top\)\)\s*max\(1\.25rem, env\(safe-area-inset-right\)\)\s*max\(1\.25rem, env\(safe-area-inset-bottom\)\)\s*max\(1\.25rem, env\(safe-area-inset-left\)\);/.test(css),
    '置中的對話框：離螢幕邊緣 20px，安全區比較大時取安全區')
  r.check(/dialog:modal\.sheet > \* \{[^}]*padding: env\(safe-area-inset-top\) env\(safe-area-inset-right\) env\(safe-area-inset-bottom\) env\(safe-area-inset-left\);/.test(css),
    '全螢幕面板（器材選擇器、分段子頁、裁切）：底色鋪滿，標題列與底部的按鈕往內縮')
  const zoom = read('components/PhotoZoom.vue')
  r.check(['top', 'right', 'bottom', 'left'].every(side => zoom.includes(`max(1.25rem, env(safe-area-inset-${side}))`)), '照片放大：四邊（原本就有）')
  const panel = read('composables/useAnchoredPanel.ts')
  r.check(/window\.innerHeight,\s*safeAreaBottom\(\),/.test(panel) && /height:env\(safe-area-inset-bottom\)/.test(panel),
    '下拉的浮層往下開時停在 home indicator 之上')

  return r.finish()
}
