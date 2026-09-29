// 分享頁的豆袋照片（《01》§14.5、《02》§7.2）。
//
// 照片在 private bucket，匿名的人讀不到。做法是伺服器端以 service role 讀出來再交給瀏覽器，
// 分兩步：
//
//   GET /api/shared-photo/[code]                  → { thumb, full }：縮圖與原圖的網址，沒有照片時都是 null
//   GET /api/shared-photo/[code]/image?v&exp&sig   → 圖片本身。v 是 thumb 或 full
//
// 縮圖是原圖旁邊另存的小檔（utils/beanPhoto.ts）。縮圖檔還不存在時（補產生之前的舊照片），
// v=thumb 退回原圖。分享頁的縮圖只下載縮圖，原圖等縮圖顯示之後才在背景預先載入。
//
// **為什麼不直接給 Supabase 的簽名網址**：那個網址長這樣
//   …/storage/v1/object/sign/bean-photos/{user_id}/{bean_id}.webp?token=…
// 儲存路徑與 user_id 就在網址裡（token 的內容也是）。所以用戶端拿到的是這裡自己簽的網址，
// 只帶分享代碼與到期時間，圖片由伺服器讀出來轉送。
//
// **每一次讀圖片都重新確認代碼**：簽章只證明「這個網址是伺服器發的、還沒過期」，
// 不證明紀錄還在。紀錄在網址有效期內被刪掉，下一次讀就拿不到。
//
// 這裡不碰 Supabase 與 h3，存取由呼叫端注入（server/utils/sharedPhotoStore.ts），才能在 Node 裡測。

import { SHARE_CODE_PATTERN, sharedPhotoEndpoint } from '../../utils/share.ts'
import { beanThumbPath } from '../../utils/beanPhoto.ts'

/**
 * 網址的有效期限（秒），至少這麼久。每次開啟分享頁重新簽一次（《01》§14.5）。
 * 一小時是給「頁面開著、過一陣子才點縮圖」的情況
 */
export const SHARED_PHOTO_TTL_SECONDS = 60 * 60

/**
 * 到期時間對齊到 15 分鐘的格線上：同一段時間內開啟同一個分享，簽出來的是**同一個網址**，
 * 瀏覽器的快取（max-age 到期為止）才用得上。不對齊的話每次開啟網址都不一樣，快取永遠不中。
 * 實際效期因此落在 1 小時到 1 小時 15 分之間
 */
export const SHARED_PHOTO_EXPIRY_STEP_SECONDS = 15 * 60

export const SHARED_PHOTO_VARIANTS = ['thumb', 'full'] as const
export type SharedPhotoVariant = typeof SHARED_PHOTO_VARIANTS[number]

/**
 * 只轉送這幾種圖片格式。**不能照儲存時的 Content-Type 原樣送出**：bucket 沒有限制格式
 * （《01》§7），使用者可以把任何檔案放進自己的資料夾再分享出去。照原樣送的話，
 * 一個 text/html 或 image/svg+xml（可以帶 script）就會在這個網域上執行
 */
export const SHARED_PHOTO_TYPES = ['image/webp', 'image/jpeg', 'image/png', 'image/avif', 'image/gif'] as const

export interface SharedPhotoStore {
  /** 代碼有效、紀錄還在、豆子有照片時，回傳**原圖**的儲存路徑；其餘一律 null */
  photoPath: (code: string) => Promise<string | null>
  /** 讀出檔案。讀不到回 null */
  download: (path: string) => Promise<{ bytes: Uint8Array, type: string } | null>
}

export interface SharedPhotoFile {
  bytes: Uint8Array
  type: string
  /** 距離網址到期還有幾秒，用在 Cache-Control */
  maxAge: number
}

const encoder = new TextEncoder()

// Web Crypto，不用 node:crypto：Nitro 的各種部署目標都有，專案也不必為此裝 Node 的型別
function hmacKey(secret: string) {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}

// 簽章綁定代碼、版本與到期時間：換任何一個都驗不過（縮圖的網址改成 v=full 也不行）
const message = (code: string, variant: SharedPhotoVariant, exp: number) =>
  encoder.encode(`shared-photo\n${code}\n${variant}\n${exp}`)

function toBase64Url(bytes: ArrayBuffer): string {
  let binary = ''
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]+$/.test(text)) return null
  try {
    const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'))
    const bytes = new Uint8Array(new ArrayBuffer(binary.length))
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes
  }
  catch {
    return null
  }
}

/** 對齊格線的到期時間（Unix 秒） */
export function sharedPhotoExpiry(nowSeconds: number): number {
  const step = SHARED_PHOTO_EXPIRY_STEP_SECONDS
  return Math.ceil((Math.floor(nowSeconds) + SHARED_PHOTO_TTL_SECONDS) / step) * step
}

/** 圖片網址（相對路徑）。只帶版本、到期時間與簽章 */
export async function signSharedPhotoUrl(
  secret: string, code: string, variant: SharedPhotoVariant, nowSeconds: number,
): Promise<string> {
  const exp = sharedPhotoExpiry(nowSeconds)
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), message(code, variant, exp))
  return `${sharedPhotoEndpoint(code)}/image?v=${variant}&exp=${exp}&sig=${toBase64Url(sig)}`
}

/** 網址是這裡發的、代碼與版本沒被換過、還沒過期 */
export async function verifySharedPhotoUrl(
  secret: string, code: string, query: { v?: unknown, exp?: unknown, sig?: unknown }, nowSeconds: number,
): Promise<SharedPhotoVariant | null> {
  const { v, exp, sig } = query
  if (typeof v !== 'string' || !(SHARED_PHOTO_VARIANTS as readonly string[]).includes(v)) return null
  if (typeof exp !== 'string' || !/^\d{1,12}$/.test(exp) || typeof sig !== 'string') return null
  const expires = Number(exp)
  if (expires <= nowSeconds) return null
  // 效期不會超過 TTL 加一格：萬一金鑰外洩，自簽的網址也不能是永久的
  if (expires > nowSeconds + SHARED_PHOTO_TTL_SECONDS + SHARED_PHOTO_EXPIRY_STEP_SECONDS + 60) return null
  const given = fromBase64Url(sig)
  if (!given) return null
  // subtle.verify 自己做定長比較，不會因為比到第幾個位元組才不同而洩漏時間差
  const ok = await crypto.subtle.verify('HMAC', await hmacKey(secret), given, message(code, v as SharedPhotoVariant, expires))
  return ok ? v as SharedPhotoVariant : null
}

export interface SharedPhotoUrls {
  thumb: string | null
  full: string | null
}

/** 第一步：分享頁要圖片網址。代碼無效、紀錄已刪除、沒有照片，一律兩個都是 null */
export async function resolveSharedPhotoUrls(
  store: SharedPhotoStore, secret: string, code: string, nowSeconds: number,
): Promise<SharedPhotoUrls> {
  if (!SHARE_CODE_PATTERN.test(code)) return { thumb: null, full: null }
  const path = await store.photoPath(code)
  if (!path) return { thumb: null, full: null }
  const [thumb, full] = await Promise.all([
    signSharedPhotoUrl(secret, code, 'thumb', nowSeconds),
    signSharedPhotoUrl(secret, code, 'full', nowSeconds),
  ])
  return { thumb, full }
}

/** 第二步：讀圖片。任何一關沒過都回 null（路由回 404，不分原因） */
export async function loadSharedPhoto(
  store: SharedPhotoStore, secret: string, code: string,
  query: { v?: unknown, exp?: unknown, sig?: unknown }, nowSeconds: number,
): Promise<SharedPhotoFile | null> {
  if (!SHARE_CODE_PATTERN.test(code)) return null
  const variant = await verifySharedPhotoUrl(secret, code, query, nowSeconds)
  if (!variant) return null
  const path = await store.photoPath(code)
  if (!path) return null
  // 縮圖檔還不存在（補產生之前的舊照片）時退回原圖
  const file = (variant === 'thumb' ? await store.download(beanThumbPath(path)) : null)
    ?? await store.download(path)
  if (!file) return null
  const type = file.type.split(';')[0]!.trim().toLowerCase()
  if (!(SHARED_PHOTO_TYPES as readonly string[]).includes(type)) return null
  return { bytes: file.bytes, type, maxAge: Math.max(0, Number(query.exp) - Math.floor(nowSeconds)) }
}
