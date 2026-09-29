// 豆袋照片本身（server/utils/sharedPhoto.ts）。簽章、到期、代碼任何一關沒過都是 404，不分原因。

import { loadSharedPhoto } from '../../../utils/sharedPhoto'
import { sharedPhotoSecret, sharedPhotoStore } from '../../../utils/sharedPhotoStore'

export default defineEventHandler(async (event) => {
  const code = getRouterParam(event, 'code') ?? ''
  const file = await loadSharedPhoto(
    sharedPhotoStore(event), sharedPhotoSecret(event), code, getQuery(event), Date.now() / 1000)
  if (!file) {
    setResponseHeader(event, 'Cache-Control', 'no-store')
    throw createError({ statusCode: 404 })
  }
  setResponseHeaders(event, {
    'Content-Type': file.type,
    // private：只存在看的人自己的瀏覽器，CDN 不留。效期不超過網址本身
    'Cache-Control': `private, max-age=${file.maxAge}`,
    'X-Content-Type-Options': 'nosniff',
    // 圖片不需要執行任何東西；萬一被當成文件直接打開，也什麼都載不進來
    'Content-Security-Policy': `default-src 'none'; sandbox`,
    'X-Robots-Tag': 'noindex',
  })
  return file.bytes
})
