// 膠囊形的轉角形狀（corner-shape，《03》§2.3，2026-11-19）。
// 漸進增強：不支援的瀏覽器（Safari、Firefox，含 iPhone 上所有瀏覽器）忽略，維持一般圓角。
// 這裡守住兩件事：膠囊形的元素都吃同一個 token；正圓與一般卡片沒有被順手套上。

import { readFileSync } from 'node:fs'
import { createReport } from '../helpers/report.mjs'

const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')

export default function run() {
  const r = createReport('膠囊形的轉角形狀')

  r.section('一個 token，膠囊形的元素都吃它')
  const tokens = read('assets/css/tokens.css')
  r.check(/--pill-corner-shape: squircle;/.test(tokens), 'tokens.css：--pill-corner-shape')
  const css = read('assets/css/main.css')
  r.check(/\.pill-corner \{\s*corner-shape: var\(--pill-corner-shape\);/.test(css), '.pill-corner 工具 class')
  r.check(/\.sheet-pill \{[^}]*corner-shape: var\(--pill-corner-shape\);/.test(css), '下拉與日期的膠囊（.sheet-pill）')
  r.check(/\.app-button--pill \{[^}]*corner-shape: var\(--pill-corner-shape\);/.test(read('components/AppButton.vue')), '表單的儲存按鈕（AppButton 的 pill）')
  r.check(/\.choice-chip \{[^}]*corner-shape: var\(--pill-corner-shape\);/.test(read('components/ChoiceChip.vue')), '風味標籤（ChoiceChip）')
  r.check(/radius === 'md' \? 'rounded-md' : 'pill-corner'/.test(read('components/AppCard.vue')), '只有一列的表單卡片（AppCard 的 pill）')
  const toggle = read('components/ToggleSwitch.vue')
  r.check((toggle.match(/class="pill-corner /g) || []).length === 2, '開關的軌道與圓鈕')
  r.check((read('components/GoalWeekCard.vue').match(/class="pill-corner /g) || []).length === 2, '每日長條的底軌與長條')

  r.section('沒有套的：正圓、一般卡片（12、24px 還沒決定）')
  for (const path of ['components/DoneButton.vue', 'components/GoalStepper.vue', 'components/IntensityPicker.vue', 'pages/index.vue'])
    r.check(!/pill-corner|corner-shape/.test(read(path)), `${path}：正圓不套`)
  r.check(!/\.rounded-(md|lg)[^{]*\{[^}]*corner-shape/.test(css) && !/--radius-(md|lg)[^;]*;\s*corner-shape/.test(tokens), '一般卡片的圓角沒有套')

  return r.finish()
}
