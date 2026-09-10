// 豆袋照片簽名網址的快取。
//
// **為什麼要快取**：簽名網址每次重新產生，同一張圖第一次是 ?token=abc、
// 第二次是 ?token=xyz，瀏覽器當成兩個不同資源，HTTP 快取完全失效——
// 每次跳頁圖片都重新下載，看得到它一格一格載進來。
// 網址穩定下來，瀏覽器才認得出「這張我已經有了」。
//
// **這推翻了先前「簽名網址一律不快取」的規則。** 當初的顧慮是對的
//（網址有時效，過期後圖會裂掉），解法是連同過期時間一起存、
// 快過期前換新，而不是每次都換新。
//
// 效期 7 天，剩不到 1 天就重新產生。那一天的緩衝是給「頁面開著放一整天」
// 與使用者裝置時鐘誤差用的——網址在畫面上時過期，圖就裂了。
//
// **換照片必須清掉這一筆**：上傳路徑是 {user_id}/{bean_id}.webp 且 upsert，
// 換照片時路徑不變，快取的網址字串也就不變——瀏覽器會繼續給舊的那張圖。
// 見 useBeanPhotos 的 upload 與 remove。

import { cacheKeys } from './cacheKeys.ts'

/** 簽名網址的效期（秒）。Supabase 的 createSignedUrl 吃秒數 */
export const SIGNED_URL_TTL_SECONDS = 7 * 24 * 60 * 60

/** 剩下的時間少於這個值就重新產生 */
export const REFRESH_WITHIN_MS = 24 * 60 * 60 * 1000

export interface CachedPhotoUrl {
  url: string
  /** 毫秒時間戳。以產生當下的本機時鐘推算，所以才需要 REFRESH_WITHIN_MS 的緩衝 */
  expiresAt: number
}

export function createPhotoUrlCache() {
  const store = new Map<string, CachedPhotoUrl>()

  /** 還夠新就回網址，否則回 null（不存在、快過期、已過期都一樣） */
  function get(path: string, now: number): string | null {
    const entry = store.get(cacheKeys.photoUrl(path))
    if (!entry) return null
    return entry.expiresAt - now > REFRESH_WITHIN_MS ? entry.url : null
  }

  function set(path: string, url: string, now: number) {
    store.set(cacheKeys.photoUrl(path), { url, expiresAt: now + SIGNED_URL_TTL_SECONDS * 1000 })
  }

  /** 換照片或刪照片時呼叫。路徑不變但內容變了，舊網址不能再用 */
  function forget(path: string) {
    store.delete(cacheKeys.photoUrl(path))
  }

  /**
   * 列表用：把一批路徑分成「快取裡有且夠新」與「需要重新產生」兩堆，
   * 只為後者發請求。重複與空值在這裡去掉。
   */
  function partition(paths: (string | null | undefined)[], now: number) {
    const fresh = new Map<string, string>()
    const stale: string[] = []
    for (const path of new Set(paths.filter((p): p is string => !!p))) {
      const url = get(path, now)
      if (url) fresh.set(path, url)
      else stale.push(path)
    }
    return { fresh, stale }
  }

  function clear() {
    store.clear()
  }

  return { get, set, forget, partition, clear }
}
