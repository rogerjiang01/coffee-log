// 表單膠囊上的日期與時刻的接線（utils/formDate.ts、SelectField，《03》§4.1）。

import { readFileSync } from 'node:fs'
import { createReport } from '../helpers/report.mjs'

const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')

export default function run() {
  const r = createReport('表單膠囊上的日期與時刻的接線')

  r.section('接線：三個日期與時刻欄位都經 SelectField 顯示成膠囊')
  const brew = read('components/BrewForm.vue')
  const bean = read('components/BeanForm.vue')
  r.check(/<SelectField class="select-field--nowrap" :text="pillDate\(brewDate\) \?\? '選填'"/.test(brew), '沖煮日期')
  r.check(/<SelectField class="select-field--nowrap" :text="pillTime\(brewTime\) \?\? '選填'"/.test(brew), '沖煮時刻')
  r.check(/<SelectField class="select-field--nowrap" :text="pillDate\(values\.roast_date\) \?\? '選填'"/.test(bean), '烘焙日期')

  r.section('日期與時刻各自不斷行，兩者之間可以換行（2026-11-26，320px）')
  const mainCss = read('assets/css/main.css')
  r.check(/\.select-field--nowrap \{\s*flex-shrink: 0;/.test(mainCss) && /\.select-field--nowrap \.sheet-clamp \{\s*white-space: nowrap;\s*overflow-wrap: normal;/.test(mainCss),
    '表單的日期與時刻膠囊：膠囊裡不斷行、不縮')
  r.check(/<div class="flex min-w-0 flex-wrap items-center justify-end gap-x-2">\s*<SelectField class="select-field--nowrap" :text="pillDate\(brewDate\)/.test(brew), '沖煮日期與時刻：放不下時時刻換到下一行')
  for (const path of ['pages/brews/[id]/index.vue', 'components/SharedBrewView.vue', 'pages/brews/[id]/summary.vue']) {
    const src = read(path)
    r.check(/<span class="whitespace-nowrap">\{\{ brewedDate\(brew\.brewed_at\) \}\}<\/span> <span class="whitespace-nowrap">\{\{ brewedTime\(brew\.brewed_at\) \}\}<\/span>/.test(src)
      && !/function formatDate/.test(src), `${path}：標題下的日期與時刻各自不斷行，中間一個空格可以換行`)
  }
  const field = read('components/SelectField.vue')
  r.check(/<SheetPill v-if="text !== undefined"/.test(field), 'SelectField 給了 text 就畫 SheetPill')

  r.section('焦點框只在鍵盤操作時畫')
  r.check(/:data-keyboard-focus="keyboardFocus \|\| undefined"/.test(field) && /focused\.value && modality\.value === 'keyboard'/.test(field),
    'SelectField：聚焦而且最後一次互動是按鍵，才標成鍵盤聚焦')
  const css = read('assets/css/main.css')
  r.check(/\.select-field\[data-keyboard-focus="true"\] \.sheet-pill \{\s*outline: 2px solid var\(--accent\);/.test(css),
    '框畫在看得到的膠囊上，和全站的 :focus-visible 同一個樣子')
  const modality = read('composables/useInputModality.ts')
  r.check(/addEventListener\('pointerdown'[\s\S]*?, true\)/.test(modality),
    '點擊在整份文件的 capture 階段記錄：點列左邊的標籤也算點擊')

  return r.finish()
}
