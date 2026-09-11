// 相對上一版的差異。即時計算，不存資料庫。

import * as brewSteps from '../../utils/brewSteps.ts'
// brewDiff 依賴 brewSteps 的 secondsToClock 與 toStepInputs，
// 在應用程式裡由 Nuxt 自動匯入補上。測試裡自己補，等同複製建置時做的事。
Object.assign(globalThis, {
  secondsToClock: brewSteps.secondsToClock,
  toStepInputs: brewSteps.toStepInputs,
  hasStepTiming: brewSteps.hasStepTiming,
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

  r.section('沒記錄分段時間（time_offset 全為 0）')
  // 記錄分段時間預設關閉，多數新紀錄的 time_offset 全為 0。差異區不能比出憑空的數字
  const untimed = [step(1, 0, 40), step(2, 0, 160), step(3, 0, 220), step(4, 0, 290)]
  r.check(computeBrewDiff(base({ steps: untimed }), base({ steps: untimed })).length === 0,
    '兩邊都沒記錄：沒有差異')
  const untimedTotal = computeBrewDiff(base({ steps: untimed, total_time: 150 }), base({ steps: untimed }))
  r.check(untimedTotal.length === 1 && untimedTotal[0]!.field === 'total_time',
    '兩邊都沒記錄、只改總時間：只比出總時間——不會因為最後一段從 total_time 反推而多冒一條「0 / 0 / 0 / 150」')
  const untimedFewer = computeBrewDiff(base({ steps: untimed.slice(0, 3) }), base({ steps: untimed }))
  r.check(untimedFewer.some(d => d.field === 'step_count') && !untimedFewer.some(d => d.field === 'step_time'),
    '兩邊都沒記錄、段數不同：比出段數，不比停留秒數')
  const oneSide = computeBrewDiff(base({ steps: untimed }), base())
  const oneSideRow = oneSide.find(d => d.field === 'step_time')
  r.check(oneSideRow?.before === '45 / 30 / 30 / 40' && oneSideRow.after === '沒記錄',
    `只有一邊有記錄：另一邊顯示「沒記錄」，不是一串 0（${oneSideRow?.before} → ${oneSideRow?.after}）`)
  const firstZeroOnly = [step(1, 0, 40), step(2, 45, 160), step(3, 75, 220), step(4, 105, 290)]
  r.check(computeBrewDiff(base({ steps: firstZeroOnly }), base()).length === 0,
    '第一段為 0、後續有值：是有記錄的紀錄，照常比對（這裡兩邊相同所以沒有差異）')
  const bloomOnly = [step(1, 0, 40)]
  r.check(!computeBrewDiff(base({ steps: bloomOnly, total_time: 120 }), base({ steps: bloomOnly }))
    .some(d => d.field === 'step_time'),
  '只有悶蒸一段：不比對停留秒數——那一段的「停留」就是總時間，已經由總沖煮時間比對')

  return r.finish()
}
