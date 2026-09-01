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
  light: { background: 'var(--roast-light)', color: 'var(--roast-light-text)' },
  medium_light: { background: 'var(--roast-medium-light)', color: 'var(--roast-medium-light-text)' },
  medium: { background: 'var(--roast-medium)', color: 'var(--roast-medium-text)' },
  medium_dark: { background: 'var(--roast-medium-dark)', color: 'var(--roast-medium-dark-text)' },
  dark: { background: 'var(--roast-dark)', color: 'var(--roast-dark-text)' },
}

/**
 * 烘焙度未填時的填充。規格只定義了五級對應，沒有定義「沒有照片也沒有烘焙度」
 * 的情況，但那正是只填豆名存檔後的常見狀態，因此給一個中性底，
 * 不假裝它是淺焙。
 */
const unknownFill = { background: 'var(--surface)', color: 'var(--text)' }

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
