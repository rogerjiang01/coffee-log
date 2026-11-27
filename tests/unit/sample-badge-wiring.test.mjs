// 範例的標示（結構檢查）。標記本身的規則在 tests/db/sample-data.test.mjs。
//
// 2026-11-23 起，豆子與紀錄的「範例」寫在豆名裡（「範例-衣索比亞 耶加雪菲」，《01》§13.2）：
// 標示放在使用者可以編輯的地方，改名就會消失，不另外放標籤元件——同一個畫面上豆名與標籤會重複。
// 器材的名稱來自型錄、使用者改不了，所以器材維持標籤（《03》§4.12）。

import { readFileSync } from 'node:fs'
import { createReport } from '../helpers/report.mjs'

const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')

export default function run() {
  const r = createReport('範例的標示')

  r.section('豆子與紀錄：標示在豆名裡，不放標籤')
  const places = [
    ['pages/beans/index.vue', '豆子列表'],
    ['components/BrewCard.vue', '紀錄卡片'],
    ['components/OverviewBeanCard.vue', '總覽的最近沖煮與最高分'],
    ['pages/beans/[id]/index.vue', '豆子詳情頁'],
    ['pages/brews/[id]/index.vue', '紀錄詳情頁'],
  ]
  for (const [path, name] of places) {
    r.check(!/SampleBadge|isSample|is_sample/.test(read(path)), `${name}沒有「範例」標籤`)
  }

  r.section('器材：名稱來自型錄、改不了，維持標籤')
  r.check(/<SampleBadge\s+v-if="row\.is_sample"/.test(read('pages/equipment/index.vue')), '器材卡片有「範例」標籤')
  r.check(/:disabled="!!values\.catalog_id"/.test(read('components/EquipmentForm.vue')),
    '前提：選了型錄之後自訂名稱不能編輯（這條變了，器材的標籤要重新決定）')

  r.section('沿用既有標籤樣式，不新增顏色')
  const badge = read('components/SampleBadge.vue')
  const knownTag = /class="shrink-0 rounded-sm px-2 py-0\.5 text-sm"/
  r.check(knownTag.test(badge), '與器材的「常用」標籤同一組 class')
  r.check(/var\(--accent-wash\)/.test(badge) && /var\(--on-accent-wash\)/.test(badge),
    '用既有的語意 token，沒有新顏色')
  r.check(!/#[0-9a-f]{3,6}/i.test(badge), '沒有寫死色碼')

  r.section('is_sample 的其他用途不變')
  r.check(/\.eq\('is_sample', false\)/.test(read('composables/useBrewStats.ts')), '統計排除範例紀錄')
  r.check(/is_sample/.test(read('utils/equipment.ts')), '器材的查詢有 is_sample（標籤要用）')

  r.section('複製出來的不是範例')
  const newPage = read('pages/brews/new.vue')
  r.check(!/is_sample/.test(newPage),
    '新增紀錄時不寫 is_sample——照表單上的值新建一筆，複製來源是不是範例都一樣')

  return r.finish()
}
