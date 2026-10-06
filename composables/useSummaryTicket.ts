/**
 * 結算頁的 ticket：剛存好的那一筆紀錄的 id（utils/navigation.ts 的 summaryAccess）。
 * 只在記憶體裡，重新整理就沒了——結算頁只在剛建立時出現。
 */
export function useSummaryTicket() {
  return useState<string | null>('summary-ticket', () => null)
}
