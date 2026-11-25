// 烘焙度與卡片填充色的對應（《03-介面規範》§2、§4.5）。
// 無豆袋照片時用烘焙度色階填充並疊上豆名，深焙端白字、淺焙端深字。

export type RoastLevel = 'light' | 'medium_light' | 'medium' | 'medium_dark' | 'dark'

export const roastLabels: Record<RoastLevel, string> = {
  light: '淺焙',
  medium_light: '中淺焙',
  medium: '中焙',
  medium_dark: '中深焙',
  dark: '深焙',
}

const fills: Record<RoastLevel, { background: string; color: string }> = {
  light: { background: 'var(--roast-light)', color: 'var(--on-roast-light)' },
  medium_light: { background: 'var(--roast-medium-light)', color: 'var(--on-roast-medium-light)' },
  medium: { background: 'var(--roast-medium)', color: 'var(--on-roast-medium)' },
  medium_dark: { background: 'var(--roast-medium-dark)', color: 'var(--on-roast-medium-dark)' },
  dark: { background: 'var(--roast-dark)', color: 'var(--on-roast-dark)' },
}

/**
 * 沒有照片、也沒填烘焙度時的填充（《03》§4.5）。規格只定義了五級對應，
 * 而只填豆名存檔正是常見狀態，所以給一個中性的暖灰，不假裝它是淺焙。
 *
 * 2026-11-11 起有自己的 token：--roast-unknown（stone-400）。
 * 之前 token 裡沒有中性灰，借用的是 --field-border；更早是 --surface（白），
 * 放在白色卡片上看不見，豆名看起來像莫名其妙往右縮排。
 * 不用 --border：骨架（載入中）用的就是它，佔位會被看成還在讀取。
 * 全站共用：豆子列表、豆子詳情、總覽的最近沖煮與最高分、結算頁的摘要。
 */
const unknownFill = { background: 'var(--roast-unknown)', color: 'var(--on-roast-unknown)' }

export function roastFill(level: RoastLevel | null | undefined) {
  return level ? fills[level] : unknownFill
}

/** 養豆天數。roast_date 為空時回 null，介面不顯示，不得阻擋或報錯。 */
export function restDays(roastDate: string | null | undefined, since: Date = new Date()) {
  if (!roastDate) return null
  const roasted = new Date(`${roastDate}T00:00:00`)
  if (Number.isNaN(roasted.getTime())) return null
  const days = Math.floor((since.getTime() - roasted.getTime()) / 86400000)
  return days >= 0 ? days : null
}

/**
 * 養豆天數的寫法（紀錄詳情、分享頁、結算頁共用；《04》「養豆天數」）。
 * 0 是「烘焙當天」（「養豆第 0 天」讀起來不像一個日子）；1 以上是「養豆第 N 天」。
 * 算不出來（沒有烘焙日期）或沖煮日期早於烘焙日期（負數）時回 null，介面不顯示。
 */
export function restDayLabel(days: number | null | undefined): string | null {
  if (days === null || days === undefined || !Number.isFinite(days) || days < 0) return null
  return days === 0 ? '烘焙當天' : `養豆第 ${days} 天`
}
