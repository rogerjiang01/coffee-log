// 沖煮手法的分段模板。
//
// 這是使用者第一次能實際測試「選手法自動填分段」，所以案例對著
// seed 進去的五個手法寫，數值錯了會直接影響他沖出來的東西。

import { shouldRegenerateSteps, stepsFromTemplate, toStepRows } from '../../utils/brewSteps.ts'
import { emptyStep } from '../../utils/brewSteps.ts'
import type { MethodTemplate } from '../../utils/brewSteps.ts'
import { createReport, equal } from '../helpers/report.mjs'

// 與 20260903100000_seed_brew_methods.sql 一致
const templates: Record<string, MethodTemplate> = {
  三段式: { steps: [
    { type: 'bloom', basis: 'dose', factor: 2, duration: 35, note: '讓粉床完全濕透' },
    { type: 'pour', basis: 'remaining', factor: 0.6, duration: 45, note: '主萃取，帶出風味前調' },
    { type: 'pour', basis: 'remaining', factor: 0.4, duration: 0, note: '補足後段醇厚度' },
  ] },
  四六: { steps: [
    { type: 'bloom', basis: 'total', factor: 0.1667, duration: 45, note: '前 40% 第一注。此注水量少，甜感較高' },
    { type: 'pour', basis: 'total', factor: 0.2333, duration: 45, note: '前 40% 第二注，完成酸甜比設定' },
    { type: 'pour', basis: 'total', factor: 0.2, duration: 45, note: '後 60% 開始，等流乾再注' },
    { type: 'pour', basis: 'total', factor: 0.2, duration: 45, note: '等流乾再注' },
    { type: 'pour', basis: 'total', factor: 0.2, duration: 0, note: '等流乾再注' },
  ] },
  五段式: { steps: [
    { type: 'bloom', basis: 'dose', factor: 3, duration: 45, note: '注完抓起濾杯順時針晃動，讓粉水完全融合' },
    { type: 'pour', basis: 'remaining', factor: 0.25, duration: 40, note: '等水流下約三分之一再注下一段' },
    { type: 'pour', basis: 'remaining', factor: 0.25, duration: 40 },
    { type: 'pour', basis: 'remaining', factor: 0.25, duration: 40 },
    { type: 'pour', basis: 'remaining', factor: 0.25, duration: 0, note: '注完再次輕晃濾杯，讓粉床平整下落' },
  ] },
  攪拌流: { steps: [
    { type: 'bloom', basis: 'dose', factor: 2.5, duration: 30, note: '注完立即用攪拌棒十字攪拌' },
    { type: 'pour', basis: 'remaining', factor: 0.2, duration: 40, note: '大水流破壞粉層' },
    { type: 'pour', basis: 'remaining', factor: 0.26, duration: 40, note: '改為輕柔細水流' },
    { type: 'pour', basis: 'remaining', factor: 0.26, duration: 40 },
    { type: 'pour', basis: 'remaining', factor: 0.28, duration: 0, note: '注完抓起濾杯輕敲桌面一下' },
  ] },
  肥尾: { steps: [
    { type: 'bloom', basis: 'dose', factor: 2.5, duration: 45 },
    { type: 'pour', basis: 'remaining', factor: 0.2, duration: 45 },
    { type: 'pour', basis: 'remaining', factor: 0.2, duration: 20, note: '以下四注不等流乾，快速補水' },
    { type: 'pour', basis: 'remaining', factor: 0.2, duration: 20 },
    { type: 'pour', basis: 'remaining', factor: 0.2, duration: 20 },
    { type: 'pour', basis: 'remaining', factor: 0.2, duration: 0 },
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
  const expected: Record<string, { water: number[], hold: number[] }> = {
    三段式: { water: [40, 196, 300], hold: [35, 45, 0] },
    四六: { water: [50, 120, 180, 240, 300], hold: [45, 45, 45, 45, 0] },
    五段式: { water: [60, 120, 180, 240, 300], hold: [45, 40, 40, 40, 0] },
    攪拌流: { water: [50, 100, 165, 230, 300], hold: [30, 40, 40, 40, 0] },
    肥尾: { water: [50, 100, 150, 200, 250, 300], hold: [45, 45, 20, 20, 20, 0] },
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

  r.section('最後一段的 duration 為 0，與階段 5 的還原邏輯一致')
  r.check(rao.steps.at(-1)!.holdSeconds === 0, '模板最後一段的停留秒數是 0')
  const offsets = toStepRows(rao.steps).map(s => s.time_offset)
  r.check(equal(offsets, [0, 45, 85, 125, 165]),
    `換算成累積時間點 ${JSON.stringify(offsets)}——最後一段的 0 不影響任何 offset，結束時間由 total_time 決定`)

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
