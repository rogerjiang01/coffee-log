// 相對上一版的差異。即時計算，不存資料庫。

import * as brewSteps from '../../utils/brewSteps.ts'
// brewDiff 依賴 brewSteps 的 secondsToClock 與 toStepInputs，
// 在應用程式裡由 Nuxt 自動匯入補上。測試裡自己補，等同複製建置時做的事。
Object.assign(globalThis, {
  secondsToClock: brewSteps.secondsToClock,
  toStepInputs: brewSteps.toStepInputs,
})
const { computeBrewDiff } = await import('../../utils/brewDiff.ts')
import { createReport } from '../helpers/report.mjs'

type Subject = Parameters<typeof computeBrewDiff>[0]

const step = (i: number, t: number, w: number) =>
  ({ step_index: i, time_offset: t, cumulative_water: w, step_type: 'pour' as const, note: null })

const base = (over: Partial<Subject> = {}): Subject => ({
  dose: 15, water_temp: 92, grind_setting: 22, total_time: 145,
  grinder_id: 'g1', dripper_id: 'd1', kettle_id: 'k1', brew_method_id: null,
  grinderName: 'Comandante C40', dripperName: 'Hario V60 02', kettleName: 'Hario Buono', methodName: null,
  steps: [step(1, 0, 40), step(2, 45, 160), step(3, 75, 220), step(4, 105, 290)],
  ...over,
})

export default function run() {
  const r = createReport('相對上一版的差異')

  r.section('沒改與改一項')
  r.check(computeBrewDiff(base(), base()).length === 0, '複製後完全沒改時差異為空，詳情頁不顯示區塊')
  const one = computeBrewDiff(base({ grind_setting: 20 }), base())
  r.check(one.length === 1 && one[0]!.label === '研磨刻度' && one[0]!.before === '22' && one[0]!.after === '20',
    `只改刻度時只有一條：${one[0]!.label} ${one[0]!.before} → ${one[0]!.after}`)

  r.section('各欄位')
  const temp = computeBrewDiff(base({ water_temp: 90 }), base())
  r.check(temp[0]!.before === '92 °C' && temp[0]!.after === '90 °C', '水溫帶單位')
  const dose = computeBrewDiff(base({ dose: 16.5 }), base())
  r.check(dose[0]!.before === '15 g' && dose[0]!.after === '16.5 g', '粉重去掉無意義的尾數')
  const time = computeBrewDiff(base({ total_time: 150 }), base())
  r.check(time[0]!.before === '2:25' && time[0]!.after === '2:30', '總沖煮時間顯示分:秒')

  r.section('器材比對 id、顯示名稱')
  const grinder = computeBrewDiff(base({ grinder_id: 'g2', grinderName: '1Zpresso JX-Pro' }), base())
  r.check(grinder.length === 1 && grinder[0]!.label === '磨豆機' && grinder[0]!.after === '1Zpresso JX-Pro',
    '換磨豆機時顯示名稱')
  r.check(computeBrewDiff(base({ grinderName: '換了個顯示名稱' }), base()).length === 0,
    '同一台器材只是名稱字串不同時不算差異')

  r.section('空值')
  r.check(computeBrewDiff(base({ water_temp: null }), base())[0]!.after === '沒填', '有值改成沒填')
  r.check(computeBrewDiff(base(), base({ grind_setting: null }))[0]!.before === '沒填', '沒填後來填了')

  r.section('分段結構')
  const fewer = computeBrewDiff(base({ steps: [step(1, 0, 40), step(2, 45, 160), step(3, 75, 260)] }), base())
  r.check(fewer.some(d => d.field === 'step_count' && d.before === '4 段' && d.after === '3 段'), '段數變化')
  const waterOnly = computeBrewDiff(
    base({ steps: [step(1, 0, 40), step(2, 45, 170), step(3, 75, 220), step(4, 105, 290)] }), base())
  r.check(waterOnly.length === 1 && waterOnly[0]!.field === 'step_water', '只改水量時不會誤報時間差異')
  const timeOnly = computeBrewDiff(
    base({ steps: [step(1, 0, 40), step(2, 50, 160), step(3, 80, 220), step(4, 105, 290)] }), base())
  r.check(timeOnly.length === 1 && timeOnly[0]!.field === 'step_time', '只改時間時不會誤報水量差異')
  r.check(timeOnly[0]!.before === '45 / 30 / 30 / 40',
    '呈現的是使用者輸入的停留秒數，不是資料庫的累積時間點')

  return r.finish()
}
