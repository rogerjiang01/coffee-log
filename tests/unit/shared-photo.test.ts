// 分享頁的豆袋照片：伺服器端的簽章與轉送（server/utils/sharedPhoto.ts，《01》§14.5）。
//
// 用戶端只拿得到這裡簽的網址——只帶版本（縮圖／原圖）、到期時間與簽章，
// 沒有儲存路徑、沒有 user_id。縮圖檔還不存在時 v=thumb 退回原圖。
// 資料庫那一半（代碼換路徑、紀錄刪除後查不到）在 tests/db/shared-photo.test.mjs。

import { createReport } from '../helpers/report.mjs'
import {
  SHARED_PHOTO_EXPIRY_STEP_SECONDS, SHARED_PHOTO_TTL_SECONDS,
  loadSharedPhoto, resolveSharedPhotoUrls, sharedPhotoExpiry, signSharedPhotoUrl, verifySharedPhotoUrl,
  type SharedPhotoStore,
} from '../../server/utils/sharedPhoto.ts'
import { generateShareCode, sharedPhotoEndpoint } from '../../utils/share.ts'
import { beanThumbPath } from '../../utils/beanPhoto.ts'

const SECRET = 'test-secret-不是真的金鑰'
const USER = '6f1c2a4e-9d3b-4c8e-a1f0-2b7d9e5c3a10'
const PATH = `${USER}/0b8e2f6a-1c4d-4e7f-9a2b-3c5d7e9f1a2b.webp`
const FULL = new Uint8Array([1, 1, 1, 1])
const THUMB = new Uint8Array([2])
const NOW = 1_790_000_000

function store(overrides: Partial<{ path: string | null, type: string, thumb: boolean }> = {}) {
  const calls = { photoPath: 0, downloads: [] as string[] }
  const s: SharedPhotoStore = {
    async photoPath() {
      calls.photoPath++
      return 'path' in overrides ? overrides.path ?? null : PATH
    },
    async download(path) {
      calls.downloads.push(path)
      if (path === beanThumbPath(PATH)) return overrides.thumb === false ? null : { bytes: THUMB, type: overrides.type ?? 'image/webp' }
      if (path === PATH) return { bytes: FULL, type: overrides.type ?? 'image/webp' }
      return null
    },
  }
  return { store: s, calls }
}

function query(url: string) {
  const params = new URL(url, 'https://example.test').searchParams
  return { v: params.get('v') ?? undefined, exp: params.get('exp') ?? undefined, sig: params.get('sig') ?? undefined }
}

export default async function run() {
  const r = createReport('分享頁的豆袋照片（伺服器端）')
  const code = generateShareCode()

  r.section('第一步：要網址')
  const { store: withPhoto } = store()
  const response = await resolveSharedPhotoUrls(withPhoto, SECRET, code, NOW)
  r.check(JSON.stringify(Object.keys(response)) === '["thumb","full"]', '回應只有 thumb 與 full 兩個 key')
  const thumbUrl = response.thumb ?? ''
  const fullUrl = response.full ?? ''
  for (const [label, url, v] of [['縮圖', thumbUrl, 'thumb'], ['原圖', fullUrl, 'full']] as const) {
    r.check(new RegExp(`^/api/shared-photo/[A-Za-z0-9_-]{22}/image\\?v=${v}&exp=\\d+&sig=[A-Za-z0-9_-]+$`).test(url)
      && url.startsWith(`${sharedPhotoEndpoint(code)}/image?`), `${label}的網址只帶版本、到期時間與簽章`)
  }
  const body = JSON.stringify(response)
  r.check(!body.includes(PATH) && !body.includes('bean-photos') && !body.includes('.webp') && !body.includes('.thumb'),
    '回應裡沒有儲存路徑')
  r.check(!body.includes(USER) && !/[0-9a-f]{8}-[0-9a-f]{4}-/i.test(body), '回應裡沒有 user_id，也沒有任何 uuid')
  r.check(!body.includes(SECRET), '回應裡沒有金鑰')

  r.section('到期時間對齊 15 分鐘的格線：同一段時間內網址相同，瀏覽器快取才用得上')
  const exp = Number(query(thumbUrl).exp)
  r.check(exp % SHARED_PHOTO_EXPIRY_STEP_SECONDS === 0, '對齊格線')
  r.check(exp - NOW >= SHARED_PHOTO_TTL_SECONDS && exp - NOW <= SHARED_PHOTO_TTL_SECONDS + SHARED_PHOTO_EXPIRY_STEP_SECONDS,
    `效期在 1 小時到 1 小時 15 分之間（${Math.round((exp - NOW) / 60)} 分）`)
  const soon = await resolveSharedPhotoUrls(withPhoto, SECRET, code, exp - SHARED_PHOTO_TTL_SECONDS - 1)
  r.check(soon.thumb === thumbUrl, '同一格裡再開一次：同一個網址')
  const later = await resolveSharedPhotoUrls(withPhoto, SECRET, code, exp - SHARED_PHOTO_TTL_SECONDS + 1)
  r.check(later.thumb !== thumbUrl, '跨到下一格：新的網址')
  r.check(sharedPhotoExpiry(NOW) === exp, 'sharedPhotoExpiry 與網址上的一致')

  const { store: noPhoto } = store({ path: null })
  const none = await resolveSharedPhotoUrls(noPhoto, SECRET, code, NOW)
  r.check(none.thumb === null && none.full === null, '代碼無效、紀錄已刪除、沒有照片（查不到路徑）：兩個都是 null')

  const bad = store()
  for (const input of ['', 'short', `${code}x`, '../../etc/passwd', `${code.slice(0, 21)}/`]) {
    const result = await resolveSharedPhotoUrls(bad.store, SECRET, input, NOW)
    r.check(result.thumb === null && result.full === null, `格式不對的代碼「${input}」：null`)
  }
  r.check(bad.calls.photoPath === 0, '格式不對的代碼不查資料庫')

  r.section('第二步：讀圖片')
  const ok = store()
  const thumb = await loadSharedPhoto(ok.store, SECRET, code, query(thumbUrl), NOW + 10)
  r.check(thumb?.bytes === THUMB, 'v=thumb：拿到縮圖檔')
  r.check(JSON.stringify(ok.calls.downloads) === JSON.stringify([beanThumbPath(PATH)]), 'v=thumb：只讀縮圖，不讀原圖')
  const full = await loadSharedPhoto(ok.store, SECRET, code, query(fullUrl), NOW + 10)
  r.check(full?.bytes === FULL, 'v=full：拿到原圖')
  r.check(thumb !== null && thumb.maxAge === exp - NOW - 10 && thumb.maxAge > 0,
    `瀏覽器快取的時間與網址到期一致（${thumb?.maxAge} 秒）`)
  r.check(ok.calls.photoPath === 2, '每次讀圖片都重新確認一次代碼（不是只看簽章）')

  const legacy = store({ thumb: false })
  const fallback = await loadSharedPhoto(legacy.store, SECRET, code, query(thumbUrl), NOW + 10)
  r.check(fallback?.bytes === FULL, '縮圖檔還不存在：v=thumb 退回原圖')

  const q = query(thumbUrl)
  const denied = async (label: string, c: string, qq: Record<string, unknown>, now = NOW + 10, s = store()) => {
    r.check(await loadSharedPhoto(s.store, SECRET, c, qq, now) === null, label)
  }
  await denied('過期：拿不到', code, q, exp + 1)
  await denied('到期那一秒：拿不到', code, q, exp)
  await denied('改了 exp：拿不到', code, { ...q, exp: String(exp + SHARED_PHOTO_EXPIRY_STEP_SECONDS) })
  await denied('縮圖的簽章改成 v=full：拿不到', code, { ...q, v: 'full' })
  await denied('v 不是 thumb 或 full：拿不到', code, { ...q, v: 'original' })
  await denied('沒有 v：拿不到', code, { exp: q.exp, sig: q.sig })
  // 改第一個字元：最後一個字元只有高位元有意義，改到低位元時解碼出來是同一串位元組
  await denied('改了簽章：拿不到', code, { ...q, sig: `${q.sig!.startsWith('A') ? 'B' : 'A'}${q.sig!.slice(1)}` })
  await denied('沒有簽章：拿不到', code, { v: q.v, exp: q.exp })
  await denied('簽章不是 base64url：拿不到', code, { ...q, sig: '!!!' })
  await denied('簽章拿去配別的代碼：拿不到', generateShareCode(), q)
  await denied('別的金鑰簽的：拿不到', code, query(await signSharedPhotoUrl('另一把金鑰', code, 'thumb', NOW)))
  const farFuture = String(NOW + 365 * 24 * 3600)
  r.check(await verifySharedPhotoUrl(SECRET, code, { v: 'thumb', exp: farFuture, sig: 'x' }, NOW) === null,
    '效期遠超過 TTL 的網址：拿不到')
  await denied('exp 不是數字：拿不到', code, { ...q, exp: '1e20' })
  await denied('exp 是陣列（?exp=1&exp=2）：拿不到', code, { ...q, exp: [q.exp, q.exp] })

  const deleted = store({ path: null })
  await denied('簽章有效，但紀錄在這之間被刪了：拿不到', code, q, NOW + 10, deleted)
  r.check(deleted.calls.downloads.length === 0, '紀錄刪了就不讀檔案')

  r.section('只轉送圖片格式')
  for (const type of ['image/jpeg', 'image/png', 'IMAGE/WEBP; charset=binary']) {
    r.check(await loadSharedPhoto(store({ type }).store, SECRET, code, q, NOW + 10) !== null, `${type}：轉送`)
  }
  for (const type of ['text/html', 'image/svg+xml', 'application/octet-stream', '', 'application/javascript']) {
    r.check(await loadSharedPhoto(store({ type }).store, SECRET, code, q, NOW + 10) === null,
      `「${type || '（空）'}」：不轉送（使用者可以把任何檔案放進自己的資料夾）`)
  }

  return r.finish()
}
