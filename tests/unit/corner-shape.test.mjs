// 轉角形狀（corner-shape，《03》§2.3，2026-11-19）。
// 漸進增強：不支援的瀏覽器（Safari、Firefox，含 iPhone 上所有瀏覽器）忽略，維持一般圓角。
// 守住四件事：每一類元素吃自己的 token（/dev/corners 才調得動）；值是使用者調好的那一組；
// 調整頁的預設值和 tokens.css 一致；正圓沒有被套上。

import { readFileSync } from 'node:fs'
import { createReport } from '../helpers/report.mjs'

const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')

export default function run() {
  const r = createReport('轉角形狀')

  const tokens = read('assets/css/tokens.css')
  r.section('每一類元素一個 token（2026-11-19 使用者在 /dev/corners 調好的值）')
  const values = [
    ['--corner-card-pill', 'superellipse(1.2)'], ['--corner-save-button', 'superellipse(1.2)'], ['--corner-sheet-pill', 'superellipse(1.1)'],
    ['--corner-chip', 'superellipse(1.1)'], ['--corner-toggle', 'superellipse(1.1)'], ['--corner-bar', 'superellipse(1.1)'],
    ['--corner-card-md', 'superellipse(1.1)'], ['--corner-card-lg', 'superellipse(1.1)'],
  ]
  for (const [token, value] of values) r.check(tokens.includes(`${token}: ${value};`), `${token}: ${value}`)
  for (const [token, value] of [['--radius-card-md', '24px'], ['--radius-card-lg', 'var(--radius-lg)'], ['--radius-card-pill', 'var(--radius-pill)'], ['--radius-save-button', 'var(--radius-pill)']])
    r.check(tokens.includes(`${token}: ${value};`), `${token}: ${value}`)
  r.check(tokens.includes('--radius-md: 12px;'), '--radius-md 本身維持 12px：只有總覽的卡片（AppCard 的 md）改成 24px')
  r.check(/radius="var\(--radius-card-md\)"/.test(read('pages/index.vue')) && !/radius="var\(--radius-md\)"/.test(read('pages/index.vue')),
    '總覽載入中的骨架和卡片同一個半徑')

  r.section('調整頁的預設值和 tokens.css 一致')
  const dev = read('dev/corners.vue')
  for (const [token, value] of values) {
    const k = Number(value.match(/superellipse\(([\d.]+)\)/)[1])
    r.check(new RegExp(`token: '${token}', shape: ${k}, defaultShape: ${k}`).test(dev), `dev/corners.vue：${token} 從 ${k} 開始`)
  }
  r.check(/token: '--radius-card-md', value: 24, default: 24/.test(dev), 'dev/corners.vue：總覽卡片的半徑從 24px 開始')

  r.check(!/--pill-corner-shape/.test(tokens), '共用的 --pill-corner-shape 已經拆掉')

  r.section('元件吃自己的 token')
  const css = read('assets/css/main.css')
  const card = read('components/AppCard.vue')
  for (const kind of ['md', 'lg', 'pill'])
    r.check(new RegExp(`\\.app-card--${kind} \\{\\s*border-radius: var\\(--radius-card-${kind}\\);\\s*corner-shape: var\\(--corner-card-${kind}\\);`).test(card), `AppCard 的 ${kind}`)
  r.check(/\.app-button--pill \{[^}]*border-radius: var\(--radius-save-button\);[^}]*corner-shape: var\(--corner-save-button\);/.test(read('components/AppButton.vue')), '儲存按鈕')
  r.check(/\.sheet-pill \{[^}]*corner-shape: var\(--corner-sheet-pill\);/.test(css), '下拉與日期的膠囊、分秒框（.sheet-pill）')
  r.check(/\.choice-chip \{[^}]*corner-shape: var\(--corner-chip\);/.test(read('components/ChoiceChip.vue')), '風味標籤')
  r.check(/\.corner-toggle \{\s*corner-shape: var\(--corner-toggle\);/.test(css) && (read('components/ToggleSwitch.vue').match(/class="corner-toggle /g) || []).length === 2, '開關的軌道與圓鈕')
  r.check(/\.corner-bar \{\s*corner-shape: var\(--corner-bar\);/.test(css) && (read('components/GoalWeekCard.vue').match(/class="corner-bar /g) || []).length === 2, '每日長條的底軌與長條')

  r.section('正圓不套')
  for (const path of ['components/DoneButton.vue', 'components/GoalStepper.vue', 'components/IntensityPicker.vue', 'pages/index.vue', 'pages/brews/index.vue', 'pages/beans/index.vue', 'pages/equipment/index.vue'])
    r.check(!/corner-|corner-shape/.test(read(path)), `${path}`)

  return r.finish()
}
