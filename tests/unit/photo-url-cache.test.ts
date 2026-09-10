// 豆袋照片的簽名網址快取。
//
// 兩種錯法都很安靜：
//   過期了還拿來用 → 圖裂掉，但只在「頁面開了很久」之後才發生
//   換照片沒清掉   → 一直顯示舊照片，使用者以為沒上傳成功
// 兩者都不會有錯誤訊息。

import {
  createPhotoUrlCache, SIGNED_URL_TTL_SECONDS, REFRESH_WITHIN_MS,
} from '../../utils/photoUrlCache.ts'
import { createReport, equal } from '../helpers/report.mjs'

const DAY = 24 * 60 * 60 * 1000
const T0 = Date.UTC(2026, 8, 10, 12, 0, 0)

export default function run() {
  const r = createReport('照片簽名網址的快取')

  r.section('效期與換新門檻')
  r.check(SIGNED_URL_TTL_SECONDS === 7 * 24 * 60 * 60, '效期 7 天')
  r.check(REFRESH_WITHIN_MS === DAY, '剩不到 1 天就換新')

  r.section('同一張圖拿到同一個網址')
  // 這是整件事的目的：網址穩定，瀏覽器才認得出「這張我已經有了」
  const c = createPhotoUrlCache()
  c.set('u1/a.webp', 'https://x/a?token=abc', T0)
  r.check(c.get('u1/a.webp', T0) === 'https://x/a?token=abc', '剛存進去')
  r.check(c.get('u1/a.webp', T0 + DAY) === 'https://x/a?token=abc', '一天後仍是同一個網址')
  r.check(c.get('u1/a.webp', T0 + 5 * DAY) === 'https://x/a?token=abc', '五天後仍是同一個網址')

  r.section('快過期就換新，不拿快過期的網址冒險')
  r.check(c.get('u1/a.webp', T0 + 6 * DAY - 1) === 'https://x/a?token=abc',
    '剩一天多一點：還能用')
  r.check(c.get('u1/a.webp', T0 + 6 * DAY) === null,
    '剩剛好一天：換新——那一天是給「頁面開一整天」與裝置時鐘誤差的緩衝')
  r.check(c.get('u1/a.webp', T0 + 7 * DAY) === null, '已過期：換新')
  r.check(c.get('u1/a.webp', T0 + 30 * DAY) === null, '過期很久：換新')
  r.check(c.get('u1/沒存過.webp', T0) === null, '沒存過：換新')

  r.section('換照片與刪照片必須清掉')
  // 上傳路徑是 {user_id}/{bean_id}.webp 且 upsert——換照片時路徑不變，
  // 不清的話網址字串也不變，瀏覽器會繼續給舊的那張圖。
  const d = createPhotoUrlCache()
  d.set('u1/bean-1.webp', 'https://x/old?token=1', T0)
  d.forget('u1/bean-1.webp')
  r.check(d.get('u1/bean-1.webp', T0) === null, '清掉之後下次會產生新網址')
  d.set('u1/bean-1.webp', 'https://x/new?token=2', T0)
  r.check(d.get('u1/bean-1.webp', T0) === 'https://x/new?token=2', '換上新網址')

  r.section('列表：只為缺的與快過期的發請求')
  const e = createPhotoUrlCache()
  e.set('u1/a.webp', 'url-a', T0)
  e.set('u1/b.webp', 'url-b', T0 - 6.5 * DAY) // 快過期
  const { fresh, stale } = e.partition(
    ['u1/a.webp', 'u1/b.webp', 'u1/c.webp', null, undefined, 'u1/a.webp'], T0)
  r.check(equal([...fresh.keys()], ['u1/a.webp']), '夠新的直接用')
  r.check(fresh.get('u1/a.webp') === 'url-a', '拿到的是快取裡那一個')
  r.check(equal(stale, ['u1/b.webp', 'u1/c.webp']), '快過期的與沒存過的要重新產生')
  r.check(!stale.includes('u1/a.webp'), '重複的路徑不重複請求')

  const allCached = e.partition(['u1/a.webp'], T0)
  r.check(allCached.stale.length === 0, '全部都在快取裡時一趟都不用發')

  r.section('每個實例各自獨立')
  const f = createPhotoUrlCache()
  const g = createPhotoUrlCache()
  f.set('u1/a.webp', 'url-f', T0)
  r.check(g.get('u1/a.webp', T0) === null, '互不影響——測試之間不會互相污染')

  return r.finish()
}
