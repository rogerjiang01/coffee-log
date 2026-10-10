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
 * 沒有照片、也沒填烘焙度時的填充（《03》§4.5，2026-10-10）。規格只定義了五級對應，
 * 而只填豆名存檔正是常見狀態，所以給一個中性的灰，不假裝它是淺焙。
 *
 * 原本是 --surface（白）：放在白色卡片上看不見，豆名看起來像莫名其妙往右縮排。
 * 改用 --field-border（sand-200）——token 裡沒有中性灰，這是既有語意 token 裡
 * 在白色卡片與頁面底色上都看得出邊界、又不會被當成某一級烘焙度的那一個。
 * 不用 --border：骨架（載入中）用的就是它，佔位會被看成還在讀取。
 * 全站共用：豆子列表、豆子詳情、總覽的上一杯與最高分、結算頁的摘要。
 */
const unknownFill = { background: 'var(--field-border)', color: 'var(--text)' }

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
