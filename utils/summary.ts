// 結算頁的內容（《02》§5「結算頁」）。頁面只負責畫，顯示條件都在這裡。

import { roastLabels, restDays, type RoastLevel } from './roast.ts'
import { brewRatioLabel, toStepInputs, totalWater, type StepRow } from './brewSteps.ts'
import { totalsCard, type StatBrew } from './dashboard.ts'

/**
 * 這是不是使用者的第一筆紀錄（不含範例紀錄）。是的話「第 N 筆紀錄」換成「第一筆紀錄」。
 * 判斷看的是排除範例之後只剩這一筆——不是看 recordCount === 1：
 * 統計還沒讀到這一筆時（例如查詢慢了一步）不能把別的那一筆當成它。
 */
export function isFirstRecord(stats: readonly StatBrew[], brewId: string): boolean {
  const real = stats.filter(brew => !brew.is_sample)
  return real.length === 1 && real[0]!.id === brewId
}

export interface SummaryRow {
  label: string
  value: string
}

export interface FirstCupBean {
  name: string
  roast_level: RoastLevel | null
  roast_date: string | null
  region: string | null
  countries: { name_zh: string } | null
  processing_methods: { name: string } | null
}

/**
 * 第一杯（沒有比較對象）的「這支豆子」區塊：只放使用者輸入這一杯時沒看到的資訊。
 *   產國、產區、處理法、烘焙度    有填才列
 *   養豆第 N 天                   有烘焙日期才有，算法與紀錄詳情的養豆天數相同（烘焙日到沖煮日期）
 *   第 N 支豆子                   有紀錄的豆子數（排除範例紀錄），包含這一支
 */
export function firstCupBean(bean: FirstCupBean | null, brewedAt: string, stats: readonly StatBrew[]): {
  rows: SummaryRow[]
  restDay: number | null
  beanOrdinal: number
} {
  const rows: SummaryRow[] = []
  const push = (label: string, value: string | null | undefined) => {
    if (value && value.trim()) rows.push({ label, value: value.trim() })
  }
  push('產國', bean?.countries?.name_zh)
  push('產區', bean?.region)
  push('處理法', bean?.processing_methods?.name)
  push('烘焙度', bean?.roast_level ? roastLabels[bean.roast_level] : null)
  return {
    rows,
    restDay: restDays(bean?.roast_date, new Date(brewedAt)),
    beanOrdinal: totalsCard(stats)?.beans ?? 0,
  }
}

export interface FirstCupBrew {
  dose: number | null
  water_temp: number | null
  grind_setting: number | null
  brew_methods: { name: string } | null
}

/**
 * 第一杯的「這一杯」區塊：粉重、粉水比、水溫、研磨刻度、沖煮手法，有值才列。
 * 格式與比較區、紀錄詳情相同。它是下一杯的比較基準。
 */
export function firstCupRows(brew: FirstCupBrew, steps: StepRow[]): SummaryRow[] {
  const number = (value: number | null, unit = '') => (value === null ? null : `${Number(value)}${unit}`)
  const rows: [string, string | null][] = [
    ['粉重', number(brew.dose, ' g')],
    ['粉水比', brewRatioLabel(totalWater(toStepInputs(steps)), brew.dose)],
    ['水溫', number(brew.water_temp, ' °C')],
    ['研磨刻度', number(brew.grind_setting)],
    ['沖煮手法', brew.brew_methods?.name ?? null],
  ]
  return rows.filter((row): row is [string, string] => !!row[1]).map(([label, value]) => ({ label, value }))
}
