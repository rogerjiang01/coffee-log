// 和比較對象的差異（「和 M/D 那一杯相比」）。即時計算，不存資料庫。

import * as brewSteps from '../../utils/brewSteps.ts'
// brewDiff 依賴 brewSteps 的 secondsToClock 與 toStepInputs，
// 在應用程式裡由 Nuxt 自動匯入補上。測試裡自己補，等同複製建置時做的事。
Object.assign(globalThis, {
  secondsToClock: brewSteps.secondsToClock,
  toStepInputs: brewSteps.toStepInputs,
  toStepRows: brewSteps.toStepRows,
  withoutStir: brewSteps.withoutStir,
  hasStepTiming: brewSteps.hasStepTiming,
})
const { computeBrewDiff, ratingDiff } = await import('../../utils/brewDiff.ts')
import { createReport } from '../helpers/report.mjs'

type Subject = Parameters<typeof computeBrewDiff>[0]

const step = (i: number, hold: number | null, w: number) =>
  ({ step_index: i, hold_seconds: hold, cumulative_water: w, step_type: 'pour' as const, note: null })

const base = (over: Partial<Subject> = {}): Subject => ({
  dose: 15, water_temp: 92, grind_setting: 22, total_time: 145,
  grinder_id: 'g1', dripper_id: 'd1', kettle_id: 'k1', brew_method_id: null,
  grinderName: 'Comandante C40', dripperName: 'Hario V60 02', kettleName: 'Hario Buono', methodName: null,
  steps: [step(1, 45, 40), step(2, 30, 160), step(3, 30, 220), step(4, null, 290)],
  ...over,
})

export default function run() {
  const r = createReport('和比較對象的差異')

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
  r.check(time[0]!.before === '2:25' && time[0]!.after === '2:30', '沖煮時間顯示分:秒')

  r.section('器材比對 id、顯示名稱')
  const grinder = computeBrewDiff(base({ grinder_id: 'g2', grinderName: '1Zpresso JX-Pro' }), base())
  r.check(grinder.length === 1 && grinder[0]!.label === '磨豆機' && grinder[0]!.after === '1Zpresso JX-Pro',
    '換磨豆機時顯示名稱')
  r.check(computeBrewDiff(base({ grinderName: '換了個顯示名稱' }), base()).length === 0,
    '同一台器材只是名稱字串不同時不算差異')

  r.section('一邊沒填就略過（2026-10-06）')
  r.check(computeBrewDiff(base({ water_temp: null }), base()).length === 0, '這一筆沒填水溫：不列')
  r.check(computeBrewDiff(base(), base({ grind_setting: null })).length === 0, '比較對象沒填刻度：不列')
  r.check(computeBrewDiff(base({ dose: null, water_temp: 90 }), base()).map(d => d.field).join() === 'water_temp',
    '其他兩邊都有的照常比')
  r.check(computeBrewDiff(base({ grinder_id: null, grinderName: null }), base()).length === 0, '一邊沒選磨豆機：不列')
  r.check(computeBrewDiff(base({ brew_method_id: 'm1', methodName: '四六法' }), base()).length === 0,
    '比較對象沒選手法、這一筆選了：不列（不是調整，是記得比較詳細）')
  r.check(computeBrewDiff(base({ total_time: null }), base()).length === 0, '一邊沒填沖煮時間：不列')
  r.check(computeBrewDiff(base({ steps: [] }), base()).length === 0, '一邊沒有分段：段數、水量、停水時長都不列')
  r.check(!JSON.stringify(computeBrewDiff(base({ dose: null, steps: [] }), base({ water_temp: null }))).includes('沒填'),
    '畫面上不再出現「沒填」')

  r.section('評分那一列')
  r.check(JSON.stringify(ratingDiff(3, 4)) === JSON.stringify({ field: 'rating', label: '評分', before: '3', after: '4' }), '3 → 4')
  r.check(ratingDiff(4, 4)?.before === '4' && ratingDiff(4, 4)?.after === '4', '相同也列出（參數相同時評分那一列照樣顯示）')
  r.check(ratingDiff(null, 4) === null && ratingDiff(4, null) === null && ratingDiff(undefined, 3) === null, '一邊沒有評分：沒有這一列')

  r.section('分段結構')
  const fewer = computeBrewDiff(base({ steps: [step(1, 45, 40), step(2, 30, 160), step(3, null, 260)] }), base())
  r.check(fewer.some(d => d.field === 'step_count' && d.before === '4 段' && d.after === '3 段'), '段數變化')
  const waterOnly = computeBrewDiff(
    base({ steps: [step(1, 45, 40), step(2, 30, 170), step(3, 30, 220), step(4, null, 290)] }), base())
  r.check(waterOnly.length === 1 && waterOnly[0]!.field === 'step_water', '只改水量時不會誤報時間差異')
  const timeOnly = computeBrewDiff(
    base({ steps: [step(1, 50, 40), step(2, 30, 160), step(3, 30, 220), step(4, null, 290)] }), base())
  r.check(timeOnly.length === 1 && timeOnly[0]!.field === 'step_time', '只改時間時不會誤報水量差異')
  r.check(timeOnly[0]!.before === '45 / 30 / 30' && timeOnly[0]!.after === '50 / 30 / 30',
    '呈現的就是資料庫裡的停留秒數；最後一段永遠沒有停留，尾端的空值不列出來')
  const middleBlank = computeBrewDiff(
    base({ steps: [step(1, 45, 40), step(2, null, 160), step(3, 30, 220), step(4, null, 290)] }), base())
  r.check(middleBlank[0]!.after === '45 / — / 30', '中間漏填的那一段顯示為 —，不是省略')

  r.section('沒記錄分段時間（hold_seconds 全為 NULL）')
  // 記錄分段時間預設關閉，多數新紀錄沒有時間。差異區不能比出憑空的數字
  const untimed = [step(1, null, 40), step(2, null, 160), step(3, null, 220), step(4, null, 290)]
  r.check(computeBrewDiff(base({ steps: untimed }), base({ steps: untimed })).length === 0,
    '兩邊都沒記錄：沒有差異')
  const untimedTotal = computeBrewDiff(base({ steps: untimed, total_time: 150 }), base({ steps: untimed }))
  r.check(untimedTotal.length === 1 && untimedTotal[0]!.field === 'total_time',
    '兩邊都沒記錄、只改沖煮時間：只比出沖煮時間——分段時間不再與 total_time 有任何關係')
  const untimedFewer = computeBrewDiff(base({ steps: untimed.slice(0, 3) }), base({ steps: untimed }))
  r.check(untimedFewer.some(d => d.field === 'step_count') && !untimedFewer.some(d => d.field === 'step_time'),
    '兩邊都沒記錄、段數不同：比出段數，不比停留秒數')
  const oneSide = computeBrewDiff(base({ steps: untimed }), base())
  r.check(!oneSide.some(d => d.field === 'step_time'), '只有一邊有記錄：略過停水時長（一邊沒填就略過）')
  const bloomOnly = [step(1, null, 40)]
  r.check(!computeBrewDiff(base({ steps: bloomOnly, total_time: 120 }), base({ steps: bloomOnly }))
    .some(d => d.field === 'step_time'),
  '只有一段：它就是最後一段，沒有停留可比——沖煮時間自己有一條')

  r.section('舊紀錄的攪拌段：先併掉再比（和畫面上的分段一致）')
  const stir = (i: number, hold: number | null, w: number) => ({ ...step(i, hold, w), step_type: 'stir' as const })
  const plain = [step(1, 30, 40), step(2, 45, 160), step(3, null, 240)]
  const stirred = [step(1, 30, 40), stir(2, 10, 40), step(3, 45, 160), step(4, null, 240)]
  const withStir = computeBrewDiff(base({ steps: stirred }), base({ steps: plain }))
  r.check(!withStir.some(d => d.field === 'step_count'), '攪拌段不算一段：悶蒸＋攪拌＋兩注 和 悶蒸＋兩注 段數相同')
  r.check(!withStir.some(d => /40 \/ 40/.test(d.after)), '累積水量不出現畫面上看不到的那一段（40 / 40 / 160 / 240）')
  const stirTime = withStir.find(d => d.field === 'step_time')
  r.check(stirTime?.before === '30 / 45' && stirTime.after === '40 / 45', `停水時長相加之後才比：${stirTime?.before} → ${stirTime?.after}`)
  r.check(computeBrewDiff(base({ steps: stirred }), base({ steps: stirred })).length === 0, '兩邊是同一組含攪拌的分段：沒有差異')

  return r.finish()
}
