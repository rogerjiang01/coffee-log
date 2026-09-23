// 圖示的實際線寬（《03》§3）：兩級，以渲染後的粗細為準。
//
// 同一個 stroke-width 畫在不同格線、縮放到不同尺寸，實際粗細會差到兩倍——
// 盤點時量到 1.83、2、1.5、1.2、0.88 五種，後兩個是沒人決定過的異常值。
// 這裡逐一用「stroke-width × 顯示寬 ÷ viewBox 寬」驗算，而不是比對寫在檔案裡的數字。

import { readFileSync } from 'node:fs'
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
  ['‹ 返回／離開', 'components/BackButton.vue', 'm15 18-6-6 6-6', 2, 2],
  ['器材選擇器的 ‹', 'components/EquipmentPicker.vue', 'm15 18-6-6 6-6', 2, 1],
  ['設定齒輪', 'pages/index.vue', 'r="3"', 2, 1],
  ['器材選擇器的 ＋', 'components/EquipmentPicker.vue', 'M5 12h14', 2, 1],
  ['浮動按鈕的 ＋（首頁）', 'pages/index.vue', 'M5 12h14', 2, 1],
  ['浮動按鈕的 ＋（豆子）', 'pages/beans/index.vue', 'M5 12h14', 2, 1],
  ['浮動按鈕的 ＋（器材）', 'pages/equipment/index.vue', 'M5 12h14', 2, 1],
  ['分享', 'components/ShareIcon.vue', 'm16 6-4-4-4 4', 2, 1],
  // 內容區的小圖示：1.5px
  ['分段的 ×', 'components/PourStepsEditor.vue', 'M18 6 6 18', 1.5, 1],
  ['⌄ 收合區', 'components/CollapsibleSection.vue', 'm6 9 6 6 6-6', 1.5, 1],
  ['⌄ 原生下拉', 'components/SelectField.vue', 'm6 9 6 6 6-6', 1.5, 1],
  ['⌄ 豆子下拉', 'components/BeanSelect.vue', 'm6 9 6 6 6-6', 1.5, 1],
  ['⌄ 產國下拉', 'components/CountrySelect.vue', 'm6 9 6 6 6-6', 1.5, 1],
  ['⌄ 型號下拉', 'components/CatalogSelect.vue', 'm6 9 6 6 6-6', 1.5, 1],
  ['⌄ 處理法／品種下拉', 'components/LookupSelect.vue', 'm6 9 6 6 6-6', 1.5, 1],
  ['› 器材欄位', 'components/EquipmentTrigger.vue', 'm9 18 6-6-6-6', 1.5, 1],
  ['攪拌標記', 'components/StirIcon.vue', 'M12 14v7', 1.5, 1],
  ['暫存中（sync）', 'components/DraftStatus.vue', 'M18 3v4h-4', 1.5, 1],
  ['已暫存（打勾）', 'components/DraftStatus.vue', 'M20 6 9 17l-5-5', 1.5, 1],
  // 收藏愛心：四個尺寸都要落在 1.5px。換成 Lucide 之前四處寫的都是 1.5，
  // 但顯示寬不同（16／18／24），實際線寬因此散成 1.0、1.125、1.5 三種。
  ['愛心（表單）', 'components/BrewForm.vue', HEART, 1.5, 1],
  ['愛心（時間軸）', 'components/BrewTimelineItem.vue', HEART, 1.5, 1],
  ['愛心（比較表）', 'components/BeanCompareTable.vue', HEART, 1.5, 1],
  ['愛心（紀錄詳情）', 'pages/brews/[id]/index.vue', HEART, 1.5, 1],
  // 星等：表單 24px、詳情頁 20px，兩處都要落在 1.5px。
  // 換成 Lucide 之前兩處都寫 1.5，詳情頁那個實際只有 1.25
  ['星等（表單）', 'components/StarRating.vue', STAR, 1.5, 1],
  ['星等（紀錄詳情）', 'pages/brews/[id]/index.vue', STAR, 1.5, 1],
  // 分享頁與紀錄詳情頁同一組尺寸
  ['星等（分享頁）', 'components/SharedBrewView.vue', STAR, 1.5, 1],
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
    ['pages/beans/index.vue', 'M5 12h14'],
    ['pages/equipment/index.vue', 'M5 12h14'],
    ['pages/index.vue', 'r="3"'],
    ['components/PourStepsEditor.vue', 'M18 6 6 18'],
    ['components/EquipmentTrigger.vue', 'm9 18 6-6-6-6'],
    ['components/ShareIcon.vue', 'm16 6-4-4-4 4'],
    ['components/BrewForm.vue', HEART],
    ['components/BrewTimelineItem.vue', HEART],
    ['components/BeanCompareTable.vue', HEART],
    ['pages/brews/[id]/index.vue', HEART],
    ['components/StarRating.vue', STAR],
    ['pages/brews/[id]/index.vue', STAR],
    ['components/DraftStatus.vue', 'M20 6 9 17l-5-5'],
    ['components/BrewShare.vue', 'M20 6 9 17l-5-5'],
    ['components/SharedBrewView.vue', STAR],
    ['components/SharedBrewView.vue', HEART],
    ['components/CollapsibleSection.vue', 'm6 9 6 6 6-6'],
    ['components/SelectField.vue', 'm6 9 6 6 6-6'],
    ['components/BeanSelect.vue', 'm6 9 6 6 6-6'],
    ['components/CountrySelect.vue', 'm6 9 6 6 6-6'],
    ['components/CatalogSelect.vue', 'm6 9 6 6 6-6'],
    ['components/LookupSelect.vue', 'm6 9 6 6 6-6'],
  ]
  for (const [file, marker] of LUCIDE) {
    const svgs = svgsWith(read(file), marker)
    r.check(svgs.length > 0 && svgs.every(s => /viewBox="0 0 24 24"/.test(s)),
      `${file}：${marker.slice(0, 12)}… 的 viewBox 是 24`)
  }

  r.section('未選取的輸入元件輪廓用 --control-empty，不得退回 --border')
  // --border 是分隔線的顏色（sand-100，白底 1.23:1）。畫在「可以按」的東西上
  // 淡到看不見，使用者看不出那裡還有五個可點的目標。
  // --control-empty 本身是 sand-400（2.48:1），刻意低於 3:1——那是《03》§2.2
  // 寫明的取捨，這裡守的是「不要再往下退」，不是 3:1
  const empty = [
    ['components/StarRating.vue', '星等（表單）'],
    ['pages/brews/[id]/index.vue', '星等（紀錄詳情）'],
    ['components/BrewForm.vue', '收藏愛心（表單）'],
    ['components/IntensityPicker.vue', '強度圓點'],
    ['components/SharedBrewView.vue', '星等（分享頁）'],
    ['components/ToggleSwitch.vue', '開關的關閉軌道（已喝完）'],
    ['components/BrewShare.vue', '勾選框（分享對話框）'],
  ]
  for (const [file, name] of empty) {
    const src = read(file)
    r.check(/:\s*'var\(--control-empty\)'/.test(src), `${name}：未選取用 --control-empty`)
    r.check(!/>=\s*level\s*\?[^\n]*'var\(--border\)'/.test(src) && !/is_favorite\s*\?[^\n]*'var\(--border\)'/.test(src),
      `${name}：沒有退回 --border`)
    r.check(/--control-empty/.test(src), `${name}：檔案裡確實引用了 --control-empty`)
  }
  const tokenCss = read('assets/css/tokens.css')
  r.check(/--control-empty:\s*var\(--sand-400\);/.test(tokenCss),
    '--control-empty 是 sand-400（白底 2.48:1，刻意低於 3:1，《03》§2.2）')
  r.check(!/--control-empty:\s*var\(--(border|sand-100|sand-50)\)/.test(tokenCss), '--control-empty 沒有指回 --border 的色階')
  r.check(/^\| `--control-empty` \|[^\n]*`sand-400`[^\n]*刻意低於 3:1/m.test(read('docs/03-介面規範.md')),
    '《03》§2.2 寫明這是刻意的取捨，不會被當成缺陷改回去')

  r.section('圖示來源有記在 repo 裡')
  const notice = read('NOTICE.md')
  r.check(/Lucide/.test(notice) && /ISC License/.test(notice), 'NOTICE.md 記了 Lucide 與 ISC License')
  r.check(/Lucide/.test(read('docs/03-介面規範.md')), '《03》§3 註明圖示來源')

  r.section('字級下限（《03》§2.4）')
  const tokens = read('assets/css/tokens.css')
  r.check(/--text-xs:\s*var\(--text-sm\);/.test(tokens), '--text-xs 併入 --text-sm')
  r.check(/--text-sm:\s*0\.875rem;/.test(tokens), '--text-sm 是 0.875rem（14px）')
  r.check(!/--text-[a-z0-9]+:\s*0\.[0-7]\d*rem/.test(tokens), '沒有任何字級小於 0.875rem')

  return r.finish()
}
