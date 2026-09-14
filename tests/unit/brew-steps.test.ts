// 分段注水的資料模型。
//
// **這是整個專案第一優先的不可回歸案例。** 填什麼存什麼：累積水量與
// 純停水秒數都原樣存、原樣讀，中間沒有換算層。最後一段不存停留
//（沒有下一注），沒記錄也是 null。
//
// 舊版在這裡有一層「停留秒數 ↔ 累積時間點」的換算，測試最完整、規格寫得最細，
// 但它從一開始就在服務一個錯誤的欄位定義（停留含注水時間，兩位實機測試者
// 都填不出來）。換算層與它的測試一起移除了——不要因為「它有測試」加回來。

import {
  toStepRows, toStepInputs, incrementalWater, totalWater, brewRatioLabel,
  secondsToClock, clockToSeconds, initialSteps, waterOrderHints, hasStepTiming,
} from '../../utils/brewSteps.ts'
import { createReport, equal } from '../helpers/report.mjs'

type Step = ReturnType<typeof initialSteps>[number]
const step = (t: Step['stepType'], w: number | null, s: number | null, n = ''): Step =>
  ({ stepType: t, cumulativeWater: w, holdSeconds: s, note: n })

export default function run() {
  const r = createReport('分段注水的單位轉換')

  r.section('存檔：填什麼存什麼')
  const ui = [step('bloom', 40, 45), step('pour', 160, 30), step('pour', 220, 30), step('pour', 290, 40)]
  const rows = toStepRows(ui)
  r.check(equal(rows.map(x => x.hold_seconds), [45, 30, 30, null]),
    `hold_seconds = ${JSON.stringify(rows.map(x => x.hold_seconds))}——使用者填的數字原樣進資料庫`)
  r.check(equal(rows.map(x => x.cumulative_water), [40, 160, 220, 290]), '累積水量同樣原樣存')
  r.check(equal(rows.map(x => x.step_index), [1, 2, 3, 4]), 'step_index 從 1 開始')
  r.check(rows[0]!.step_type === 'bloom' && rows[0]!.step_index === 1,
    '悶蒸就是 step_index=1、step_type=bloom 的一般段落，沒有獨立欄位')
  r.check(rows.at(-1)!.hold_seconds === null,
    '最後一段一律 null：沒有下一注就沒有停水，使用者填的 40 不存——那段時間由 total_time 表達')

  r.section('讀取：欄位一對一')
  const back = toStepInputs(rows)
  r.check(equal(back.map(x => x.holdSeconds), [45, 30, 30, null]),
    `讀回來的停留秒數 = ${JSON.stringify(back.map(x => x.holdSeconds))}`)
  r.check(equal(back.map(x => x.cumulativeWater), [40, 160, 220, 290]), '累積水量原樣還原')
  r.check(equal(toStepRows(back), rows), '介面→資料庫→介面→資料庫，結果一致')
  r.check(toStepInputs.length === 1,
    'toStepInputs 只吃分段列——不再需要 total_time，最後一段不從總時間反推')

  r.section('未填完的列')
  const partial = toStepRows([step('bloom', 40, 45), step('pour', null, 30), step('pour', 200, 20)])
  r.check(partial.length === 2, '沒填水量的列被丟掉（cumulative_water 是 NOT NULL）')
  r.check(equal(partial.map(x => x.hold_seconds), [45, null]),
    '剩下兩段：第一段的 45 留著，最後一段是 null')
  r.check(equal(partial.map(x => x.step_index), [1, 2]), 'step_index 重新編號不跳號')
  r.check(toStepRows([]).length === 0, '完全沒有分段時回空陣列')
  r.check(equal(toStepRows([step('bloom', 40, null), step('pour', 160, null)]).map(x => x.hold_seconds), [null, null]),
    '沒填停留就是 null——不再當 0 累加，「沒記錄」與「停 0 秒」不共用同一個值')

  r.section('段落備註與攪拌標記')
  const noteRows = toStepRows([step('bloom', 40, 45, '  中心細水  '), step('stir', 160, 30), step('pour', 290, 40)])
  r.check(noteRows[0]!.note === '中心細水', '備註存進 note，前後空白已去掉')
  r.check(noteRows[1]!.note === null, '沒填備註存 null，不是空字串')
  r.check(noteRows[1]!.step_type === 'stir', '攪拌標記寫入 step_type')
  const noteBack = toStepInputs(noteRows)
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

  r.section('有沒有記錄分段時間（hasStepTiming）')
  // hold_seconds 可為 NULL，「沒記錄」直接由資料表達，不必再看「是不是全為 0」
  const untimed = toStepRows([step('bloom', 40, null), step('pour', 160, null), step('pour', 250, null)])
  r.check(equal(untimed.map(x => x.hold_seconds), [null, null, null]) && !hasStepTiming(untimed),
    '全部是 null：沒有記錄分段時間')
  r.check(toStepInputs(untimed).every(x => x.holdSeconds === null),
    '讀回來也全是空的，不會冒出「停 0 秒」，最後一段也不會冒出「停 180 秒」')
  r.check(equal(toStepRows(toStepInputs(untimed)).map(x => x.hold_seconds), [null, null, null]),
    '沒記錄的紀錄經過編輯頁再存回去，仍然全是 null，資料不變')
  r.check(hasStepTiming(rows), '有任何一段填了就是有記錄')
  const zeroHold = toStepRows([step('bloom', 40, 0), step('pour', 160, 30), step('pour', 250, null)])
  r.check(zeroHold[0]!.hold_seconds === 0 && hasStepTiming(zeroHold),
    '停 0 秒是真的 0，與「沒記錄」不再共用同一個值——這正是改成可空要解決的事')
  const single = toStepRows([step('bloom', 40, 45)])
  r.check(equal(single.map(x => x.hold_seconds), [null]) && !hasStepTiming(single),
    '只有一段：它就是最後一段，沒有下一注可以停，判為沒記錄')
  r.check(!hasStepTiming([]), '沒有分段：沒記錄')

  r.section('開關關閉時編輯既有紀錄，時間要保留')
  // 最容易出錯的地方。開關關閉時表單不顯示時間欄位，但 holdSeconds 仍在表單狀態裡，
  // 儲存時照樣寫回去。關閉時使用者改得到的只有水量、備註、段數——逐一模擬
  const loadedForEdit = toStepInputs(rows)
  const waterOnly = loadedForEdit.map((x, i) => (i === 2 ? { ...x, cumulativeWater: 230 } : x))
  r.check(equal(toStepRows(waterOnly).map(x => x.hold_seconds), [45, 30, 30, null]),
    '只改水量：停留秒數原封不動')
  const notedOnly = loadedForEdit.map((x, i) => (i === 1 ? { ...x, note: '繞圈' } : x))
  r.check(equal(toStepRows(notedOnly).map(x => x.hold_seconds), [45, 30, 30, null]),
    '只改備註：停留秒數原封不動')
  const appended = [...loadedForEdit, step('pour', 330, null)]
  r.check(equal(toStepRows(appended).map(x => x.hold_seconds), [45, 30, 30, null, null]),
    '在最後加一段：原本三個有值的停留原封不動，新的最後一段是 null')
  const templateTimed = toStepRows([step('bloom', 40, 45), step('pour', 150, 30), step('pour', 250, 40)])
  r.check(hasStepTiming(templateTimed) && equal(templateTimed.map(x => x.hold_seconds), [45, 30, null]),
    '手法模板帶入的時間在欄位隱藏時照樣寫進 hold_seconds——之後打開開關，時間是完整的')

  r.section('預設分段')
  const init = initialSteps()
  r.check(init.length === 2 && init[0]!.stepType === 'bloom' && init[1]!.stepType === 'pour',
    '預設一段悶蒸加一段注水')

  return r.finish()
}
