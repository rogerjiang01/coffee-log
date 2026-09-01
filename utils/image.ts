// 豆袋照片的前端壓縮。
// 依《01-資料庫規格》§7 與《03-介面規範》§8：長邊 1600px、品質 0.8、
// 轉 WebP、單檔上限 2MB。壓縮在上傳前完成，避免手機原圖直接進 Storage。

const MAX_EDGE = 1600
const QUALITY = 0.8
const MAX_BYTES = 2 * 1024 * 1024

export interface CompressedImage {
  blob: Blob
  ext: string
  width: number
  height: number
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>(resolve => canvas.toBlob(resolve, type, quality))
}

export async function compressBeanPhoto(file: File): Promise<CompressedImage> {
  if (!file.type.startsWith('image/')) {
    throw new Error('這個檔案不是圖片')
  }

  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('這台裝置無法處理圖片')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close?.()

  // 少數瀏覽器不支援 WebP 編碼，toBlob 會回 null 或退回 png，此時改用 JPEG
  let blob = await toBlob(canvas, 'image/webp', QUALITY)
  let ext = 'webp'
  if (!blob || blob.type !== 'image/webp') {
    blob = await toBlob(canvas, 'image/jpeg', QUALITY)
    ext = 'jpg'
  }
  if (!blob) throw new Error('圖片轉檔沒有成功')

  // 極端情況（例如超大尺寸的照片牆）再降一次品質
  if (blob.size > MAX_BYTES) {
    const retry = await toBlob(canvas, `image/${ext === 'webp' ? 'webp' : 'jpeg'}`, 0.6)
    if (retry) blob = retry
  }
  if (blob.size > MAX_BYTES) {
    throw new Error('這張照片壓縮後還是超過 2MB，換一張或先裁切一下')
  }

  return { blob, ext, width, height }
}
