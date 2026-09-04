// 豆袋照片的 Storage 操作。
// bucket 為 private，路徑格式 {user_id}/{bean_id}.{ext}（《01》§7），
// 顯示時需要簽名網址。

const BUCKET = 'bean-photos'
const SIGNED_URL_TTL = 60 * 60

export function useBeanPhotos() {
  const supabase = useSupabaseClient()

  async function upload(userId: string, beanId: string, image: CompressedImage) {
    const path = `${userId}/${beanId}.${image.ext}`
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, image.blob, { contentType: image.blob.type, upsert: true })
    if (error) throw new Error(`照片上傳失敗：${errorText(error)}`)
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
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL)
    return data?.signedUrl ?? null
  }

  /** 列表用：一次換一批，避免每張照片各發一次請求 */
  async function signedUrls(paths: (string | null)[]) {
    const wanted = [...new Set(paths.filter((p): p is string => !!p))]
    const map = new Map<string, string>()
    if (!wanted.length) return map
    const { data } = await supabase.storage.from(BUCKET).createSignedUrls(wanted, SIGNED_URL_TTL)
    for (const item of data ?? []) {
      if (item.path && item.signedUrl) map.set(item.path, item.signedUrl)
    }
    return map
  }

  return { upload, remove, signedUrl, signedUrls }
}
