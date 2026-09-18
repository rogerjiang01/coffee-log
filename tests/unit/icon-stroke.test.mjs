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

const ICONS = [
  // 頂部導覽與主要動作：2px
  ['‹ 返回／離開', 'components/BackButton.vue', 'M15 5l-7 7 7 7', 2, 2],
  ['器材選擇器的 ‹', 'components/EquipmentPicker.vue', 'M15 5l-7 7 7 7', 2, 1],
  ['設定齒輪', 'pages/index.vue', 'r="3"', 2, 1],
  ['器材選擇器的 ＋', 'components/EquipmentPicker.vue', 'M12 5v14M5 12h14', 2, 1],
  ['浮動按鈕的 ＋（首頁）', 'pages/index.vue', 'M12 5v14M5 12h14', 2, 1],
  ['浮動按鈕的 ＋（豆子）', 'pages/beans/index.vue', 'M12 5v14M5 12h14', 2, 1],
  ['浮動按鈕的 ＋（器材）', 'pages/equipment/index.vue', 'M12 5v14M5 12h14', 2, 1],
  // 內容區的小圖示：1.5px
  ['分段的 ×', 'components/PourStepsEditor.vue', 'M4 4l8 8M12 4l-8 8', 1.5, 1],
  ['⌄ 收合區', 'components/CollapsibleSection.vue', 'M3 6l5 5 5-5', 1.5, 1],
  ['⌄ 原生下拉', 'components/SelectField.vue', 'M3 6l5 5 5-5', 1.5, 1],
  ['⌄ 豆子下拉', 'components/BeanSelect.vue', 'M3 6l5 5 5-5', 1.5, 1],
  ['⌄ 產國下拉', 'components/CountrySelect.vue', 'M3 6l5 5 5-5', 1.5, 1],
  ['⌄ 型號下拉', 'components/CatalogSelect.vue', 'M3 6l5 5 5-5', 1.5, 1],
  ['⌄ 處理法／品種下拉', 'components/LookupSelect.vue', 'M3 6l5 5 5-5', 1.5, 1],
  ['› 器材欄位', 'components/EquipmentTrigger.vue', 'M6 3l5 5-5 5', 1.5, 1],
  ['攪拌標記', 'components/StirIcon.vue', 'M12 14v7', 1.5, 1],
  ['暫存中（sync）', 'components/DraftStatus.vue', 'M18 3v4h-4', 1.5, 1],
  ['已暫存（打勾）', 'components/DraftStatus.vue', 'M5 12.5l4.5 4.5L19 7.5', 1.5, 1],
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
  r.check(svgsWith(read('components/BackButton.vue'), 'M15 5l-7 7 7 7').every(s => size(s) === 22), '‹ 22×22')
  r.check(svgsWith(read('pages/index.vue'), 'r="3"').every(s => size(s) === 22), '齒輪 22×22')
  r.check(svgsWith(read('components/DraftStatus.vue'), 'viewBox').every(s => size(s) === 16),
    '暫存狀態的圖示 16px（原本 14px，比旁邊文字的筆畫還細）')

  r.section('字級下限（《03》§2.4）')
  const tokens = read('assets/css/tokens.css')
  r.check(/--text-xs:\s*var\(--text-sm\);/.test(tokens), '--text-xs 併入 --text-sm')
  r.check(/--text-sm:\s*0\.875rem;/.test(tokens), '--text-sm 是 0.875rem（14px）')
  r.check(!/--text-[a-z0-9]+:\s*0\.[0-7]\d*rem/.test(tokens), '沒有任何字級小於 0.875rem')

  return r.finish()
}
