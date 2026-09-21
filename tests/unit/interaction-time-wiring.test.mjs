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
  r.check(/const duration = interactionTime\.measure\(\)/.test(form), '送出時取累計秒數')
  r.check(/formDurationSeconds: duration\.total/.test(form), '總耗時取自同一次量測')
  const composable = read('composables/useInteractionTime.ts')
  for (const name of ['input', 'change', 'pointerdown', 'keydown', 'scroll']) {
    r.check(composable.includes(`'${name}'`), `互動包含 ${name}`)
  }
  r.check(/capture: true/.test(composable), '掛在 capture 階段——teleport 出去的選單與不冒泡的捲動都收得到')
  r.check(/removeEventListener/.test(composable), '離開表單時拿掉監聽')
  r.check(!/visibilitychange/.test(composable),
    '不另外聽 visibilitychange——切到背景就是一個長間隔，由門檻處理，多記一次互動反而讓那段被算進去')

  r.section('參數與品飲的區段標記（《01》§9.1）')
  r.check(/paramsDurationSeconds: duration\.params/.test(form) && /tastingDurationSeconds: duration\.tasting/.test(form),
    '兩段的秒數跟著送出一起往上傳')
  r.check(/data-section="params"[\s\S]*?FormCard title="器材" data-section="params"/.test(form)
    || /FormCard title="器材" data-section="params"/.test(form), '器材卡片標成參數')
  r.check(/FormCard title="沖煮" data-section="params"/.test(form), '沖煮卡片標成參數——粉重、水溫、手法、分段、沖煮時間都在裡面')
  r.check(/FormCard title="喝起來" data-section="tasting"/.test(form), '喝起來卡片標成品飲——強度、風味標籤、心得、星等都在裡面')
  r.check(/<FormRow data-section="params">\s*<BeanSelect/.test(form), '豆子標成參數')
  r.check(/<FormRow data-section="other">[\s\S]{0,200}for="brew-at"/.test(form), '沖煮日期標成 other——只計入總耗時')
  r.check(/data-section="tasting"[\s\S]{0,200}values\.is_favorite/.test(form), '收藏標成品飲')
  r.check(/closest\('\[data-section\]'\)/.test(composable), '區段由事件目標往上找 data-section')

  r.section('只在新增時寫入')
  const newPage = read('pages/brews/new.vue')
  const editPage = read('pages/brews/[id]/edit.vue')
  r.check(/form_duration_seconds: formDurationSeconds/.test(newPage), '新增流程寫入')
  r.check(/params_duration_seconds: paramsDurationSeconds/.test(newPage)
    && /tasting_duration_seconds: tastingDurationSeconds/.test(newPage), '兩個區段欄位也在新增流程寫入')
  r.check(!/form_duration_seconds\s*:/.test(editPage),
    '編輯流程不寫入——量的是「記一筆要多久」，不是「維護這筆花了多久」')
  r.check(!/params_duration_seconds\s*:/.test(editPage) && !/tasting_duration_seconds\s*:/.test(editPage),
    '兩個區段欄位在編輯流程同樣不寫入，比照 form_duration_seconds')

  return r.finish()
}
