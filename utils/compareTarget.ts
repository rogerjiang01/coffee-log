// 比較對象（《02》§7「和 M/D 那一杯相比」）。結算頁、紀錄詳情、紀錄分頁的差異提示共用這一條：
//
//   這一筆是複製來的    比複製來源那一筆
//   不是複製來的        比同一支豆子在這一筆之前（依沖煮日期）的最近一筆
//   都沒有              沒有比較對象
//
// 只比複製來源的話，大部分紀錄不是複製來的，就沒有比較可看。
// 複製是使用者明確選擇的出發點，所以優先。
//
// 豆子詳情的比較表不用這一條，維持跟前一列比。
//
// 「之前」的排序與列表相同：先比 brewed_at，同時間再比 id。

export interface CompareCandidate {
  id: string
  bean_id: string | null
  brewed_at: string
  copied_from_brew_id?: string | null
}

/** a 是否排在 b 之前（較早） */
function earlier(a: CompareCandidate, b: CompareCandidate): boolean {
  const ta = new Date(a.brewed_at).getTime()
  const tb = new Date(b.brewed_at).getTime()
  return ta !== tb ? ta < tb : a.id < b.id
}

/**
 * 比較對象的 id。candidates 是同一支豆子的紀錄（可以混進別的豆子，會被濾掉；可以包含這一筆自己）。
 * 複製來源被刪除時外鍵會被設成 null，自然退回第二條。
 */
export function compareTargetId(brew: CompareCandidate, candidates: readonly CompareCandidate[]): string | null {
  if (brew.copied_from_brew_id) return brew.copied_from_brew_id
  if (!brew.bean_id) return null
  let found: CompareCandidate | null = null
  for (const other of candidates) {
    if (other.id === brew.id || other.bean_id !== brew.bean_id) continue
    if (!earlier(other, brew)) continue
    if (!found || earlier(found, other)) found = other
  }
  return found?.id ?? null
}

/** 「和 M/D 那一杯相比」的 M/D：本地時間，不補零 */
export function monthDay(iso: string): string {
  const date = new Date(iso)
  return `${date.getMonth() + 1}/${date.getDate()}`
}
