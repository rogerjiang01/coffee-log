// 總覽的卡片（《02》§4.1）。每張卡片的資料與顯示條件都在這裡算，頁面只負責畫。
//
// **所有統計都排除範例資料**（《01》§13）：新帳號一進來就有一筆範例紀錄，
// 算進去的話每個人的第一份數字都不是自己的。查詢已經用 is_sample = false 過濾，
// 這裡再擋一次——卡片的規則不該依賴呼叫端記得過濾。
// 排除的是範例**紀錄**；使用者在範例豆子上記的真實紀錄照常算。
//
// 本週、本月都以沖煮日期計算，週一開始，瀏覽器的本地時間（utils/weeklyGoal.ts）。

import { currentGoal, inRange, monthRange, weekdayIndex, weekEnd, weekStart, type GoalRow } from './weeklyGoal.ts'
import type { RoastLevel } from './roast.ts'

export interface StatBean {
  name: string
  photo_path: string | null
  roast_level: RoastLevel | null
  is_finished: boolean
}

export interface StatBrew {
  id: string
  bean_id: string | null
  brewed_at: string
  rating: number | null
  dose: number | null
  is_sample: boolean
  beans: StatBean | null
}

function real(brews: readonly StatBrew[]) {
  return brews.filter(brew => !brew.is_sample)
}

/** 新的在前：先比沖煮日期，同時間再比 id（與列表的排序相同） */
function newer(a: StatBrew, b: StatBrew): boolean {
  const ta = new Date(a.brewed_at).getTime()
  const tb = new Date(b.brewed_at).getTime()
  return ta !== tb ? ta > tb : a.id > b.id
}

export interface WeekCard {
  goal: number
  count: number
  /** 週一到週日每天的杯數 */
  days: number[]
}

/** 目標環：有目標就一定顯示，0 杯也顯示 */
export function weekCard(brews: readonly StatBrew[], goals: readonly GoalRow[], now: Date): WeekCard | null {
  const goal = currentGoal(goals)
  if (goal === null) return null
  const range: [Date, Date] = [weekStart(now), weekEnd(now)]
  const days = [0, 0, 0, 0, 0, 0, 0]
  for (const brew of real(brews)) {
    if (inRange(brew.brewed_at, range)) days[weekdayIndex(new Date(brew.brewed_at))]!++
  }
  return { goal, count: days.reduce((sum, n) => sum + n, 0), days }
}

export interface LastBeanCard {
  beanId: string
  bean: StatBean
  /** 這支豆子的紀錄數（第 N 杯） */
  count: number
}

/** 上一杯：未喝完的豆子裡，最近一筆紀錄所屬的那支豆子 */
export function lastBeanCard(brews: readonly StatBrew[]): LastBeanCard | null {
  let latest: StatBrew | null = null
  for (const brew of real(brews)) {
    if (!brew.bean_id || !brew.beans || brew.beans.is_finished) continue
    if (!latest || newer(brew, latest)) latest = brew
  }
  if (!latest) return null
  const beanId = latest.bean_id!
  return { beanId, bean: latest.beans!, count: real(brews).filter(brew => brew.bean_id === beanId).length }
}

function topRatedIn(brews: readonly StatBrew[], range: [Date, Date]): StatBrew | null {
  let top: StatBrew | null = null
  for (const brew of real(brews)) {
    if (brew.rating === null || !inRange(brew.brewed_at, range)) continue
    if (!top || brew.rating > top.rating! || (brew.rating === top.rating && newer(brew, top))) top = brew
  }
  return top
}

/**
 * 本週最高分（《02》§4.1）：本週評分最高的那一筆，同分取最近的一筆。
 * 本週還沒有任何有評分的紀錄時，改顯示上週的（標題跟著換成「上週最高分」）——
 * 否則每週一到第一筆紀錄之前這張卡都會消失。兩週都沒有時不顯示。
 */
export function topRatedCard(brews: readonly StatBrew[], now: Date): { brew: StatBrew, week: 'this' | 'last' } | null {
  const start = weekStart(now)
  const thisWeek = topRatedIn(brews, [start, weekEnd(now)])
  if (thisWeek) return { brew: thisWeek, week: 'this' }
  const lastStart = new Date(start)
  lastStart.setDate(lastStart.getDate() - 7)
  const lastWeek = topRatedIn(brews, [lastStart, start])
  return lastWeek ? { brew: lastWeek, week: 'last' } : null
}

/** 累計：N 筆紀錄、喝過 N 支豆子（有紀錄的豆子數）。0 筆時不顯示 */
export function totalsCard(brews: readonly StatBrew[]): { records: number, beans: number } | null {
  const rows = real(brews)
  if (!rows.length) return null
  return { records: rows.length, beans: new Set(rows.map(brew => brew.bean_id).filter(Boolean)).size }
}

/** 本月：杯數與粉重加總。本月 0 杯時不顯示 */
export function monthCard(brews: readonly StatBrew[], now: Date): { cups: number, dose: number } | null {
  const range = monthRange(now)
  const rows = real(brews).filter(brew => inRange(brew.brewed_at, range))
  if (!rows.length) return null
  // numeric 欄位讀回來可能是字串；小數到一位，避免 0.1 + 0.2 的尾數
  const dose = Math.round(rows.reduce((sum, brew) => sum + Number(brew.dose ?? 0), 0) * 10) / 10
  return { cups: rows.length, dose }
}

/** 第 N 筆紀錄（結算頁）：總紀錄數，排除範例 */
export function recordCount(brews: readonly StatBrew[]): number {
  return real(brews).length
}

/**
 * 結算頁的目標環：從存檔前的杯數前進到存檔後的杯數。
 *   這一筆不在本週        不顯示環與「本週」的文字（null）
 *   存檔前未達標、存檔後達標  crossed：補滿的瞬間強調，文字換成「本週目標達成」
 *   已經超過目標之後        照樣前進（第二圈），不出現「本週目標達成」
 */
export function summaryRing(
  brews: readonly StatBrew[], goals: readonly GoalRow[], brewId: string, now: Date,
): { goal: number, before: number, after: number, crossed: boolean } | null {
  const self = brews.find(brew => brew.id === brewId)
  const goal = currentGoal(goals)
  if (!self || goal === null) return null
  const range: [Date, Date] = [weekStart(now), weekEnd(now)]
  if (!inRange(self.brewed_at, range)) return null
  const after = real(brews).filter(brew => inRange(brew.brewed_at, range)).length
  const before = after - (self.is_sample ? 0 : 1)
  return { goal, before, after, crossed: before < goal && after >= goal }
}

export type DashboardCard = 'last' | 'top' | 'totals' | 'month'

/**
 * 卡片排成固定的兩排（《02》§4.1、《03》§4.16），目標環全寬永遠在最上面：
 *   第一排  上一杯、本週最高分（某一杯或某支豆子，點進去是詳情）
 *   第二排  累計、本月（數字）
 * 同一排只剩一張時那一張改成全寬；兩張都不顯示時整排不出現。
 * 不往前遞補：遞補會把不同性質的卡片排在一起，也會讓卡片落單。
 * 回傳要顯示的卡片與它佔幾欄（2 欄的格線）。
 */
export function dashboardRows(visible: Record<DashboardCard, boolean>): { card: DashboardCard, span: 1 | 2 }[][] {
  const rows: DashboardCard[][] = [['last', 'top'], ['totals', 'month']]
  return rows
    .map(row => row.filter(card => visible[card]))
    .filter(row => row.length)
    .map(row => row.map(card => ({ card, span: row.length === 1 ? 2 as const : 1 as const })))
}
