// 記錄分段時間的開關（結構檢查）。
//
// 最容易出錯的是「開關關閉 → 時間欄位不顯示 → 儲存時被清空」。
// 資料層的保留在 brew-steps.test.ts 以純函式驗過；這裡守住開關只碰顯示：
// 沒有任何地方依開關去改 steps、沒有任何存檔路徑讀開關。
// 另外守住「有沒有記錄時間」只有 hasStepTiming 一個判斷來源。

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { createReport } from '../helpers/report.mjs'

const root = new URL('../../', import.meta.url)
const read = path => readFileSync(new URL(path, root), 'utf8')
const count = (text, pattern) => (text.match(pattern) || []).length

function sourceFiles(dir) {
  const out = []
  for (const name of readdirSync(new URL(dir, root))) {
    const path = `${dir}/${name}`
    if (statSync(new URL(path, root)).isDirectory()) out.push(...sourceFiles(path))
    else if (/\.(vue|ts)$/.test(name)) out.push(path)
  }
  return out
}

export default function run() {
  const r = createReport('記錄分段時間的開關')

  r.section('編輯器：開關只決定顯不顯示')
  const editor = read('components/PourStepsEditor.vue')
  const holdBlock = (editor.match(/<div v-if="showTimes[\s\S]*?<\/div>\s*<\/div>/) || [''])[0]
  r.check(/step-hold-/.test(holdBlock), '停留欄位在 v-if="showTimes…" 裡——關閉時整格不出現')
  r.check(/注完之後停了幾秒再注下一段/.test(holdBlock), '輔助說明也在同一格裡，關閉時一起消失')
  r.check(/<label[^>]*>停留<\/label>/.test(editor), '標籤仍是「停留」——咖啡圈的通用說法，不改')
  r.check(count(editor, /holdSeconds:/g) === 1,
    '編輯器只在使用者輸入時寫 holdSeconds（整份檔案只有那一處），不會因為欄位藏起來而清掉它')

  r.section('表單：不依開關去動 steps')
  const form = read('components/BrewForm.vue')
  r.check(/:show-times="recordStepTimes"/.test(form), 'BrewForm 把偏好交給編輯器')
  r.check(count(form, /\brecordStepTimes\b/g) === 2,
    'recordStepTimes 只出現在取得偏好與傳給編輯器兩處——沒有依它改寫 steps 或 holdSeconds 的程式')
  for (const page of ['pages/brews/new.vue', 'pages/brews/[id]/edit.vue']) {
    r.check(!/recordStepTimes|useRecordStepTimes|record_step_times/.test(read(page)),
      `${page} 的存檔路徑不讀開關——時間照樣原樣存進 hold_seconds`)
  }
  r.check(/export function toStepRows\(steps: StepInput\[\]\): StepRow\[\]/.test(read('utils/brewSteps.ts')),
    'toStepRows 沒有開關參數：存檔的換算與開關無關')

  r.section('偏好：預設關閉，存在 profiles')
  const pref = read('composables/useRecordStepTimes.ts')
  r.check(/const enabled = ref\(false\)/.test(pref), '還沒讀到之前當成關閉，與預設一致')
  r.check(/from\('profiles'\)[\s\S]*?update\(\{ record_step_times: next \}/.test(pref), '寫進 profiles.record_step_times')
  const migration = read('supabase/migrations/20260911100000_profile_record_step_times.sql')
  r.check(/add column record_step_times boolean not null default false/.test(migration), 'migration：預設 false')

  r.section('設定頁')
  const settings = read('pages/settings.vue')
  r.check(/role="switch"/.test(settings) && /:aria-checked="recordStepTimes"/.test(settings), '開關有 switch 語意與狀態')
  r.check(/記錄分段時間/.test(settings) && /進階參數。停水時間會影響各段風味在口中的比重。/.test(settings),
    '標題與說明文字照規格，說明只講它是什麼')
  r.check(/:disabled="!prefLoaded \|\| prefSaving"/.test(settings),
    '讀到設定之前不可按——否則會拿預設的「關」蓋掉已經打開的人')

  r.section('「有沒有記錄時間」只有一個判斷來源')
  const sources = [...sourceFiles('components'), ...sourceFiles('pages'), ...sourceFiles('utils'), ...sourceFiles('composables')]
  const offenders = sources
    .filter(path => path !== 'utils/brewSteps.ts')
    .filter(path => /\.(every|some)\([^)]*hold_seconds/.test(read(path)))
  r.check(offenders.length === 0,
    `沒有別的檔案自己判斷停留是不是全為 null，一律走 hasStepTiming${offenders.length ? `：${offenders.join('、')}` : ''}`)
  r.check(/hasStepTiming\(/.test(read('utils/brewDiff.ts')), '差異計算走 hasStepTiming')

  r.section('換算層已經移除，不要加回來')
  // 舊模型：資料庫存累積時間點（time_offset），介面的「停留」含注水時間。
  // 那個定義兩位實機測試者都填不出來，換算層連同測試一起拿掉了。
  // utils/brewSteps.ts 的檔頭刻意留著這段歷史（說明為什麼不要把換算加回來），
  // 所以只檢查它以外的檔案有沒有真的在用這個欄位
  const leftovers = sources
    .filter(path => path !== 'utils/brewSteps.ts')
    .filter(path => /time_offset/.test(read(path)))
  r.check(leftovers.length === 0,
    `除了 brewSteps 檔頭的歷史說明，程式碼裡不再有 time_offset${leftovers.length ? `：${leftovers.join('、')}` : ''}`)
  r.check(/export function toStepInputs\(rows: StepRow\[\]\): StepInput\[\]/.test(read('utils/brewSteps.ts')),
    'toStepInputs 只吃分段列，沒有 total_time 參數——最後一段不再從總時間反推')
  r.check(/hold_seconds: index === filled\.length - 1 \? null : step\.holdSeconds/.test(read('utils/brewSteps.ts')),
    'toStepRows 原樣寫入停留秒數，最後一段一律 null')
  r.check(/index < modelValue\.length - 1/.test(read('components/PourStepsEditor.vue')),
    '編輯器最後一段不顯示停留欄位')
  r.check(/注完之後停了幾秒再注下一段/.test(read('components/PourStepsEditor.vue')),
    '輔助說明描述的是斷水時間，不是舊定義的「到下一段注水前的時間」')

  return r.finish()
}
