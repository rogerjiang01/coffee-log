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

  // ── 參數與品飲分開計時（《01》§9.1）────────────────────
  // 同一批間隔的再分配：總耗時的數字不因為分段而改變。

  r.section('在參數與品飲之間來回切換')
  const both = createInteractionClock()
  both.touch(0, 'params')
  both.touch(10_000, 'params')       // 參數 10 秒
  both.touch(14_000, 'tasting')      // 切過去的那 4 秒還在看參數
  both.touch(20_000, 'tasting')      // 品飲 6 秒
  both.touch(23_000, 'params')       // 切回來的 3 秒算品飲
  both.touch(28_000, 'params')       // 參數再 5 秒
  r.check(both.sectionSeconds('params') === 19, `參數 10＋4＋5 ＝ 19 秒（實際 ${both.sectionSeconds('params')}）`)
  r.check(both.sectionSeconds('tasting') === 9, `品飲 6＋3 ＝ 9 秒（實際 ${both.sectionSeconds('tasting')}）`)
  r.check(both.seconds() === 28, '總耗時 28 秒')
  r.check(both.sectionSeconds('params') + both.sectionSeconds('tasting') === both.seconds(),
    '沒有 other 欄位時兩段相加就是總耗時')

  r.section('間隔算給區間開始的那一段')
  const edgeSection = createInteractionClock()
  edgeSection.touch(0, 'params')
  edgeSection.touch(5000, 'tasting')
  r.check(edgeSection.sectionSeconds('params') === 5 && edgeSection.sectionSeconds('tasting') === 0,
    '在粉重打完字、過五秒點進心得筆記，那五秒算參數——他還在看參數')

  r.section('中途切到背景')
  // 切到背景不產生任何事件，所以背景那段就是一個長間隔，由門檻處理，
  // 不需要也不應該另外監聽 visibilitychange——那會多記一次互動。
  const background = createInteractionClock()
  background.touch(0, 'params')
  background.touch(20_000, 'params')          // 參數 20 秒
  background.touch(20_000 + 5 * 60_000, 'params') // 切出去五分鐘再回來
  background.touch(20_000 + 5 * 60_000 + 15_000, 'params')
  r.check(background.sectionSeconds('params') === 35, `背景那五分鐘不計入參數（實際 ${background.sectionSeconds('params')}）`)
  r.check(background.seconds() === 35, '總耗時同樣不計入，兩者用同一條規則')
  const shortAway = createInteractionClock()
  shortAway.touch(0, 'tasting')
  shortAway.touch(30_000, 'tasting')
  r.check(shortAway.sectionSeconds('tasting') === 30, '離開不到門檻就回來，照樣計入那一段——看一眼磅秤也是記錄的一部分')

  r.section('閒置超過門檻')
  const idleSection = createInteractionClock()
  idleSection.touch(0, 'tasting')
  idleSection.touch(30_000, 'tasting')
  idleSection.touch(30_000 + 60_001, 'tasting')
  idleSection.touch(30_000 + 60_001 + 10_000, 'tasting')
  r.check(idleSection.sectionSeconds('tasting') === 40, `品飲 30＋10 ＝ 40 秒，中間的 60.001 秒不計（實際 ${idleSection.sectionSeconds('tasting')}）`)
  r.check(idleSection.seconds() === 40, '總耗時一致')

  r.section('兩者都不算的欄位')
  const other = createInteractionClock()
  other.touch(0, 'other')
  other.touch(12_000, 'params')   // 改日期花了 12 秒
  other.touch(30_000, 'params')   // 參數 18 秒
  r.check(other.seconds() === 30, '總耗時含日期那 12 秒')
  r.check(other.sectionSeconds('params') === 18 && other.sectionSeconds('tasting') === 0, '日期不算進任何一段')
  r.check(other.sectionSeconds('params') + other.sectionSeconds('tasting') < other.seconds(),
    '兩段相加小於總耗時，差額就是日期這類欄位')

  r.section('判斷不出區段時沿用上一段')
  // 捲動的目標是 document，浮層 teleport 到 body——兩者都不在任何一段的 DOM 裡
  const sticky = createInteractionClock()
  sticky.touch(0, 'params')      // 點「磨豆機」
  sticky.touch(8000, null)       // 在浮層裡挑型號
  sticky.touch(15_000, null)     // 還在浮層裡
  sticky.touch(20_000, 'params') // 回到表單
  r.check(sticky.sectionSeconds('params') === 20, `浮層裡的 20 秒算參數（實際 ${sticky.sectionSeconds('params')}）`)
  const unknownFirst = createInteractionClock()
  unknownFirst.touch(0)          // 表單掛上，還沒碰任何欄位
  unknownFirst.touch(9000)
  unknownFirst.touch(9000, 'params')
  r.check(unknownFirst.seconds() === 9 && unknownFirst.sectionSeconds('params') === 0,
    '第一次互動之前沒有區段可以沿用，那段只進總耗時')

  r.section('邊界')
  const untouched = createInteractionClock()
  r.check(untouched.sectionSeconds('params') === 0 && untouched.sectionSeconds('tasting') === 0,
    '沒有任何互動時兩段都是 0')
  const rewind = createInteractionClock()
  rewind.touch(10_000, 'params')
  rewind.touch(5000, 'tasting')   // 時鐘倒退：不計時間，也不換區段
  rewind.touch(12_000, 'params')
  r.check(rewind.sectionSeconds('params') === 2 && rewind.sectionSeconds('tasting') === 0,
    '時鐘倒退不換區段，也不產生負值')

  return r.finish()
}
