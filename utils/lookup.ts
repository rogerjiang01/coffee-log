// 查表型欄位的共通邏輯（《02-功能規格》§10）。
//
// 目的是減少同義異名的重複：「厭氧」「厭氧發酵」「Anaerobic」不該變成三筆。
// 第一版做到提示即可，不做合併或管理介面。

export interface LookupItem {
  id: string
  name: string
  aliases: string[] | null
  user_id: string | null
}

/** 比對前先抹平大小寫、空白與常見連接符號 */
export function normalize(value: string) {
  return value.toLowerCase().replace(/[\s\-_·・()（）]/g, '')
}

function editDistance(a: string, b: string) {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let diagonal = prev[0]!
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const temp = prev[j]!
      prev[j] = Math.min(
        prev[j]! + 1,
        prev[j - 1]! + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
      diagonal = temp
    }
  }
  return prev[b.length]!
}

function commonPrefixLength(a: string, b: string) {
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  return i
}

function score(input: string, candidate: string) {
  const a = normalize(input)
  const b = normalize(candidate)
  if (!a || !b) return 0
  if (a === b) return 1
  if (a.includes(b) || b.includes(a)) return 0.85

  // 中文的處理法與品種多是複合詞，辨識訊號在共同詞頭而非編輯距離：
  // 「厭氧發酵」與「厭氧日曬」只差兩字，編輯距離相似度僅 0.5，
  // 但它們正是規格要避免的那種同義異名。
  const prefix = commonPrefixLength(a, b)
  if (prefix >= 2 && prefix >= Math.min(a.length, b.length) * 0.5) return 0.7

  const distance = editDistance(a, b)
  return 1 - distance / Math.max(a.length, b.length)
}

/**
 * 找出與輸入相近的既有項目，供 filterLookup 在子字串比對無結果時退回使用。
 * 結果直接列在下拉裡讓使用者點選，不另外跳確認。
 */
export function findSimilar(input: string, items: LookupItem[], limit = 3) {
  if (!input.trim()) return []
  return items
    .map(item => ({
      item,
      score: Math.max(
        score(input, item.name),
        ...(item.aliases ?? []).map(alias => score(input, alias)),
      ),
    }))
    .filter(entry => entry.score >= 0.6)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(entry => entry.item)
}

/**
 * 即時過濾。先做子字串比對（含 aliases），沒有結果才退回模糊比對，
 * 讓「厭氧發酵」這種近似輸入仍然看得到「厭氧日曬」「厭氧水洗」。
 *
 * 用途是即時過濾而不是事後攔截：使用者打「厭氧」就會看到既有項目，
 * 自然會選既有的，不需要再問他「你是不是指」。
 */
export function filterLookup(query: string, items: LookupItem[]) {
  const q = normalize(query)
  if (!q) return items

  const direct = items.filter(item =>
    normalize(item.name).includes(q)
    || (item.aliases ?? []).some(alias => normalize(alias).includes(q)),
  )
  if (direct.length) return direct

  return findSimilar(query, items, 5)
}

/** 是否已有完全相符的項目。有的話就不顯示「新增」那一列。 */
export function hasExactMatch(query: string, items: LookupItem[]) {
  const q = normalize(query)
  if (!q) return false
  return items.some(item =>
    normalize(item.name) === q
    || (item.aliases ?? []).some(alias => normalize(alias) === q),
  )
}

/** 系統內建（user_id 為 null）排前面，使用者自建排後面 */
export function splitBySource<T extends { user_id: string | null }>(items: T[]) {
  return {
    system: items.filter(item => item.user_id === null),
    mine: items.filter(item => item.user_id !== null),
  }
}
