// form_duration_seconds 的量法：累計互動間隔，閒置超過 60 秒的間隔不計入。
//
// 舊定義（表單開啟到送出）量出 3128 秒、2620 秒——那是開著表單去沖咖啡的時間，
// 這個欄位是驗證「記錄時間能壓到一兩分鐘」的唯一依據，不能再混進閒置時間。

import { createInteractionClock, IDLE_GAP_MS } from '../../utils/interactionTime.ts'
import { createReport } from '../helpers/report.mjs'

/** 從 start 起每 step 毫秒互動一次，持續 duration 毫秒，回傳最後一次的時間 */
function interact(clock: ReturnType<typeof createInteractionClock>, start: number, duration: number, step = 2000) {
  let t = start
  for (; t <= start + duration; t += step) clock.touch(t)
  return t - step
}

export default function run() {
  const r = createReport('記錄時間的量法')

  r.section('閒置的間隔不計入')
  const clock = createInteractionClock()
  const afterFirst = interact(clock, 0, 30_000)
  const resumed = afterFirst + 40 * 60_000
  interact(clock, resumed, 20_000)
  r.check(clock.seconds() === 50, `填 30 秒 → 放著 40 分鐘 → 再填 20 秒 = 50 秒（實際 ${clock.seconds()}）`)

  r.section('門檻')
  r.check(IDLE_GAP_MS === 60_000, '門檻是 60 秒')
  const edge = createInteractionClock()
  edge.touch(0)
  edge.touch(60_000)
  r.check(edge.seconds() === 60, '剛好 60 秒的停頓算進去——想一下再填也是記錄的一部分')
  const over = createInteractionClock()
  over.touch(0)
  over.touch(60_001)
  r.check(over.seconds() === 0, '超過 60 秒的停頓不算')
  const thinking = createInteractionClock()
  for (const t of [0, 15_000, 40_000, 95_000]) thinking.touch(t)
  r.check(thinking.seconds() === 95, '一連串 15、25、55 秒的停頓全部計入')

  r.section('邊界')
  const fresh = createInteractionClock()
  r.check(fresh.seconds() === 0, '沒有任何互動是 0')
  fresh.touch(5000)
  r.check(fresh.seconds() === 0, '只有一次互動也是 0——沒有間隔可以累計')
  const backwards = createInteractionClock()
  backwards.touch(10_000)
  backwards.touch(5_000)
  backwards.touch(12_000)
  r.check(backwards.seconds() === 2, `時鐘倒退不產生負值，也不重複計算（實際 ${backwards.seconds()}）`)

  return r.finish()
}
