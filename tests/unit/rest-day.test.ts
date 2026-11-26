// 養豆天數的寫法（utils/roast.ts 的 restDayLabel；《04》「養豆天數」）。
// 紀錄詳情、分享頁、結算頁共用這一個函式，三處的寫法才不會分岔。

import { restDayLabel, restDayValue, restDays } from '../../utils/roast.ts'
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

  r.section('restDayValue（結算頁的小數據列：標籤「養豆」，值「N 天」）')
  r.check(restDayValue(null) === null && restDayValue(undefined) === null && restDayValue(-1) === null, '顯示條件和 restDayLabel 相同：算不出來、負數都不顯示')
  r.check(restDayValue(0) === '烘焙當天', `0：「烘焙當天」（${restDayValue(0)}）`)
  r.check(restDayValue(12) === '12 天', `12：「12 天」（${restDayValue(12)}）`)
  for (const days of [null, undefined, -3, 0, 1, 40]) {
    r.check((restDayLabel(days) === null) === (restDayValue(days) === null), `同一個判斷：${String(days)} 時兩者${restDayLabel(days) === null ? '都不顯示' : '都顯示'}`)
  }

  r.section('和 restDays 接起來')
  const at = (y: number, m: number, d: number, h = 9) => new Date(y, m - 1, d, h)
  r.check(restDayLabel(restDays('2026-11-22', at(2026, 11, 22))) === '烘焙當天', '烘焙當天沖：「烘焙當天」')
  r.check(restDayLabel(restDays('2026-11-10', at(2026, 11, 22))) === '養豆第 12 天', '11/10 烘焙、11/22 沖：「養豆第 12 天」')
  r.check(restDayLabel(restDays('2026-11-23', at(2026, 11, 22))) === null, '烘焙日期在沖煮日期之後：不顯示')
  r.check(restDayLabel(restDays(null, at(2026, 11, 22))) === null, '沒有烘焙日期：不顯示')

  return r.finish()
}
