// 豆袋照片的 Storage 操作。
// bucket 為 private，路徑格式 {user_id}/{bean_id}.{ext}（《01》§7），
// 顯示時需要簽名網址。
//
// 簽名網址連同過期時間一起快取，理由與規則見 utils/photoUrlCache.ts。
//
// 每張照片旁邊另存一張縮圖（utils/beanPhoto.ts）。上傳、刪除時兩張一起處理；
// 顯示縮圖大小的地方一律走 thumbnailUrl(s)，縮圖檔還不存在時退回原圖。

import { createPhotoUrlCache, SIGNED_URL_TTL_SECONDS } from '../utils/photoUrlCache.ts'
import { beanThumbPath } from '../utils/beanPhoto.ts'

const BUCKET = 'bean-photos'

// 模組層的快取在 SSR 時會跨請求共用，所以伺服器端一律不讀不寫（見下方）。
// 這些函式只在 onMounted 之後的流程裡被呼叫，伺服器端本來就走不到。
const urlCache = createPhotoUrlCache()

export function useBeanPhotos() {
  const supabase = useSupabaseClient()

  /**
   * 上傳縮圖。**永遠不丟例外**：縮圖失敗時顯示端會退回原圖，
   * 不值得為它讓整筆豆子存不起來
   */
  async function uploadThumbnail(path: string, image: CompressedImage) {
    const thumb = beanThumbPath(path)
    try {
      const small = await makeBeanThumbnail(image.blob)
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(thumb, small.blob, { contentType: small.blob.type, upsert: true })
      if (error) console.warn(`[bean-photos] 縮圖沒有上傳成功，顯示時退回原圖：${thumb}`, error)
    }
    catch (e) {
      console.warn(`[bean-photos] 縮圖沒有產生成功，顯示時退回原圖：${thumb}`, e)
    }
  }

  async function upload(userId: string, beanId: string, image: CompressedImage) {
    const path = `${userId}/${beanId}.${image.ext}`
    // 原圖與縮圖同時上傳：縮圖從已經壓縮過的原圖再縮，不必等原圖傳完
    const [{ error }] = await Promise.all([
      supabase.storage.from(BUCKET).upload(path, image.blob, { contentType: image.blob.type, upsert: true }),
      uploadThumbnail(path, image),
    ])
    if (error) throw new Error(`照片上傳失敗：${errorText(error)}`)
    // **必須清掉。** 換照片時路徑不變（同一個 bean id、同樣是 .webp、upsert），
    // 快取的網址字串也就不變——瀏覽器會繼續從它的快取給舊的那張圖。
    // 清掉之後下次顯示會產生新的簽名網址，瀏覽器才會去拿新內容。縮圖同理
    urlCache.forget(path)
    urlCache.forget(beanThumbPath(path))
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
    // 縮圖一起刪。還沒有縮圖的舊照片也照樣列進去：刪一個不存在的檔案不算錯
    const files = [path, beanThumbPath(path)]
    for (const file of files) urlCache.forget(file)
    try {
      const { error } = await supabase.storage.from(BUCKET).remove(files)
      if (error) console.warn(`[bean-photos] 照片沒有刪成功，留下孤兒檔案：${files.join('、')}`, error)
    }
    catch (e) {
      console.warn(`[bean-photos] 照片沒有刪成功，留下孤兒檔案：${files.join('、')}`, e)
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

  /**
   * 縮圖大小的地方用這個：回傳以**原圖路徑**為 key 的網址。
   * 先一次要全部的縮圖；縮圖檔不存在的（Storage 對不存在的物件不發簽名網址），
   * 再一次要它們的原圖。都在快取裡時一趟都不用發
   */
  async function thumbnailUrls(paths: (string | null)[]) {
    const originals = [...new Set(paths.filter((p): p is string => !!p))]
    const result = new Map<string, string>()
    if (!originals.length) return result

    const thumbs = await signedUrls(originals.map(beanThumbPath))
    const missing: string[] = []
    for (const path of originals) {
      const url = thumbs.get(beanThumbPath(path))
      if (url) result.set(path, url)
      else missing.push(path)
    }
    if (missing.length) {
      const fallback = await signedUrls(missing)
      for (const [path, url] of fallback) result.set(path, url)
    }
    return result
  }

  async function thumbnailUrl(path: string | null) {
    if (!path) return null
    return (await thumbnailUrls([path])).get(path) ?? null
  }

  /**
   * 縮圖與原圖一起要（紀錄詳情頁：縮圖顯示、原圖給放大檢視）。一次請求。
   * 縮圖檔不存在時 thumb 退回原圖
   */
  async function photoUrls(path: string | null): Promise<{ thumb: string, full: string } | null> {
    if (!path) return null
    const urls = await signedUrls([beanThumbPath(path), path])
    const full = urls.get(path)
    if (!full) return null
    return { thumb: urls.get(beanThumbPath(path)) ?? full, full }
  }

  return { upload, remove, signedUrl, signedUrls, thumbnailUrl, thumbnailUrls, photoUrls }
}
