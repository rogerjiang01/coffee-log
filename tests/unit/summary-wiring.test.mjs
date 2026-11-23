// 縮圖佔位與範例豆子的接線（結構檢查）。規則本身在 summary.test.ts。

import { readFileSync } from 'node:fs'
import { createReport } from '../helpers/report.mjs'

const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')

export default function run() {
  const r = createReport('縮圖佔位與範例豆子的接線')

  r.section('縮圖：有照片用照片，沒有照片用 roastFill（烘焙度色塊或灰色）')
  const thumb = read('components/BeanThumb.vue')
  r.check(/<img v-if="photoUrl"/.test(thumb) && /roastFill\(props\.roastLevel\)/.test(thumb), 'BeanThumb：照片，否則 roastFill')
  for (const path of ['components/BeanCard.vue', 'pages/beans/[id]/index.vue']) {
    r.check(/roastFill\(/.test(read(path)), `${path}：用同一個 roastFill（全站同一條規則）`)
  }

  // 2026-11-23：範例的標示寫在豆名裡（「範例-…」，《01》§13.2），總覽的卡片不另外放標籤
  r.section('範例豆子：標示在豆名裡，總覽的最近沖煮與最高分不放標籤')
  const home = read('pages/index.vue')
  r.check(!/SampleBadge|isSample/.test(read('components/OverviewBeanCard.vue')), '卡片：沒有「範例」標籤')
  r.check(!/:is-sample=/.test(home), '總覽不再傳是不是範例')

  return r.finish()
}
