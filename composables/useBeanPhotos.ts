// 豆袋照片的 Storage 操作。
// bucket 為 private，路徑格式 {user_id}/{bean_id}.{ext}（《01》§7），
// 顯示時需要簽名網址。
//
// 簽名網址連同過期時間一起快取，理由與規則見 utils/photoUrlCache.ts。

import { createPhotoUrlCache, SIGNED_URL_TTL_SECONDS } from '../utils/photoUrlCache.ts'

const BUCKET = 'bean-photos'

// 模組層的快取在 SSR 時會跨請求共用，所以伺服器端一律不讀不寫（見下方）。
// 這些函式只在 onMounted 之後的流程裡被呼叫，伺服器端本來就走不到。
const urlCache = createPhotoUrlCache()

export function useBeanPhotos() {
  const supabase = useSupabaseClient()

  async function upload(userId: string, beanId: string, image: CompressedImage) {
    const path = `${userId}/${beanId}.${image.ext}`
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, image.blob, { contentType: image.blob.type, upsert: true })
    if (error) throw new Error(`照片上傳失敗：${errorText(error)}`)
    // **必須清掉。** 換照片時路徑不變（同一個 bean id、同樣是 .webp、upsert），
    // 快取的網址字串也就不變——瀏覽器會繼續從它的快取給舊的那張圖。
    // 清掉之後下次顯示會產生新的簽名網址，瀏覽器才會去拿新內容。
    urlCache.forget(path)
    return path
  }

  /**
   * 刪除照片。**永遠不丟例外。**
   *
   * 呼叫端都是「資料列已經刪掉了，順手清一下 Storage」的情境。
   * 這一步失敗只會留下一個孤兒檔案，而讓它中斷刪除流程的代價是
   * 使用者以為豆子沒刪掉——照片留著比刪不掉整筆資料糟糕得多。
   *
   * 不做重試。失敗寫進 console 就好，孤兒檔案之後靠後台清理，
   * 不值得為它在使用者面前加一層錯誤處理。
   */
  async function remove(path: string) {
    urlCache.forget(path)
    try {
      const { error } = await supabase.storage.from(BUCKET).remove([path])
      if (error) console.warn(`[bean-photos] 照片沒有刪成功，留下孤兒檔案：${path}`, error)
    }
    catch (e) {
      console.warn(`[bean-photos] 照片沒有刪成功，留下孤兒檔案：${path}`, e)
    }
  }

  async function signedUrl(path: string | null) {
    if (!path) return null
    if (import.meta.client) {
      const cached = urlCache.get(path, Date.now())
      if (cached) return cached
    }
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
    const url = data?.signedUrl ?? null
    if (url && import.meta.client) urlCache.set(path, url, Date.now())
    return url
  }

  /**
   * 列表用：一次換一批，避免每張照片各發一次請求。
   * 快取裡還夠新的直接用，只為缺的或快過期的發請求——
   * 全部都在快取裡時一趟都不用發。
   */
  async function signedUrls(paths: (string | null)[]) {
    const now = Date.now()
    const { fresh, stale } = import.meta.client
      ? urlCache.partition(paths, now)
      : { fresh: new Map<string, string>(), stale: [...new Set(paths.filter((p): p is string => !!p))] }

    if (!stale.length) return fresh

    const { data } = await supabase.storage.from(BUCKET).createSignedUrls(stale, SIGNED_URL_TTL_SECONDS)
    for (const item of data ?? []) {
      if (!item.path || !item.signedUrl) continue
      fresh.set(item.path, item.signedUrl)
      if (import.meta.client) urlCache.set(item.path, item.signedUrl, now)
    }
    return fresh
  }

  return { upload, remove, signedUrl, signedUrls }
}
