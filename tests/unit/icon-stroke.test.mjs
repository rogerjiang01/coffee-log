// 圖示的實際線寬（《03》§3）：兩級，以渲染後的粗細為準。
//
// 同一個 stroke-width 畫在不同格線、縮放到不同尺寸，實際粗細會差到兩倍——
// 盤點時量到 1.83、2、1.5、1.2、0.88 五種，後兩個是沒人決定過的異常值。
// 這裡逐一用「stroke-width × 顯示寬 ÷ viewBox 寬」驗算，而不是比對寫在檔案裡的數字。

import { readFileSync, readdirSync } from 'node:fs'
import { createReport } from '../helpers/report.mjs'

const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')

/** 檔案裡所有含 marker 的 <svg>…</svg> */
function svgsWith(text, marker) {
  return [...text.matchAll(/<svg[\s\S]*?<\/svg>/g)].map(m => m[0]).filter(svg => svg.includes(marker))
}

function rendered(svg) {
  const width = Number(svg.match(/\swidth="([\d.]+)"/)[1])
  const viewBox = Number(svg.match(/viewBox="0 0 ([\d.]+)/)[1])
  const strokes = [...svg.matchAll(/stroke-width="([\d.]+)"/g)].map(m => Number(m[1]))
  return strokes.map(stroke => stroke * width / viewBox)
}

const HEART = 'M2 9.5a5.5 5.5 0 0 1 9.591-3.676'
const STAR = 'M11.525 2.295a.53.53 0 0 1 .95 0'

const ICONS = [
  // 頂部導覽與主要動作：2px
  ['‹ 返回／離開', 'components/BackButton.vue', 'm15 18-6-6 6-6', 2, 1],
  ['器材選擇器的 ‹', 'components/EquipmentPicker.vue', 'm15 18-6-6 6-6', 2, 1],
  ['設定齒輪', 'pages/index.vue', 'r="3"', 2, 1],
  ['器材選擇器的 ＋', 'components/EquipmentPicker.vue', 'M5 12h14', 2, 1],
  ['浮動按鈕的 ＋（總覽）', 'pages/index.vue', 'M5 12h14', 2, 1],
  ['浮動按鈕的 ＋（紀錄）', 'pages/brews/index.vue', 'M5 12h14', 2, 1],
  ['浮動按鈕的 ＋（豆子）', 'pages/beans/index.vue', 'M5 12h14', 2, 1],
  ['浮動按鈕的 ＋（器材）', 'pages/equipment/index.vue', 'M5 12h14', 2, 1],
  ['分享', 'components/ShareIcon.vue', 'm16 6-4-4-4 4', 2, 1],
  // 數量加減與完成（2026-10-06 加進《03》§3 的圖示表）
  ['數量加減的 − 與 ＋', 'components/GoalStepper.vue', 'M5 12h14', 2, 2],
  // 2026-11-17：結算頁與分段子頁共用 DoneButton
  ['完成（結算頁與分段子頁的勾勾）', 'components/DoneButton.vue', 'M20 6 9 17l-5-5', 2, 1],
  // 內容區的小圖示：1.5px
  // 2026-11-13：分段的移除從 × 改成垃圾桶（Lucide trash-2，《03》§3）
  ['分段的垃圾桶', 'components/PourStepsSheet.vue', 'M3 6h18', 1.5, 1],
  ['⌄ 收合區', 'components/CollapsibleSection.vue', 'm6 9 6 6 6-6', 1.5, 1],
  // 2026-11-13：下拉與器材欄位改成膠囊，沒有 ⌄ 與 › 了（照 Figma 的 Sheet Row）；收合區的 ⌄ 還在
  ['› 卡片標題列', 'components/AppCard.vue', 'm9 18 6-6-6-6', 1.5, 1],
  ['暫存中（Lucide refresh-cw）', 'components/DraftStatus.vue', 'M21 3v5h-5', 1.5, 1],
  ['已暫存（打勾）', 'components/DraftStatus.vue', 'M20 6 9 17l-5-5', 1.5, 1],
  // 收藏愛心：四個尺寸都要落在 1.5px。換成 Lucide 之前四處寫的都是 1.5，
  // 但顯示寬不同（16／18／24），實際線寬因此散成 1.0、1.125、1.5 三種。
  ['愛心（時間軸）', 'components/BrewTimelineItem.vue', HEART, 1.5, 1],
  ['愛心（比較表）', 'components/BeanCompareTable.vue', HEART, 1.5, 1],
  ['愛心（紀錄詳情）', 'pages/brews/[id]/index.vue', HEART, 1.5, 1],
  // 星等：表單 24px、詳情頁 20px，兩處都要落在 1.5px。
  // 換成 Lucide 之前兩處都寫 1.5，詳情頁那個實際只有 1.25
  ['星等（表單）', 'components/StarRating.vue', STAR, 1.5, 1],
  // 分享頁與紀錄詳情頁同一組尺寸
  ['愛心（分享頁）', 'components/SharedBrewView.vue', HEART, 1.5, 1],
  ['勾選框的打勾（分享對話框）', 'components/BrewShare.vue', 'M20 6 9 17l-5-5', 1.5, 1],
]

export default function run() {
  const r = createReport('圖示的實際線寬')

  for (const [name, file, marker, expected, count] of ICONS) {
    const svgs = svgsWith(read(file), marker)
    r.check(svgs.length === count, `${name}：找到 ${count} 個`)
    for (const svg of svgs) {
      const widths = rendered(svg)
      r.check(widths.length > 0 && widths.every(w => Math.abs(w - expected) < 0.02),
        `${name}：實際線寬 ${expected}px（算出 ${widths.map(w => w.toFixed(2)).join('、')}）`)
      r.check(/stroke-linecap="round"/.test(svg), `${name}：圓頭線端`)
    }
  }

  r.section('顯示用的星等（StarDisplay）')
  const starDisplay = read('components/StarDisplay.vue')
  r.check(/\(1\.5 \* 24\) \/ props\.size/.test(starDisplay) && /:stroke-width="strokeWidth"/.test(starDisplay) && /stroke-linecap="round"/.test(starDisplay),
    '線寬依顯示尺寸換算，固定落在 1.5px')
  r.check(/'var\(--favorite\)' : 'var\(--control-inactive\)'/.test(starDisplay), '未選是實心的 --control-inactive（和表單一致）')
  r.check(/viewBox="0 0 24 24"/.test(starDisplay), 'Lucide 的 24 格線')
  for (const path of ['pages/brews/[id]/index.vue', 'components/SharedBrewView.vue', 'components/OverviewBeanCard.vue']) {
    r.check(/<StarDisplay /.test(read(path)), `${path}：顯示用的星等走 StarDisplay`)
  }

  r.section('尺寸')
  const size = svg => Number(svg.match(/\swidth="([\d.]+)"/)[1])
  r.check(svgsWith(read('components/BackButton.vue'), 'm15 18-6-6 6-6').every(s => size(s) === 22), '‹ 22×22')
  r.check(svgsWith(read('pages/index.vue'), 'r="3"').every(s => size(s) === 22), '齒輪 22×22')
  r.check(svgsWith(read('components/DraftStatus.vue'), 'viewBox').every(s => size(s) === 16),
    '暫存狀態的圖示 16px（原本 14px，比旁邊文字的筆畫還細）')

  r.section('Lucide 圖示一律是 24 格線')
  // viewBox 與 stroke-width 要一起改。只改其中一個，線寬會默默差 1.5 倍而且畫面上看不出來
  const LUCIDE = [
    ['components/BackButton.vue', 'm15 18-6-6 6-6'],
    ['components/EquipmentPicker.vue', 'm15 18-6-6 6-6'],
    ['components/EquipmentPicker.vue', 'M5 12h14'],
    ['pages/index.vue', 'M5 12h14'],
    ['pages/brews/index.vue', 'M5 12h14'],
    ['pages/beans/index.vue', 'M5 12h14'],
    ['pages/equipment/index.vue', 'M5 12h14'],
    ['pages/index.vue', 'r="3"'],
    ['components/PourStepsSheet.vue', 'M3 6h18'],
    ['components/AppCard.vue', 'm9 18 6-6-6-6'],
    ['components/ShareIcon.vue', 'm16 6-4-4-4 4'],
    ['components/BrewTimelineItem.vue', HEART],
    ['components/BeanCompareTable.vue', HEART],
    ['pages/brews/[id]/index.vue', HEART],
    ['components/StarRating.vue', STAR],
    ['components/DraftStatus.vue', 'M20 6 9 17l-5-5'],
    ['components/DraftStatus.vue', 'M21 3v5h-5'],
    ['components/BrewShare.vue', 'M20 6 9 17l-5-5'],
    ['components/SharedBrewView.vue', HEART],
    ['components/CollapsibleSection.vue', 'm6 9 6 6 6-6'],
  ]
  for (const [file, marker] of LUCIDE) {
    const svgs = svgsWith(read(file), marker)
    r.check(svgs.length > 0 && svgs.every(s => /viewBox="0 0 24 24"/.test(s)),
      `${file}：${marker.slice(0, 12)}… 的 viewBox 是 24`)
  }

  r.section('未選取的輪廓用 --control-empty，不得退回 --border')
  // --border 是分隔線的顏色（stone-100，卡片上 1.16:1）。畫在「可以按」的東西上
  // 淡到看不見，使用者看不出那裡還有五個可點的目標。
  // --control-empty 本身是 stone-400（2.45:1），刻意低於 3:1——那是《03》§2.2
  // 寫明的取捨，這裡守的是「不要再往下退」，不是 3:1
  const empty = [
    ['components/BrewShare.vue', '勾選框（分享對話框）'],
  ]
  for (const [file, name] of empty) {
    const src = read(file)
    r.check(/:\s*'var\(--control-empty\)'/.test(src), `${name}：未選取用 --control-empty`)
    r.check(!/>=\s*level\s*\?[^\n]*'var\(--border\)'/.test(src) && !/is_favorite\s*\?[^\n]*'var\(--border\)'/.test(src),
      `${name}：沒有退回 --border`)
    r.check(/--control-empty/.test(src), `${name}：檔案裡確實引用了 --control-empty`)
  }
  // 表單裡的強度圓點、星等與開關照 Figma：未選是**實心**的 --control-inactive（2026-11-13 決定，《03》§2.2）。
  // 已選與未選的明度差夠大（圓點 3.88:1），而且數值由「從左數來深色幾個」表達，不只靠色相。
  // 這裡守兩件事：用的是 --control-inactive，以及沒有退回 --border（1.16:1，看不見）。
  const strip = src => src.replace(/<!--[\s\S]*?-->/g, '').replace(/^\s*\/\/.*$/gm, '')
  const dots = strip(read('components/IntensityPicker.vue'))
  r.check(/>= level \? 'var\(--accent\)' : 'var\(--control-inactive\)'/.test(dots) && !/--border\)'|--control-empty/.test(dots),
    '強度圓點：未選是實心的 --control-inactive')
  const stars = strip(read('components/StarRating.vue'))
  r.check((stars.match(/>= level \? 'var\(--favorite\)' : 'var\(--control-inactive\)'/g) || []).length === 2 && !/--control-empty|transparent/.test(stars),
    '星等（表單）：未選的填色與線條都是 --control-inactive（實心）')
  const toggle = strip(read('components/ToggleSwitch.vue'))
  r.check(/modelValue \? 'var\(--accent\)' : 'var\(--control-inactive\)'/.test(toggle) && /var\(--control-thumb\)/.test(toggle) && !/--control-empty/.test(toggle),
    '開關（ToggleSwitch）：關閉的軌道是 --control-inactive，圓鈕是 --control-thumb')
  r.check(/minHeight: 'var\(--touch-min\)'/.test(toggle) && /min-height: var\(--touch-min\)/.test(read('components/IntensityPicker.vue')) && /minHeight: 'var\(--touch-min\)'/.test(stars),
    '開關、圓點、星等的可點範圍都至少 44px')
  const tokenCss = read('assets/css/tokens.css')
  r.check(/--control-empty:\s*var\(--stone-400\);/.test(tokenCss),
    '--control-empty 是 stone-400（卡片上 2.45:1，刻意低於 3:1，《03》§2.2）')
  r.check(!/--control-empty:\s*var\(--(border|stone-50|stone-100|sand-100|sand-50)\)/.test(tokenCss), '--control-empty 沒有指回 --border 的色階')
  r.check(/^\| `--control-empty` \|[^\n]*`stone-400`[^\n]*刻意低於 3:1/m.test(read('docs/03-介面規範.md')),
    '《03》§2.2 寫明這是刻意的取捨，不會被當成缺陷改回去')

  r.section('圖示來源有記在 repo 裡')
  const notice = read('NOTICE.md')
  r.check(/Lucide/.test(notice) && /ISC License/.test(notice), 'NOTICE.md 記了 Lucide 與 ISC License')
  r.check(/Lucide/.test(read('docs/03-介面規範.md')), '《03》§3 註明圖示來源')

  r.section('字級下限（《03》§2.4）')
  // 2026-11-11 起分兩種畫面：有輸入欄位的畫面維持 14px；沒有輸入欄位的瀏覽型與檢視型畫面，
  // 次要資訊可以到 12px。12px 只有 text-label-m 這一個名字——text-xs 仍然是 14px，
  // 既有的 text-xs 不會無聲縮小。
  const tokens = read('assets/css/tokens.css')
  r.check(/--text-xs:\s*var\(--text-sm\);/.test(tokens), '--text-xs 併入 --text-sm（不是 12px）')
  r.check(/--text-sm:\s*var\(--text-body-m\);/.test(tokens) && /--text-body-m:\s*0\.875rem;/.test(tokens),
    '--text-sm 指到 Body M，Body M 是 0.875rem（14px）')
  const sizes = [...tokens.matchAll(/--text-([a-z0-9-]+):\s*(\d*\.?\d+)rem;/g)].map(m => [m[1], Number(m[2])])
  r.check(sizes.length >= 12, `讀到 ${sizes.length} 個字級`)
  const small = sizes.filter(([, rem]) => rem < 0.875).map(([name]) => name).sort()
  r.check(small.join(',') === 'body-s,label-l,label-m', `小於 14px 的只有 body-s、label-l、label-m（實際：${small.join('、')}）`)
  r.check(sizes.every(([, rem]) => rem >= 0.75), '沒有任何字級小於 0.75rem（12px）')

  // 「有輸入欄位就維持 14px」的機械版：檔案裡有輸入欄位或浮層的，不得使用那三個小於 14px 的樣式。
  // 另外明列四個沒有原生輸入欄位、但規格指定維持 14px 的畫面。
  // 這是下限的防線，不是完整的判斷——共用元件被放進表單時，仍要靠人看。
  const SMALL = /\btext-(body-s|label-l|label-m)\b/
  const HAS_INPUT = /<(input|textarea|select|dialog)\b/
  const KEEP_14 = ['pages/brews/[id]/summary.vue', 'pages/goal.vue', 'pages/login.vue', 'pages/signup.vue']
  const vue = dir => readdirSync(new URL(`../../${dir}`, import.meta.url), { recursive: true })
    .filter(name => String(name).endsWith('.vue')).map(name => `${dir}/${name}`)
  const all = [...vue('components'), ...vue('pages'), 'app.vue', 'error.vue']
  r.check(all.length > 40, `掃了 ${all.length} 個 .vue`)
  const offenders = all.filter((path) => {
    const src = read(path).replace(/<!--[\s\S]*?-->/g, '')
    return SMALL.test(src) && (HAS_INPUT.test(src) || KEEP_14.includes(path))
  })
  r.check(offenders.length === 0, `有輸入欄位或浮層的檔案、結算頁、目標設定頁、登入、註冊都沒有小於 14px 的樣式${offenders.length ? `（違反：${offenders.join('、')}）` : ''}`)
  for (const path of KEEP_14) r.check(all.includes(path), `${path} 存在（明列的畫面沒有被改名）`)

  return r.finish()
}
