// 暫存 key 加上目前使用者的 id（utils/draft.ts 的 scopeDraftKey）。
//
// 表單與頁面只認得 draft:brew:new 這種邏輯 key，實際寫進 localStorage 與
// IndexedDB 的一律經過這裡。在 setup 當下取一次就好：表單掛載期間換帳號
// 一定會經過登入頁，表單早已卸載。
//
// 沒有使用者時回 undefined，呼叫端就不做暫存——寧可不存，也不存成所有人共用的 key。

export function useScopedDraftKey(key: string | undefined): string | undefined {
  const userId = useCurrentUserId()
  if (!key || !userId.value) return undefined
  return scopeDraftKey(userId.value, key)
}
