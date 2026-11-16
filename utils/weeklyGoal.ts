// 每週記錄目標（《01》§15、《02》§4）。
//
// **週一開始，用瀏覽器的本地時間。** 資料庫存 UTC、時區轉換在前端（《01》§0 第 7 條），
// 沖煮日期的顯示、datetime-local 的輸入、養豆天數都是這個慣例，週與月的邊界也一樣。
//
// 目標存的是修改歷程（weekly_goals 每次修改新增一列）：
//   目前的目標    最新的一列
//   某一週的目標  那一週結束前最後一次修改的值——本週中途修改，會立刻套用到本週

export const GOAL_MIN = 1
export const GOAL_MAX = 21
/** 目標設定頁的預設值 */
export const GOAL_DEFAULT = 3

export interface GoalRow {
  cups: number
  created_at: string
}

/** 這一週的週一 00:00（本地時間） */
export function weekStart(date: Date): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  // getDay：週日是 0。往回推到週一
  const offset = (start.getDay() + 6) % 7
  start.setDate(start.getDate() - offset)
  return start
}

/** 下一週的週一 00:00（本地時間）。用 setDate 而不是加 7×24 小時：日光節約時間那一週不是 168 小時 */
export function weekEnd(date: Date): Date {
  const end = weekStart(date)
  end.setDate(end.getDate() + 7)
  return end
}

/** 這個月的 1 日 00:00 與下個月的 1 日 00:00（本地時間） */
export function monthRange(date: Date): [Date, Date] {
  return [new Date(date.getFullYear(), date.getMonth(), 1), new Date(date.getFullYear(), date.getMonth() + 1, 1)]
}

/** 週一是 0、週日是 6 */
export function weekdayIndex(date: Date): number {
  return (date.getDay() + 6) % 7
}

export function inRange(iso: string, [from, to]: [Date, Date]): boolean {
  const time = new Date(iso).getTime()
  return time >= from.getTime() && time < to.getTime()
}

function latest(goals: readonly GoalRow[], before?: Date): GoalRow | null {
  let found: GoalRow | null = null
  for (const goal of goals) {
    const time = new Date(goal.created_at).getTime()
    if (before && time >= before.getTime()) continue
    if (!found || time >= new Date(found.created_at).getTime()) found = goal
  }
  return found
}

/** 目前的目標：最新的一列。還沒有任何目標時是 null */
export function currentGoal(goals: readonly GoalRow[]): number | null {
  return latest(goals)?.cups ?? null
}

/**
 * 某一週的目標：那一週結束前最後一次修改的值。
 * 那一週結束時還沒設定過目標的話是 null（不拿之後才設定的值回推）。
 */
export function goalForWeek(goals: readonly GoalRow[], dayInWeek: Date): number | null {
  return latest(goals, weekEnd(dayInWeek))?.cups ?? null
}

export function clampGoal(value: number): number {
  return Math.min(GOAL_MAX, Math.max(GOAL_MIN, Math.round(value)))
}

/**
 * 目標環畫多少（《03》§4.15）：達成的比例，0 到 1。超過目標時停在一圈，不畫第二圈
 * （2026-11-16，總覽與結算頁一致；超出多少由「超過 N 杯」說明）。
 */
export function ringFraction(count: number, goal: number): number {
  if (goal <= 0) return 0
  return Math.min(Math.max(0, count) / goal, 1)
}

/**
 * 要不要先去目標設定頁（《02》§4.4）：已登入、而且還沒有任何目標時。
 * 分享頁、登入註冊與目標設定頁本身不導向。
 */
export const GOAL_SETUP_PATH = '/goal'

export function needsGoalSetup(path: string, signedIn: boolean, hasGoal: boolean | null): boolean {
  if (!signedIn || hasGoal !== false) return false
  if (path === GOAL_SETUP_PATH) return false
  if (path.startsWith('/s/') || path === '/login' || path === '/signup' || path === '/confirm') return false
  return true
}
