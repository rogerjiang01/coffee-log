// 紀錄卡片（紀錄分頁的列表，《03》§4.21）上的文字。頁面與元件只負責畫，格式都在這裡。
//
// 卡片只呈現「這一杯」的沖煮參數，不和上一杯比較——差異只在紀錄詳情頁與結算頁（《02》§4.2）。

import { brewRatioLabel, secondsToClock } from './brewSteps.ts'

/** 沒填的欄位。和數值同一個顏色、同一個位置，五欄才上下對齊 */
export const CARD_EMPTY = '—'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'] as const

/**
 * 沖煮日期，只到日（2026-11-24 縮短；完整的日期時間在紀錄詳情頁）：
 *   今年       `M/D 週X`（11/21 週六），月日不補零
 *   不是今年   `YYYY/M/D`（2025/11/21），不加星期
 * 「今年」與時區都照瀏覽器的本地時間（《01》§0 第 7 條：存 UTC，轉換在前端）。
 */
export function cardBrewDate(iso: string, now: Date = new Date()): string {
  const d = new Date(iso)
  const day = `${d.getMonth() + 1}/${d.getDate()}`
  return d.getFullYear() === now.getFullYear()
    ? `${day} 週${WEEKDAYS[d.getDay()]}`
    : `${d.getFullYear()}/${day}`
}

export interface CardParamInput {
  dose: number | null
  grindSetting: number | null
  waterTemp: number | null
  totalTime: number | null
  /** 總水量（最後一段的累積水量）。沒有分段時是 null，粉水比因此也是「—」 */
  totalWater: number | null
}

export interface CardParam {
  label: string
  value: string
}

/**
 * 五欄，順序照 Figma：粉重、刻度、水溫、時間、粉水比。
 * 數值格式與紀錄詳情頁同一套（18 g、28、92 °C、2:12、1:16.0）。
 *
 * 標籤是簡稱（《04》）：「刻度」是研磨刻度的簡稱；「時間」只在這張卡片上代表沖煮時間——
 * 五欄等寬，「沖煮時間」四個字在 360px 寬時放不下，而卡片上沒有停水時長可以混淆。
 */
export function cardParams(input: CardParamInput): CardParam[] {
  const or = (value: string | null) => value ?? CARD_EMPTY
  return [
    { label: '粉重', value: or(input.dose === null ? null : `${input.dose} g`) },
    { label: '刻度', value: or(input.grindSetting === null ? null : String(input.grindSetting)) },
    { label: '水溫', value: or(input.waterTemp === null ? null : `${input.waterTemp} °C`) },
    { label: '時間', value: or(input.totalTime === null ? null : secondsToClock(input.totalTime) || null) },
    { label: '粉水比', value: or(brewRatioLabel(input.totalWater, input.dose)) },
  ]
}
