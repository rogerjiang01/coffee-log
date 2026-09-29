// 分享頁要豆袋照片的網址（server/utils/sharedPhoto.ts）。
// 回傳 { thumb, full }，只有這兩個 key：代碼無效、紀錄已刪除、沒有照片，一律兩個都是 null，不分原因。

import { resolveSharedPhotoUrls } from '../../../utils/sharedPhoto'
import { sharedPhotoSecret, sharedPhotoStore } from '../../../utils/sharedPhotoStore'

export default defineEventHandler(async (event) => {
  // 每次開啟重新簽一次（簽出來的網址在同一段時間內相同，圖片才吃得到快取），這個回應本身不快取
  setResponseHeaders(event, { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' })
  const code = getRouterParam(event, 'code') ?? ''
  return resolveSharedPhotoUrls(sharedPhotoStore(event), sharedPhotoSecret(event), code, Date.now() / 1000)
})
