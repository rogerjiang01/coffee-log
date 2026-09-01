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
    if (error) throw new Error(`照片沒有上傳成功：${error.message}`)
    return path
  }

  async function remove(path: string) {
    await supabase.storage.from(BUCKET).remove([path])
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
