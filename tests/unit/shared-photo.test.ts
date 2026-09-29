// 分享頁的豆袋照片：伺服器端的簽章與轉送（server/utils/sharedPhoto.ts，《01》§14.5）。
//
// 用戶端只拿得到這裡簽的網址——只帶代碼、到期時間與簽章，沒有儲存路徑、沒有 user_id。
// 資料庫那一半（代碼換路徑、紀錄刪除後查不到）在 tests/db/shared-photo.test.mjs。

import { createReport } from '../helpers/report.mjs'
import {
  SHARED_PHOTO_TTL_SECONDS, loadSharedPhoto, resolveSharedPhotoUrl, signSharedPhotoUrl, verifySharedPhotoUrl,
  type SharedPhotoStore,
} from '../../server/utils/sharedPhoto.ts'
import { generateShareCode, sharedPhotoEndpoint } from '../../utils/share.ts'

const SECRET = 'test-secret-不是真的金鑰'
const USER = '6f1c2a4e-9d3b-4c8e-a1f0-2b7d9e5c3a10'
const PATH = `${USER}/0b8e2f6a-1c4d-4e7f-9a2b-3c5d7e9f1a2b.webp`
const BYTES = new Uint8Array([82, 73, 70, 70])
const NOW = 1_790_000_000

function store(overrides: Partial<{ path: string | null, type: string }> = {}) {
  const calls = { photoPath: 0, download: 0 }
  const s: SharedPhotoStore = {
    async photoPath() {
      calls.photoPath++
      return 'path' in overrides ? overrides.path ?? null : PATH
    },
    async download() {
      calls.download++
      return { bytes: BYTES, type: overrides.type ?? 'image/webp' }
    },
  }
  return { store: s, calls }
}

function query(url: string) {
  const params = new URL(url, 'https://example.test').searchParams
  return { exp: params.get('exp') ?? undefined, sig: params.get('sig') ?? undefined }
}

export default async function run() {
  const r = createReport('分享頁的豆袋照片（伺服器端）')
  const code = generateShareCode()

  r.section('第一步：要網址')
  const { store: withPhoto } = store()
  const response = await resolveSharedPhotoUrl(withPhoto, SECRET, code, NOW)
  r.check(JSON.stringify(Object.keys(response)) === '["url"]', '回應只有 url 一個 key')
  const url = response.url ?? ''
  r.check(url.startsWith(`${sharedPhotoEndpoint(code)}/image?`), `網址在這個網域上：${url.slice(0, 40)}…`)
  r.check(/^\/api\/shared-photo\/[A-Za-z0-9_-]{22}\/image\?exp=\d+&sig=[A-Za-z0-9_-]+$/.test(url),
    '網址只帶代碼、到期時間與簽章')
  const body = JSON.stringify(response)
  r.check(!body.includes(PATH) && !body.includes('bean-photos') && !body.includes('.webp'), '回應裡沒有儲存路徑')
  r.check(!body.includes(USER) && !/[0-9a-f]{8}-[0-9a-f]{4}-/i.test(body), '回應裡沒有 user_id，也沒有任何 uuid')
  r.check(!body.includes(SECRET), '回應裡沒有金鑰')
  r.check(Number(query(url).exp) === NOW + SHARED_PHOTO_TTL_SECONDS, `有效期限 ${SHARED_PHOTO_TTL_SECONDS / 60} 分鐘`)
  const again = await resolveSharedPhotoUrl(withPhoto, SECRET, code, NOW + 5)
  r.check(again.url !== url, '每次開啟重新產生，網址不同')

  const { store: noPhoto } = store({ path: null })
  r.check((await resolveSharedPhotoUrl(noPhoto, SECRET, code, NOW)).url === null,
    '代碼無效、紀錄已刪除、沒有照片（查不到路徑）：url 是 null')

  const bad = store()
  for (const input of ['', 'short', `${code}x`, '../../etc/passwd', `${code.slice(0, 21)}/`]) {
    r.check((await resolveSharedPhotoUrl(bad.store, SECRET, input, NOW)).url === null, `格式不對的代碼「${input}」：null`)
  }
  r.check(bad.calls.photoPath === 0, '格式不對的代碼不查資料庫')

  r.section('第二步：讀圖片')
  const ok = store()
  const file = await loadSharedPhoto(ok.store, SECRET, code, query(url), NOW + 10)
  r.check(file !== null && file.bytes === BYTES && file.type === 'image/webp', '簽章正確、還沒過期：拿得到圖片')
  r.check(file !== null && file.maxAge === SHARED_PHOTO_TTL_SECONDS - 10 && file.maxAge > 0,
    `瀏覽器快取的時間不超過網址本身（${file?.maxAge} 秒）`)
  r.check(ok.calls.photoPath === 1, '讀圖片時重新確認一次代碼（不是只看簽章）')

  const q = query(url)
  const denied = async (label: string, c: string, qq: { exp?: unknown, sig?: unknown }, now = NOW + 10, s = store()) => {
    r.check(await loadSharedPhoto(s.store, SECRET, c, qq, now) === null, label)
  }
  await denied('過期：拿不到', code, q, NOW + SHARED_PHOTO_TTL_SECONDS + 1)
  await denied('到期那一秒：拿不到', code, q, NOW + SHARED_PHOTO_TTL_SECONDS)
  await denied('改了 exp：拿不到', code, { ...q, exp: String(Number(q.exp) + 60) })
  await denied('改了簽章：拿不到', code, { ...q, sig: `${q.sig!.slice(0, -1)}${q.sig!.endsWith('A') ? 'B' : 'A'}` })
  await denied('沒有簽章：拿不到', code, { exp: q.exp })
  await denied('簽章拿去配別的代碼：拿不到', generateShareCode(), q)
  await denied('別的金鑰簽的：拿不到', code, query(await signSharedPhotoUrl('另一把金鑰', code, NOW)))
  const farFuture = NOW + 365 * 24 * 3600
  r.check(!await verifySharedPhotoUrl(SECRET, code, String(farFuture), 'x', NOW), '效期遠超過 TTL 的網址：拿不到')
  await denied('簽章不是 base64url：拿不到', code, { ...q, sig: '!!!' })
  await denied('exp 不是數字：拿不到', code, { ...q, exp: '1e20' })
  await denied('exp 是陣列（?exp=1&exp=2）：拿不到', code, { ...q, exp: [q.exp, q.exp] })

  const deleted = store({ path: null })
  await denied('簽章有效，但紀錄在這之間被刪了：拿不到', code, q, NOW + 10, deleted)
  r.check(deleted.calls.download === 0, '紀錄刪了就不讀檔案')

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
