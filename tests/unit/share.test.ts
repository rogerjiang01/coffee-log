// 分享的用戶端邏輯（utils/share.ts，《02》§7.1）。
//
// 最要緊的一條是 iOS Safari 的限制：navigator.share() 必須在點擊的同一個事件裡
// **同步**呼叫，中間只要 await 一趟網路請求就會被拒（NotAllowedError），
// 使用者按了沒反應、也沒有錯誤訊息。這在桌機瀏覽器上完全測不出來，
// 所以這裡用「呼叫的當下記錄順序」來驗，不靠實機。

import {
  SHARE_CODE_PATTERN, SHARED_BREW_KEYS, creationSucceeded, deliverShareLink, generateShareCode,
  keyPaths, shareUrl, startShare,
} from '../../utils/share.ts'
import { createReport } from '../helpers/report.mjs'

export default async function run() {
  const r = createReport('分享的用戶端邏輯')

  r.section('代碼')
  const codes = Array.from({ length: 200 }, () => generateShareCode())
  r.check(codes.every(code => SHARE_CODE_PATTERN.test(code)), '22 個 base64url 字元（與資料庫的 check 一致）')
  r.check(new Set(codes).size === codes.length, '200 個互不重複')
  let asked = 0
  generateShareCode((bytes) => {
    asked = bytes.length
    return bytes
  })
  r.check(asked === 16, '用 16 bytes（128 bits）的亂數')
  const allOnes = generateShareCode(bytes => bytes.fill(255))
  r.check(allOnes === '_____________________w', `+ 與 / 換成 - 與 _、去掉補位的 =（${allOnes}）`)
  r.check(!/Math\.random/.test(generateShareCode.toString()), '不用 Math.random')

  r.section('網址')
  r.check(shareUrl('https://coffee.example', 'abc') === 'https://coffee.example/s/abc', '/s/{代碼}')
  r.check(shareUrl('https://coffee.example/', 'abc') === 'https://coffee.example/s/abc', 'origin 結尾的 / 不會變成 //')

  r.section('按下「分享」或「複製連結」：交出連結 → 關閉對話框 → 建立請求，都不等待')
  const order: string[] = []
  let resolveCreate: (code: string) => void = () => {}
  const { delivery, creation } = startShare({
    url: 'https://x/s/abc',
    deliver: (url) => {
      order.push(`deliver ${url}`)
      return new Promise(() => {})
    },
    afterDeliver: () => order.push('close'),
    create: () => {
      order.push('create')
      return new Promise(resolve => (resolveCreate = resolve))
    },
  })
  order.push('handler 結束')
  r.check(order.join(' → ') === 'deliver https://x/s/abc → close → create → handler 結束',
    `系統分享（或複製）在同一個事件裡最先被呼叫（${order.join(' → ')}）`)
  r.check(delivery instanceof Promise && creation instanceof Promise, '兩者都回傳 promise，handler 不等它們')
  resolveCreate('abc')

  let created = 0
  startShare({ url: 'u', deliver: () => Promise.resolve('shared' as const), create: () => Promise.resolve(++created) })
  startShare({ url: 'u', deliver: () => Promise.resolve('shared' as const), create: () => Promise.resolve(++created) })
  r.check(created === 2, '傳送模型：每按一次都建立一次，沒有「已經分享過」的捷徑')

  r.section('交出連結的結果')
  const calls: string[] = []
  const env = (share?: () => Promise<void>, copy: () => Promise<void> = () => Promise.resolve()) => ({
    share: share && ((data: { url: string }) => {
      calls.push(`share ${data.url}`)
      return share()
    }),
    copy: (text: string) => {
      calls.push(`copy ${text}`)
      return copy()
    },
  })
  calls.length = 0
  const sync = deliverShareLink('L', env(() => Promise.resolve()))
  r.check(calls.join() === 'share L', 'navigator.share 在 deliverShareLink 回傳之前就被呼叫（同步）')
  r.check(await sync === 'shared', '系統分享成功：shared')

  const abort = Object.assign(new Error('cancel'), { name: 'AbortError' })
  calls.length = 0
  r.check(await deliverShareLink('L', env(() => Promise.reject(abort))) === 'cancelled', '使用者在選單裡取消：cancelled（不顯示任何訊息）')
  r.check(calls.join() === 'share L', '取消之後不會再去複製')

  calls.length = 0
  const notAllowed = Object.assign(new Error('gesture'), { name: 'NotAllowedError' })
  r.check(await deliverShareLink('L', env(() => Promise.reject(notAllowed))) === 'copied', '系統分享被拒（不是取消）：退回複製')
  r.check(calls.join() === 'share L,copy L', '先試分享、再複製')

  calls.length = 0
  const copyOnly = deliverShareLink('L', env(undefined))
  r.check(calls.join() === 'copy L', '不支援系統分享：直接複製，而且也是同步呼叫')
  r.check(await copyOnly === 'copied', '複製成功：copied（顯示「已複製連結」）')
  r.check(await deliverShareLink('L', env(undefined, () => Promise.reject(new Error('x')))) === 'failed', '複製也失敗：failed')

  r.section('建立請求回來之後')
  r.check(creationSucceeded('abc', { code: 'abc', error: null }), '回同一個代碼：成功')
  r.check(!creationSucceeded('abc', { code: null, error: new Error('network') }), '請求失敗：失敗，頁面提示給「再試一次」（同一個代碼）')
  r.check(!creationSucceeded('abc', { code: null, error: null }), '沒有錯誤也沒有代碼：當成失敗，不當成功')
  r.check(!creationSucceeded('abc', { code: 'xyz', error: null }), '回來的代碼不是送出去的：當成失敗（送出去的那條沒建起來）')

  r.section('回傳值的 key 路徑')
  const paths = keyPaths({ a: 1, b: { c: null }, steps: [{ x: 1 }, { x: 2 }], tags: ['一', '二'], empty: [] })
  r.check(JSON.stringify([...new Set(paths)].sort()) === JSON.stringify(['a', 'b.c', 'empty', 'steps[].x', 'tags[]']),
    `物件、陣列、純量陣列都攤平（${[...new Set(paths)].join('、')}）`)
  r.check(new Set(SHARED_BREW_KEYS).size === SHARED_BREW_KEYS.length, '白名單沒有重複的 key')
  r.check(!SHARED_BREW_KEYS.some(key => /user_id|email|share_id|bean_id|include_notes|is_sample|visibility/.test(key)),
    '白名單裡沒有使用者、其他 id、include_notes、範例與 visibility')

  return r.finish()
}
