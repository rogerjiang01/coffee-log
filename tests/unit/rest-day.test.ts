// 養豆天數的寫法（utils/roast.ts 的 restDayLabel；《04》「養豆天數」）。
// 紀錄詳情、分享頁、結算頁共用這一個函式，三處的寫法才不會分岔。

import { restDayLabel, restDays } from '../../utils/roast.ts'
import { createReport } from '../helpers/report.mjs'

export default function run() {
  const r = createReport('養豆天數的寫法')

  r.section('restDayLabel')
  r.check(restDayLabel(null) === null, '算不出來（null）：不顯示')
  r.check(restDayLabel(undefined) === null, 'undefined：不顯示')
  r.check(restDayLabel(-1) === null, '負數（沖煮日期早於烘焙日期）：不顯示')
  r.check(restDayLabel(0) === '烘焙當天', `0：「烘焙當天」（${restDayLabel(0)}）`)
  r.check(restDayLabel(1) === '養豆第 1 天', `1：「養豆第 1 天」（${restDayLabel(1)}）`)
  r.check(restDayLabel(12) === '養豆第 12 天', `12：「養豆第 12 天」（${restDayLabel(12)}）`)

  r.section('和 restDays 接起來')
  const at = (y: number, m: number, d: number, h = 9) => new Date(y, m - 1, d, h)
  r.check(restDayLabel(restDays('2026-11-22', at(2026, 11, 22))) === '烘焙當天', '烘焙當天沖：「烘焙當天」')
  r.check(restDayLabel(restDays('2026-11-10', at(2026, 11, 22))) === '養豆第 12 天', '11/10 烘焙、11/22 沖：「養豆第 12 天」')
  r.check(restDayLabel(restDays('2026-11-23', at(2026, 11, 22))) === null, '烘焙日期在沖煮日期之後：不顯示')
  r.check(restDayLabel(restDays(null, at(2026, 11, 22))) === null, '沒有烘焙日期：不顯示')

  return r.finish()
}
