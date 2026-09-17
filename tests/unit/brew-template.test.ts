// 沖煮手法的分段模板。
//
// 這是使用者第一次能實際測試「選手法自動填分段」，所以案例對著
// seed 進去的五個手法寫，數值錯了會直接影響他沖出來的東西。

import { shouldRegenerateSteps, stepsFromTemplate, toStepRows } from '../../utils/brewSteps.ts'
import { emptyStep } from '../../utils/brewSteps.ts'
import type { MethodTemplate } from '../../utils/brewSteps.ts'
import { createReport, equal } from '../helpers/report.mjs'

// 與目前遠端的 seed 一致：duration 來自 20260917100000（台灣主流教學交叉比對，
// 尚未實機核實），四六法第一注的 type 來自 20260917110000（pour，不是悶蒸）。
// duration 是純停水秒數，最後一段沒有下一注所以是 null。
const templates: Record<string, MethodTemplate> = {
  三段式: { steps: [
    { type: 'bloom', basis: 'dose', factor: 2, duration: 30, note: '讓粉床完全濕透' },
    { type: 'pour', basis: 'remaining', factor: 0.6, duration: 35, note: '主萃取，帶出風味前調' },
    { type: 'pour', basis: 'remaining', factor: 0.4, duration: null, note: '補足後段醇厚度' },
  ] },
  四六: { steps: [
    { type: 'pour', basis: 'total', factor: 0.1667, duration: 38, note: '前 40% 第一注。此注水量少，甜感較高' },
    { type: 'pour', basis: 'total', factor: 0.2333, duration: 33, note: '前 40% 第二注，完成酸甜比設定' },
    { type: 'pour', basis: 'total', factor: 0.2, duration: 33, note: '後 60% 開始，等流乾再注' },
    { type: 'pour', basis: 'total', factor: 0.2, duration: 33, note: '等流乾再注' },
    { type: 'pour', basis: 'total', factor: 0.2, duration: null, note: '等流乾再注' },
  ] },
  五段式: { steps: [
    { type: 'bloom', basis: 'dose', factor: 3, duration: 33, note: '注完抓起濾杯順時針晃動，讓粉水完全融合' },
    { type: 'pour', basis: 'remaining', factor: 0.25, duration: 20, note: '等水流下約三分之一再注下一段' },
    { type: 'pour', basis: 'remaining', factor: 0.25, duration: 20 },
    { type: 'pour', basis: 'remaining', factor: 0.25, duration: 20 },
    { type: 'pour', basis: 'remaining', factor: 0.25, duration: null, note: '注完再次輕晃濾杯，讓粉床平整下落' },
  ] },
  攪拌流: { steps: [
    { type: 'bloom', basis: 'dose', factor: 2.5, duration: 25, note: '注完立即用攪拌棒十字攪拌' },
    { type: 'pour', basis: 'remaining', factor: 0.2, duration: 20, note: '大水流破壞粉層' },
    { type: 'pour', basis: 'remaining', factor: 0.26, duration: 20, note: '改為輕柔細水流' },
    { type: 'pour', basis: 'remaining', factor: 0.26, duration: 20 },
    { type: 'pour', basis: 'remaining', factor: 0.28, duration: null, note: '注完抓起濾杯輕敲桌面一下' },
  ] },
  肥尾: { steps: [
    { type: 'bloom', basis: 'dose', factor: 2.5, duration: 35 },
    { type: 'pour', basis: 'remaining', factor: 0.2, duration: 25 },
    { type: 'pour', basis: 'remaining', factor: 0.2, duration: 5, note: '以下四注不等流乾，快速補水' },
    { type: 'pour', basis: 'remaining', factor: 0.2, duration: 5 },
    { type: 'pour', basis: 'remaining', factor: 0.2, duration: 5 },
    { type: 'pour', basis: 'remaining', factor: 0.2, duration: null },
  ] },
}

export default function run() {
  const r = createReport('手法的分段模板')

  r.section('factor 總和（seed 寫入的前提）')
  for (const [name, template] of Object.entries(templates)) {
    const remaining = template.steps.filter(s => s.basis === 'remaining')
      .reduce((sum, s) => sum + s.factor, 0)
    const total = template.steps.filter(s => s.basis === 'total')
      .reduce((sum, s) => sum + s.factor, 0)
    const remainingOk = !template.steps.some(s => s.basis === 'remaining') || Math.abs(remaining - 1) < 1e-9
    const totalOk = !template.steps.some(s => s.basis === 'total') || Math.abs(total - 1) < 1e-9
    r.check(remainingOk && totalOk, `${name} 的 factor 總和為 1`)
  }

  r.section('五個手法在 20g / 1:15（總水 300ml）')
  const expected: Record<string, { water: number[], hold: (number | null)[] }> = {
    三段式: { water: [40, 196, 300], hold: [30, 35, null] },
    四六: { water: [50, 120, 180, 240, 300], hold: [38, 33, 33, 33, null] },
    五段式: { water: [60, 120, 180, 240, 300], hold: [33, 20, 20, 20, null] },
    攪拌流: { water: [50, 100, 165, 230, 300], hold: [25, 20, 20, 20, null] },
    肥尾: { water: [50, 100, 150, 200, 250, 300], hold: [35, 25, 5, 5, 5, null] },
  }
  for (const [name, template] of Object.entries(templates)) {
    const result = stepsFromTemplate(template, 20, 15)!
    const water = result.steps.map(s => s.cumulativeWater)
    const hold = result.steps.map(s => s.holdSeconds)
    r.check(equal(water, expected[name]!.water), `${name} 累積水量 ${JSON.stringify(water)}`)
    r.check(equal(hold, expected[name]!.hold), `${name} 停留秒數 ${JSON.stringify(hold)}`)
  }

  r.section('dose 基準：三段式在 15g / 1:16')
  const threeStage = stepsFromTemplate(templates.三段式!, 15, 16)!
  r.check(threeStage.steps[0]!.cumulativeWater === 30,
    `悶蒸為粉重的兩倍 = 30ml（實際 ${threeStage.steps[0]!.cumulativeWater}），與總水量 240 無關`)
  r.check(threeStage.steps.at(-1)!.cumulativeWater === 240, '最後一段精確等於總水量 240')

  r.section('total 基準：4:6 的前兩注永遠是總水量的 40%')
  for (const [dose, ratio] of [[15, 15], [20, 15], [18, 16], [22, 14], [12, 18]]) {
    const result = stepsFromTemplate(templates.四六!, dose!, ratio!)!
    const total = dose! * ratio!
    const firstTwo = result.steps[1]!.cumulativeWater!
    r.check(Math.abs(firstTwo - total * 0.4) <= 1,
      `${dose}g / 1:${ratio}（總水 ${total}）前兩注合計 ${firstTwo}，為總水量的 40%`)
  }

  r.section('最後一段精確等於總水量，無小數誤差')
  for (const [dose, ratio] of [[20, 15], [15, 16], [17, 17], [21.5, 14.5], [13, 18]]) {
    for (const [name, template] of Object.entries(templates)) {
      const result = stepsFromTemplate(template, dose!, ratio!)!
      const last = result.steps.at(-1)!.cumulativeWater
      const expectedTotal = Math.round(dose! * ratio!)
      if (last !== expectedTotal) {
        r.check(false, `${name} ${dose}g/1:${ratio} 最後一段 ${last} 不等於總水量 ${expectedTotal}`)
      }
    }
  }
  r.ok('五個手法 × 五組粉重粉水比，最後一段都精確等於總水量')

  r.section('邊界保護：極端粉水比')
  const normal = stepsFromTemplate(templates.三段式!, 20, 12)!
  r.check(normal.notice === null,
    `20g / 1:12（總水 240）悶蒸 40ml，未觸發邊界保護——這正是舊結構會失效的案例`)
  r.check(normal.steps[0]!.cumulativeWater === 40, '悶蒸 40ml 是粉重的兩倍，粉濕得透')

  const extreme = stepsFromTemplate(templates.五段式!, 20, 5)!
  r.check(extreme.notice !== null, '20g / 1:5（總水 100）時悶蒸 60ml 超過一半，觸發邊界保護')
  r.check(extreme.steps[0]!.cumulativeWater === 50, `改按總水量比例計算，悶蒸為 ${extreme.steps[0]!.cumulativeWater}ml`)
  r.check(extreme.steps.at(-1)!.cumulativeWater === 100, '觸發保護後最後一段仍精確等於總水量')

  r.section('type 與 note 一併帶入')
  const rao = stepsFromTemplate(templates.五段式!, 20, 15)!
  r.check(rao.steps[0]!.stepType === 'bloom', '第一段是 bloom')
  r.check(rao.steps[0]!.note === '注完抓起濾杯順時針晃動，讓粉水完全融合', '悶蒸的 note 有帶入')
  r.check(rao.steps[2]!.note === '', '模板沒寫 note 的段落是空字串')
  const rows = toStepRows(rao.steps)
  r.check(rows[0]!.step_type === 'bloom' && rows[0]!.note === '注完抓起濾杯順時針晃動，讓粉水完全融合',
    'note 與 step_type 會一起寫進 brew_steps')
  r.check(rows[2]!.note === null, '沒有 note 的段落存 null')

  r.section('最後一段沒有停留')
  r.check(rao.steps.at(-1)!.holdSeconds === null,
    '模板最後一段的 duration 是 null，帶進表單也是 null——最後一注之後沒有下一注')
  const holds = toStepRows(rao.steps).map(s => s.hold_seconds)
  r.check(equal(holds, [33, 20, 20, 20, null]),
    `寫進資料庫的停留秒數 ${JSON.stringify(holds)}——原樣寫入，不換算；結束前的時間由 total_time 表達`)

  r.section('純停水不受粉重影響，數值可移植')
  // 停 30 秒對 15g 與 25g 都是 30 秒，物理意義不變，所以 duration 不跟著粉重換算
  const small = stepsFromTemplate(templates.四六!, 15, 15)!.steps.map(s => s.holdSeconds)
  const large = stepsFromTemplate(templates.四六!, 25, 15)!.steps.map(s => s.holdSeconds)
  r.check(equal(small, large) && equal(small, [38, 33, 33, 33, null]),
    `15g 與 25g 的停留秒數相同 ${JSON.stringify(small)}`)

  r.section('粉重未填時不帶入')
  r.check(stepsFromTemplate(templates.三段式!, null, 15) === null, '沒填粉重時回 null，等填好再帶入')
  r.check(stepsFromTemplate(templates.三段式!, 20, null) === null, '手法沒有預設粉水比時不帶入')
  r.check(stepsFromTemplate(null, 20, 15) === null, '沒有模板時不帶入')
  r.check(stepsFromTemplate(templates.三段式!, 0, 15) === null, '粉重為 0 時不帶入，不會產生一堆 0')

  r.section('粉重變動時整組重算')
  // 四六法 20g → 50/120/180/240/300
  const at20 = stepsFromTemplate(templates.四六!, 20, 15)!
  const at18 = stepsFromTemplate(templates.四六!, 18, 15)!
  r.check(shouldRegenerateSteps(at20.steps, at18.steps.length), '段數一致就重算')

  // 使用者把第三段從 180 微調成 175，改粉重後仍然整組重算——這是刻意的。
  // 逐段保留的機制試過並撤掉了，理由是使用者無法預測結果。
  const edited = at20.steps.map((step, i) => (i === 2 ? { ...step, cumulativeWater: 175 } : step))
  r.check(shouldRegenerateSteps(edited, at18.steps.length),
    '手動改過的段落不受保護，175 會被 180 蓋掉')

  r.section('自己增減過段數就不重算')
  r.check(!shouldRegenerateSteps([...at20.steps, emptyStep('pour')], at18.steps.length),
    '多一段：結構已與模板無關')
  r.check(!shouldRegenerateSteps(at20.steps.slice(0, 3), at18.steps.length), '少幾段也一樣')

  r.section('整組還空白時一律重算')
  // 「先選手法、粉重晚點才填」：此時分段還停在預設的兩段，段數對不上也要帶入
  r.check(shouldRegenerateSteps([emptyStep('bloom'), emptyStep('pour')], 5),
    '預設兩段對上模板五段，仍然帶入')
  r.check(shouldRegenerateSteps([], 5), '完全沒有分段時也帶入')

  return r.finish()
}
