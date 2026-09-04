// 表單自動暫存（《02-功能規格》§6）。
//
// 背景：競品最大的缺陷是填到一半按返回會全部消失。那是使用者只會遇到
// 一次、然後再也不回來的錯誤，所以這是必要功能不是加分項。
//
// 純邏輯放在這裡，localStorage 的存取與 debounce 在 composable 裡。

export const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000

/**
 * 自動填入的分界。
 *
 * 技術上無法區分「重整」與「隔天回來」——兩者對頁面都只是重新載入。
 * 但可以用**離開多久**當作意圖的代理指標：剛離開幾乎必然是意外中斷
 * （重整、螢幕熄滅、切 app、接電話），隔很久才可能是「上次沒填完的舊東西」。
 *
 * 30 分鐘涵蓋通勤、開會、小睡這類典型中斷。要調整改這裡就好。
 */
export const DRAFT_AUTO_RESTORE_MS = 30 * 60 * 1000

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
export function unpackDraftEnvelope<T>(
  raw: string | null,
  now: number = Date.now(),
): DraftEnvelope<T> | null {
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
  return { savedAt: envelope.savedAt, data: envelope.data as T }
}

/** 只要內容不要時間戳 */
export function unpackDraft<T>(raw: string | null, now: number = Date.now()): T | null {
  return unpackDraftEnvelope<T>(raw, now)?.data ?? null
}

/**
 * 離開多久了？決定是直接填入還是開口問。
 *   'recent'  剛離開，幾乎必然是意外中斷 → 直接填入，用橫幅告知
 *   'stale'   隔很久，可能是要記新的一杯 → 用 overlay 問
 */
export function draftAge(savedAt: number, now: number = Date.now()): 'recent' | 'stale' {
  return now - savedAt <= DRAFT_AUTO_RESTORE_MS ? 'recent' : 'stale'
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

/**
 * 暫存欄位名 → 使用者看得懂的欄位標籤。
 *
 * 給「還原時發現對象已被刪掉」的提示用。只說「有幾個選項被刪掉了」
 * 對使用者沒有幫助——他不知道要重填哪幾格，而 bean_id 是必填，
 * 按下儲存還會再撞一次驗證。
 *
 * 標籤跟表單上的欄位標籤一致，不用資料庫欄位名。
 */
const DRAFT_FIELD_LABELS: Record<string, string> = {
  // 豆子
  country_id: '產國',
  processing_method_id: '處理法',
  variety_id: '品種',
  // 沖煮
  bean_id: '豆子',
  brew_method_id: '沖煮手法',
  grinder_id: '磨豆機',
  dripper_id: '濾杯',
  kettle_id: '手沖壺',
  filter_id: '濾紙',
  server_id: '分享壺',
  flavorTagIds: '風味標籤',
}

/**
 * 被清空的欄位講成一句話：「豆子、處理法已被刪除，請重新選擇」。
 * 對不上標籤的欄位直接跳過，寧可少講一項也不要吐出資料庫欄位名。
 */
export function droppedFieldsMessage(dropped: string[]): string {
  const labels = dropped.map(field => DRAFT_FIELD_LABELS[field]).filter((v): v is string => !!v)
  if (!labels.length) return ''
  return `${labels.join('、')}已被刪除，請重新選擇`
}
