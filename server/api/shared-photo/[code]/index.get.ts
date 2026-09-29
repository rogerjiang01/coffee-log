// 分享頁要這一次開啟用的豆袋照片網址（server/utils/sharedPhoto.ts）。
// 回傳 { url }，只有這一個 key：代碼無效、紀錄已刪除、沒有照片，一律 { url: null }，不分原因。

import { resolveSharedPhotoUrl } from '../../../utils/sharedPhoto'
import { sharedPhotoSecret, sharedPhotoStore } from '../../../utils/sharedPhotoStore'

export default defineEventHandler(async (event) => {
  // 網址每次開啟重新產生，這個回應不能被任何一層快取住
  setResponseHeaders(event, { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' })
  const code = getRouterParam(event, 'code') ?? ''
  return resolveSharedPhotoUrl(sharedPhotoStore(event), sharedPhotoSecret(event), code, Date.now() / 1000)
})
