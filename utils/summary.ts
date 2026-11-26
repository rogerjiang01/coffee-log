// 結算頁的內容（《02》§5「結算頁」）。頁面只負責畫，顯示條件都在這裡。

import { roastLabels, restDays, type RoastLevel } from './roast.ts'
import { brewRatioLabel, secondsToClock, toStepInputs, totalWater, type StepRow } from './brewSteps.ts'
import { totalsCard, type StatBrew } from './dashboard.ts'

/**
 * 這是不是使用者的第一筆紀錄（不含範例紀錄）。是的話小數據列的「紀錄」寫「第一筆」，不寫「第 1 筆」。
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
 * 第一杯（沒有比較對象）的「這支豆子」：只放使用者輸入這一杯時沒看到的資訊。
 *   rows         產國、產區、處理法、烘焙度，有填才列（「這支豆子」那一段的唯讀列）
 *   restDay      養豆天數，有烘焙日期才有，算法與紀錄詳情相同（烘焙日到沖煮日期）。結算頁的小數據列用，
 *                **每一杯都有**，不限第一杯
 *   beanOrdinal  第 N 支豆子：有紀錄的豆子數（排除範例紀錄），包含這一支。只在第一杯的小數據列出現
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

export interface SummaryParamsBrew {
  dose: number | null
  water_temp: number | null
  grind_setting: number | null
  total_time: number | null
}

/** 沒填的值（和紀錄卡片同一種寫法） */
export const PARAM_EMPTY = '—'

/**
 * 結算頁的「沖煮參數」卡片（2026-11-26，Figma 結算頁 v2）：兩欄三列，順序固定、**沒填也佔位寫「—」**。
 *   粉重　　　總水量
 *   粉水比　　水溫
 *   刻度　　　時間
 * 單位接在數值後面，和紀錄詳情相同（「15 g」「92 °C」）；時間是 m:ss。
 * 「刻度」「時間」是簡稱：兩欄的卡片放不下全稱（《04》）。
 */
export function summaryParams(brew: SummaryParamsBrew, steps: StepRow[]): SummaryRow[] {
  const number = (value: number | null, unit = '') => (value === null ? null : `${Number(value)}${unit}`)
  const water = totalWater(toStepInputs(steps))
  const rows: [string, string | null][] = [
    ['粉重', number(brew.dose, ' g')],
    ['總水量', number(water, ' g')],
    ['粉水比', brewRatioLabel(water, brew.dose)],
    ['水溫', number(brew.water_temp, ' °C')],
    ['刻度', number(brew.grind_setting)],
    ['時間', brew.total_time === null ? null : secondsToClock(brew.total_time) || null],
  ]
  return rows.map(([label, value]) => ({ label, value: value ?? PARAM_EMPTY }))
}
