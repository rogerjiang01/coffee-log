// 互動時間的接線（結構檢查）。計算規則本身在 interaction-time.test.ts。

import { readFileSync } from 'node:fs'
import { createReport } from '../helpers/report.mjs'

const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')

export default function run() {
  const r = createReport('記錄時間的接線')

  r.section('接線')
  const form = read('components/BrewForm.vue')
  r.check(/useInteractionTime\(\)/.test(form), '沖煮表單用互動時間')
  r.check(!/openedAt/.test(form), '不再用「表單開啟到送出」的時間差')
  r.check(/formDurationSeconds: interactionTime\.seconds\(\)/.test(form), '送出時取累計秒數')
  const composable = read('composables/useInteractionTime.ts')
  for (const name of ['input', 'change', 'pointerdown', 'keydown', 'scroll']) {
    r.check(composable.includes(`'${name}'`), `互動包含 ${name}`)
  }
  r.check(/capture: true/.test(composable), '掛在 capture 階段——teleport 出去的選單與不冒泡的捲動都收得到')
  r.check(/removeEventListener/.test(composable), '離開表單時拿掉監聽')

  r.section('只在新增時寫入')
  r.check(/form_duration_seconds: formDurationSeconds/.test(read('pages/brews/new.vue')), '新增流程寫入')
  r.check(!/form_duration_seconds\s*:/.test(read('pages/brews/[id]/edit.vue')),
    '編輯流程不寫入——量的是「記一筆要多久」，不是「維護這筆花了多久」')

  return r.finish()
}
