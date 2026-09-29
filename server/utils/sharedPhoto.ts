// 分享頁的豆袋照片（《01》§14.5、《02》§7.2）。
//
// 照片在 private bucket，匿名的人讀不到。做法是伺服器端以 service role 讀出來再交給瀏覽器，
// 分兩步：
//
//   GET /api/shared-photo/[code]              → { url }：這一次開啟用的圖片網址，沒有照片時是 null
//   GET /api/shared-photo/[code]/image?exp&sig → 圖片本身
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

/**
 * 網址的有效期限（秒）。每次開啟分享頁重新產生（《01》§14.5）。
 * 縮圖一載入，放大檢視用的就是同一個網址、瀏覽器已經有的那張圖，不會再讀一次；
 * 一小時是給「頁面開著、過一陣子才點縮圖」而瀏覽器又把圖清掉的情況
 */
export const SHARED_PHOTO_TTL_SECONDS = 60 * 60

/**
 * 只轉送這幾種圖片格式。**不能照儲存時的 Content-Type 原樣送出**：bucket 沒有限制格式
 * （《01》§7），使用者可以把任何檔案放進自己的資料夾再分享出去。照原樣送的話，
 * 一個 text/html 或 image/svg+xml（可以帶 script）就會在這個網域上執行
 */
export const SHARED_PHOTO_TYPES = ['image/webp', 'image/jpeg', 'image/png', 'image/avif', 'image/gif'] as const

export interface SharedPhotoStore {
  /** 代碼有效、紀錄還在、豆子有照片時，回傳儲存路徑；其餘一律 null */
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

const message = (code: string, exp: number) => encoder.encode(`shared-photo\n${code}\n${exp}`)

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

/** 這一次開啟用的圖片網址（相對路徑）。只帶代碼、到期時間與簽章 */
export async function signSharedPhotoUrl(secret: string, code: string, nowSeconds: number): Promise<string> {
  const exp = Math.floor(nowSeconds) + SHARED_PHOTO_TTL_SECONDS
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), message(code, exp))
  return `${sharedPhotoEndpoint(code)}/image?exp=${exp}&sig=${toBase64Url(sig)}`
}

/** 網址是這裡發的、代碼沒被換過、還沒過期 */
export async function verifySharedPhotoUrl(
  secret: string, code: string, exp: unknown, sig: unknown, nowSeconds: number,
): Promise<boolean> {
  if (typeof exp !== 'string' || !/^\d{1,12}$/.test(exp) || typeof sig !== 'string') return false
  const expires = Number(exp)
  if (expires <= nowSeconds) return false
  // 有效期限不會超過 TTL：萬一金鑰外洩，自簽的網址也不能是永久的
  if (expires > nowSeconds + SHARED_PHOTO_TTL_SECONDS + 60) return false
  const given = fromBase64Url(sig)
  if (!given) return false
  // subtle.verify 自己做定長比較，不會因為比到第幾個位元組才不同而洩漏時間差
  return crypto.subtle.verify('HMAC', await hmacKey(secret), given, message(code, expires))
}

/** 第一步：分享頁要一個圖片網址。代碼無效、紀錄已刪除、沒有照片，一律 { url: null } */
export async function resolveSharedPhotoUrl(
  store: SharedPhotoStore, secret: string, code: string, nowSeconds: number,
): Promise<{ url: string | null }> {
  if (!SHARE_CODE_PATTERN.test(code)) return { url: null }
  const path = await store.photoPath(code)
  return { url: path ? await signSharedPhotoUrl(secret, code, nowSeconds) : null }
}

/** 第二步：讀圖片。任何一關沒過都回 null（路由回 404，不分原因） */
export async function loadSharedPhoto(
  store: SharedPhotoStore, secret: string, code: string,
  query: { exp?: unknown, sig?: unknown }, nowSeconds: number,
): Promise<SharedPhotoFile | null> {
  if (!SHARE_CODE_PATTERN.test(code)) return null
  if (!await verifySharedPhotoUrl(secret, code, query.exp, query.sig, nowSeconds)) return null
  const path = await store.photoPath(code)
  if (!path) return null
  const file = await store.download(path)
  if (!file) return null
  const type = file.type.split(';')[0]!.trim().toLowerCase()
  if (!(SHARED_PHOTO_TYPES as readonly string[]).includes(type)) return null
  return { bytes: file.bytes, type, maxAge: Math.max(0, Number(query.exp) - Math.floor(nowSeconds)) }
}
