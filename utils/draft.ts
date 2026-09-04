// 表單自動暫存（《02-功能規格》§6）。
//
// 背景：競品最大的缺陷是填到一半按返回會全部消失。那是使用者只會遇到
// 一次、然後再也不回來的錯誤，所以這是必要功能不是加分項。
//
// 純邏輯放在這裡，localStorage 的存取與 debounce 在 composable 裡。

export const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000

export interface DraftEnvelope<T> {
  savedAt: number
  data: T
}

export function draftKey(kind: 'brew' | 'bean', id: string | null) {
  return `draft:${kind}:${id ?? 'new'}`
}

export function packDraft<T>(data: T, now: number = Date.now()) {
  return JSON.stringify({ savedAt: now, data } satisfies DraftEnvelope<T>)
}

/**
 * 讀回暫存。超過 7 天、格式不對、或根本不是 JSON 都回 null——
 * 壞掉的暫存不該讓表單開不起來。
 */
export function unpackDraft<T>(raw: string | null, now: number = Date.now()): T | null {
  if (!raw) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  }
  catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object') return null
  const envelope = parsed as Partial<DraftEnvelope<T>>
  if (typeof envelope.savedAt !== 'number' || !('data' in envelope)) return null
  if (now - envelope.savedAt > DRAFT_TTL_MS) return null
  return envelope.data as T
}

/**
 * 把指向已刪除資料的 id 清掉。
 *
 * 暫存裡有豆子與器材的 id，那些東西可能在這幾天內被刪掉了。
 * 不處理的話還原後看起來正常，一按儲存就撞外鍵；
 * 或是下拉找不到對應項目而顯示空白，使用者不知道發生什麼事。
 *
 * 陣列欄位（例如風味標籤）逐項過濾，其餘欄位整個設為 null。
 */
export function pruneMissingIds<T extends Record<string, unknown>>(
  data: T,
  fields: string[],
  exists: (id: string) => boolean,
): { data: T, dropped: string[] } {
  const next = { ...data }
  const dropped: string[] = []

  for (const field of fields) {
    const value = next[field]
    if (typeof value === 'string' && value) {
      if (!exists(value)) {
        ;(next as Record<string, unknown>)[field] = null
        dropped.push(field)
      }
    }
    else if (Array.isArray(value)) {
      const kept = value.filter(item => typeof item !== 'string' || exists(item))
      if (kept.length !== value.length) {
        ;(next as Record<string, unknown>)[field] = kept
        dropped.push(field)
      }
    }
  }

  return { data: next, dropped }
}

/** 收集暫存裡所有需要驗證存在性的 id */
export function collectIds(data: Record<string, unknown>, fields: string[]) {
  const ids = new Set<string>()
  for (const field of fields) {
    const value = data[field]
    if (typeof value === 'string' && value) ids.add(value)
    else if (Array.isArray(value)) {
      for (const item of value) if (typeof item === 'string' && item) ids.add(item)
    }
  }
  return [...ids]
}
