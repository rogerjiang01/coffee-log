// 轉角形狀（corner-shape，《03》§2.3，2026-11-19）。
// 漸進增強：不支援的瀏覽器（Safari、Firefox，含 iPhone 上所有瀏覽器）忽略，維持一般圓角。
// 守住三件事：每一類元素吃自己的 token（/dev/corners 才調得動）；正圓沒有被套上；一般卡片預設不套。

import { readFileSync } from 'node:fs'
import { createReport } from '../helpers/report.mjs'

const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')

export default function run() {
  const r = createReport('轉角形狀')

  const tokens = read('assets/css/tokens.css')
  r.section('每一類元素一個 token，預設值')
  for (const [token, value] of [
    ['--corner-card-pill', 'squircle'], ['--corner-save-button', 'squircle'], ['--corner-sheet-pill', 'squircle'],
    ['--corner-chip', 'squircle'], ['--corner-toggle', 'squircle'], ['--corner-bar', 'squircle'],
    ['--corner-card-md', 'round'], ['--corner-card-lg', 'round'],
  ]) r.check(new RegExp(`${token}: ${value};`).test(tokens), `${token}: ${value}`)
  for (const [token, value] of [['--radius-card-md', 'var(--radius-md)'], ['--radius-card-lg', 'var(--radius-lg)'], ['--radius-card-pill', 'var(--radius-pill)'], ['--radius-save-button', 'var(--radius-pill)']])
    r.check(tokens.includes(`${token}: ${value};`), `${token} 預設等於共用的值（${value}）`)
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
