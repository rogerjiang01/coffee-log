// 「範例」標籤的接線（結構檢查）。標記本身的規則在 tests/db/sample-data.test.mjs。

import { readFileSync } from 'node:fs'
import { createReport } from '../helpers/report.mjs'

const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')

export default function run() {
  const r = createReport('範例標籤的接線')

  r.section('四個位置都顯示')
  const places = [
    ['components/BeanCard.vue', '豆子卡片（列表）'],
    ['components/HomeBeanCard.vue', '豆子卡片（首頁橫向）'],
    ['components/BrewTimelineItem.vue', '紀錄卡片（首頁時間軸）'],
    ['pages/equipment/index.vue', '器材卡片'],
    ['pages/beans/[id]/index.vue', '豆子詳情頁'],
    ['pages/brews/[id]/index.vue', '紀錄詳情頁'],
  ]
  for (const [path, name] of places) {
    r.check(/<SampleBadge\s+v-if=/.test(read(path)), `${name}有「範例」標籤`)
  }

  r.section('沿用既有標籤樣式，不新增顏色')
  const badge = read('components/SampleBadge.vue')
  const knownTag = /class="shrink-0 rounded-sm px-2 py-0\.5 text-xs"/
  r.check(knownTag.test(badge), '與器材的「常用」標籤同一組 class')
  r.check(/var\(--accent-wash\)/.test(badge) && /var\(--on-accent-wash\)/.test(badge),
    '用既有的語意 token，沒有新顏色')
  r.check(!/#[0-9a-f]{3,6}/i.test(badge), '沒有寫死色碼')

  r.section('查詢要把 is_sample 帶回來')
  const queries = [
    ['pages/beans/index.vue', '豆子列表'],
    ['pages/index.vue', '首頁'],
    ['pages/beans/[id]/index.vue', '豆子詳情'],
    ['pages/brews/[id]/index.vue', '紀錄詳情'],
    ['utils/equipment.ts', '器材（共用的欄位定義）'],
  ]
  for (const [path, name] of queries) {
    r.check(/is_sample/.test(read(path)), `${name}的查詢有 is_sample`)
  }

  r.section('複製出來的不是範例')
  const newPage = read('pages/brews/new.vue')
  r.check(!/is_sample/.test(newPage),
    '新增紀錄時不寫 is_sample——照表單上的值新建一筆，複製來源是不是範例都一樣')

  return r.finish()
}
