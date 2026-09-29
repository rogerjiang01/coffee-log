// 豆袋照片的縮圖檔（《01》§7）。
//
// 每張豆袋照片旁邊另存一張縮圖，路徑由原圖路徑推導，不另開欄位：
//   原圖   {user_id}/{bean_id}.webp（或 .jpg——瀏覽器不支援 WebP 編碼時）
//   縮圖   {user_id}/{bean_id}.thumb
// 縮圖不帶副檔名：它的格式跟原圖一樣看瀏覽器能不能編 WebP，名字不能綁死格式。
// 格式記在 Storage 的 Content-Type 上。原圖換了副檔名，縮圖仍是同一個路徑（upsert 蓋過去）。
//
// 縮圖用在所有「縮圖大小」的地方：首頁卡片（160px）、豆子列表（96px）、分享對話框（96px）、
// 分享頁與紀錄詳情頁（64px）。原圖只用在豆子詳情的大圖、表單預覽與放大檢視。
// 縮圖檔還不存在（補產生之前的舊照片、上傳縮圖失敗）時一律退回原圖。

/** 縮圖的長邊。160px 的首頁卡片在 2x 螢幕上要 320px，留一點餘裕 */
export const THUMB_MAX_EDGE = 384

/** 原圖路徑 → 縮圖路徑 */
export function beanThumbPath(photoPath: string): string {
  const slash = photoPath.lastIndexOf('/')
  const dot = photoPath.lastIndexOf('.')
  const base = dot > slash ? photoPath.slice(0, dot) : photoPath
  return `${base}.thumb`
}

/** 等比縮到長邊不超過 THUMB_MAX_EDGE；本來就比較小的不放大 */
export function thumbSize(width: number, height: number): { width: number, height: number } {
  const scale = Math.min(1, THUMB_MAX_EDGE / Math.max(width, height, 1))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}
