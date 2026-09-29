// 豆袋照片本身（server/utils/sharedPhoto.ts）。v=thumb 是縮圖（沒有縮圖檔時退回原圖），v=full 是原圖。
// 簽章、版本、到期、代碼任何一關沒過都是 404，不分原因。

import { loadSharedPhoto } from '../../../utils/sharedPhoto'
import { sharedPhotoSecret, sharedPhotoStore } from '../../../utils/sharedPhotoStore'
import { startTiming } from '../../../utils/tempTiming' // TEMP-TIMING

export default defineEventHandler(async (event) => {
  const code = getRouterParam(event, 'code') ?? ''
  const timing = startTiming(event, `image-${String(getQuery(event).v)}`) // TEMP-TIMING
  const file = await loadSharedPhoto(
    sharedPhotoStore(event), sharedPhotoSecret(event), code, getQuery(event), Date.now() / 1000)
  timing.finish() // TEMP-TIMING
  if (!file) {
    setResponseHeader(event, 'Cache-Control', 'no-store')
    throw createError({ statusCode: 404 })
  }
  setResponseHeaders(event, {
    'Content-Type': file.type,
    // private：只存在看的人自己的瀏覽器，CDN 不留。效期與網址到期時間一致。
    // 代價：分享者在這段時間內換了照片，已經看過的人要等快取到期才看到新的那張（最多 1 小時 15 分）
    'Cache-Control': `private, max-age=${file.maxAge}`,
    'X-Content-Type-Options': 'nosniff',
    // 圖片不需要執行任何東西；萬一被當成文件直接打開，也什麼都載不進來
    'Content-Security-Policy': `default-src 'none'; sandbox`,
    'X-Robots-Tag': 'noindex',
  })
  return file.bytes
})
