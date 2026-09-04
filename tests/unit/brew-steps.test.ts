// 分段注水的單位轉換。
//
// **這是整個專案第一優先的不可回歸案例。** 兩個欄位的方向不同：
// 累積水量原樣存，時間換算成累積時間點。寫反了不會報錯，
// 只會讓所有既有紀錄的時間資料悄悄失真。

import {
  toStepRows, toStepInputs, incrementalWater, totalWater, brewRatioLabel,
  secondsToClock, clockToSeconds, initialSteps, waterOrderHints,
} from '../../utils/brewSteps.ts'
import { createReport, equal } from '../helpers/report.mjs'

type Step = ReturnType<typeof initialSteps>[number]
const step = (t: Step['stepType'], w: number | null, s: number | null, n = ''): Step =>
  ({ stepType: t, cumulativeWater: w, holdSeconds: s, note: n })

export default function run() {
  const r = createReport('分段注水的單位轉換')

  r.section('存檔：停留秒數 → 累積時間點')
  const ui = [step('bloom', 40, 45), step('pour', 160, 30), step('pour', 220, 30), step('pour', 290, 40)]
  const rows = toStepRows(ui)
  r.check(equal(rows.map(x => x.time_offset), [0, 45, 75, 105]),
    `time_offset = ${JSON.stringify(rows.map(x => x.time_offset))}（0、45、45+30、45+30+30）`)
  r.check(equal(rows.map(x => x.cumulative_water), [40, 160, 220, 290]), '累積水量直接存，沒有被換算')
  r.check(equal(rows.map(x => x.step_index), [1, 2, 3, 4]), 'step_index 從 1 開始')
  r.check(rows[0]!.step_type === 'bloom' && rows[0]!.step_index === 1,
    '悶蒸就是 step_index=1、step_type=bloom 的一般段落，沒有獨立欄位')
  r.check(rows.at(-1)!.time_offset === 105, '最後一段的停留秒數不進 time_offset，由 total_time 表達')

  r.section('讀取：累積時間點 → 停留秒數')
  const back = toStepInputs(rows, 145)
  r.check(equal(back.map(x => x.holdSeconds), [45, 30, 30, 40]),
    `還原的停留秒數 = ${JSON.stringify(back.map(x => x.holdSeconds))}`)
  r.check(equal(back.map(x => x.cumulativeWater), [40, 160, 220, 290]), '累積水量原樣還原')
  r.check(equal(toStepRows(back), rows), '介面→資料庫→介面→資料庫，結果一致')

  r.section('total_time 缺席或不合理')
  r.check(toStepInputs(rows, null).at(-1)!.holdSeconds === null, '沒有 total_time 時最後一段是 null，不亂猜')
  r.check(toStepInputs(rows, 90).at(-1)!.holdSeconds === null, 'total_time 比最後時間點還早時回 null，不生負數')
  r.check(toStepInputs(rows, 105).at(-1)!.holdSeconds === 0, 'total_time 剛好等於最後時間點時是 0')

  r.section('未填完的列')
  const partial = toStepRows([step('bloom', 40, 45), step('pour', null, 30), step('pour', 200, 20)])
  r.check(partial.length === 2, '沒填水量的列被丟掉（cumulative_water 是 NOT NULL）')
  r.check(equal(partial.map(x => x.time_offset), [0, 45]), '丟掉後 time_offset 重新連續累加，不留空隙')
  r.check(equal(partial.map(x => x.step_index), [1, 2]), 'step_index 重新編號不跳號')
  r.check(toStepRows([]).length === 0, '完全沒有分段時回空陣列')
  r.check(equal(toStepRows([step('bloom', 40, null), step('pour', 160, null)]).map(x => x.time_offset), [0, 0]),
    '停留秒數留空時當 0')

  r.section('段落備註與攪拌標記')
  const noteRows = toStepRows([step('bloom', 40, 45, '  中心細水  '), step('stir', 160, 30), step('pour', 290, 40)])
  r.check(noteRows[0]!.note === '中心細水', '備註存進 note，前後空白已去掉')
  r.check(noteRows[1]!.note === null, '沒填備註存 null，不是空字串')
  r.check(noteRows[1]!.step_type === 'stir', '攪拌標記寫入 step_type')
  const noteBack = toStepInputs(noteRows, 145)
  r.check(noteBack[1]!.note === '', 'null 還原成空字串，介面不會顯示 null')
  r.check(equal(toStepRows(noteBack), noteRows), '含備註與攪拌時來回轉換仍守恆')

  r.section('累積水量遞減的提示')
  const ok = [step('bloom', 40, 45), step('pour', 160, 30), step('pour', 290, 0)]
  r.check(waterOrderHints(ok).every(h => h === null), '遞增時完全沒有提示')
  const down = [step('bloom', 200, 45), step('pour', 100, 30)]
  const downHints = waterOrderHints(down)
  r.check(downHints[0] === null && downHints[1] !== null, '第二段從 200 掉到 100，只有第二段被標記')
  r.check(downHints[1] === '累積水量應增加', `提示只說該怎麼做，不解釋磅秤原理：${downHints[1]}`)
  const flat = [step('pour', 160, 30), step('pour', 160, 30)]
  r.check(waterOrderHints(flat).every(h => h === null), '相等不提示')
  const stir = [step('pour', 160, 30), step('stir', 160, 10), step('pour', 240, 0)]
  r.check(waterOrderHints(stir).every(h => h === null), '攪拌段的水量與前一段相同是合法的')
  const stirLower = [step('pour', 160, 30), step('stir', 100, 10), step('pour', 240, 0)]
  const stirHints = waterOrderHints(stirLower)
  r.check(stirHints[1] === null, '攪拌段本身不參與比對，不會被標記')
  r.check(stirHints[2] === null, '攪拌段不更新基準，後面的 240 仍與 160 比對而非 100')
  const sparse = [step('pour', 200, 30), step('pour', null, 30), step('pour', 100, 0)]
  const sparseHints = waterOrderHints(sparse)
  r.check(sparseHints[1] === null, '沒填水量的段落不提示')
  r.check(sparseHints[2] !== null, '跳過空白段後仍與前一個有值的段比對')
  r.check(waterOrderHints([]).length === 0, '空清單回空陣列')

  r.section('衍生值')
  r.check(equal(incrementalWater(ui), [40, 120, 60, 70]), '每段增量水量，第一段即其本身')
  r.check(totalWater(ui) === 290, '總水量 = 最後一段的累積水量')
  r.check(totalWater([]) === null, '沒有分段時總水量是 null')
  r.check(brewRatioLabel(290, 20) === '1:14.5', '粉水比 290/20')
  r.check(brewRatioLabel(225, 15) === '1:15.0', '粉水比 225/15')
  r.check(brewRatioLabel(290, null) === null, '沒填粉重就不顯示粉水比')
  r.check(brewRatioLabel(290, 0) === null, '粉重為 0 時不顯示，不會除以零')

  r.section('分:秒')
  r.check(secondsToClock(150) === '2:30', '150 秒 → 2:30')
  r.check(secondsToClock(65) === '1:05', '65 秒 → 1:05（補零）')
  r.check(secondsToClock(null) === '', '沒填就是空字串')
  r.check(clockToSeconds('2:30') === 150, '2:30 → 150')
  r.check(clockToSeconds('150') === 150, '只打數字當秒數')
  r.check(clockToSeconds('') === null, '空字串 → null')
  r.check(clockToSeconds('abc') === null, '亂打 → null')
  r.check(clockToSeconds('2:75') === null, '秒數超過 59 視為無效')
  const decomposed = [Math.floor(145 / 60), 145 % 60]
  r.check(equal(decomposed, [2, 25]) && decomposed[0]! * 60 + decomposed[1]! === 145,
    '分:秒輸入框的拆解與組合守恆（145 ↔ 2 分 25 秒）')

  r.section('預設分段')
  const init = initialSteps()
  r.check(init.length === 2 && init[0]!.stepType === 'bloom' && init[1]!.stepType === 'pour',
    '預設一段悶蒸加一段注水')

  return r.finish()
}
