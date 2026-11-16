// 縮圖佔位與範例標籤的接線（結構檢查）。規則本身在 summary.test.ts。

import { readFileSync } from 'node:fs'
import { createReport } from '../helpers/report.mjs'

const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')

export default function run() {
  const r = createReport('縮圖佔位與範例標籤的接線')

  r.section('縮圖：有照片用照片，沒有照片用 roastFill（烘焙度色塊或灰色）')
  const thumb = read('components/BeanThumb.vue')
  r.check(/<img v-if="photoUrl"/.test(thumb) && /roastFill\(props\.roastLevel\)/.test(thumb), 'BeanThumb：照片，否則 roastFill')
  for (const path of ['components/BeanCard.vue', 'pages/beans/[id]/index.vue']) {
    r.check(/roastFill\(/.test(read(path)), `${path}：用同一個 roastFill（全站同一條規則）`)
  }

  r.section('範例豆子的標籤：總覽的最近沖煮與最高分')
  const home = read('pages/index.vue')
  r.check((read('components/OverviewBeanCard.vue').match(/\{\{ name \}\}<\/span>\s*<SampleBadge v-if="isSample" \/>/g) ?? []).length === 2, '卡片：範例豆子在豆名同一行加標籤')
  r.check(/:is-sample="last\.bean\.is_sample"/.test(home) && /:is-sample="top\.brew\.beans\?\.is_sample"/.test(home), '最近沖煮與最高分都帶入是不是範例')
  r.check(/beans \( name, photo_path, roast_level, is_finished, is_sample \)/.test(read('composables/useBrewStats.ts')), '統計帶回豆子是不是範例')

  return r.finish()
}
