// SWR 快取的行為與實測時間差。
//
// 這裡載入的是真正跑在使用者機器上的那支 useQueryCache，不是仿製品。
// 網路延遲用實測值 115ms（到東京的往返，見效能那一輪的量測）。

import { useQueryCache, __resetQueryCache } from '../../composables/useQueryCache.ts'
import { cacheKeys } from '../../utils/cacheKeys.ts'
import { createReport, equal } from '../helpers/report.mjs'

const RTT = 115
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export default async function run() {
  const r = createReport('SWR 快取')
  const cache = useQueryCache()

  // ── 命中與未命中的時間差 ────────────────────────────────
  __resetQueryCache()
  const KEY = cacheKeys.beanList()
  const rows = [{ id: 'a', name: '衣索比亞' }]
  const fetcher = async () => { await sleep(RTT); return rows }

  r.section(`命中與未命中的時間差（模擬 ${RTT}ms 往返）`)

  let painted = -1
  const missStart = Date.now()
  const miss = cache.swr(KEY, fetcher, { apply: () => { painted = Date.now() - missStart } })
  await miss.settled
  const missMs = painted
  r.check(!miss.hit, '第一次是未命中')
  r.check(missMs >= RTT, `未命中：${missMs}ms 才畫得出來——要等一趟來回`)

  let painted2 = -1
  const hitStart = Date.now()
  const hit = cache.swr(KEY, fetcher, { apply: () => { if (painted2 < 0) painted2 = Date.now() - hitStart } })
  const hitMs = painted2
  r.check(hit.hit, '第二次命中')
  r.check(hitMs <= 2, `命中：${hitMs}ms 就畫出來了——同步，不等網路`)
  r.check(missMs - hitMs >= RTT - 2, `省下 ${missMs - hitMs}ms`)
  await hit.settled

  r.section('背景重新驗證')
  __resetQueryCache()
  await cache.swr(KEY, async () => [{ id: 'a', name: '舊名字' }], { apply: () => {} }).settled
  const seen: string[] = []
  const revalidate = cache.swr(KEY, async () => { await sleep(5); return [{ id: 'a', name: '新名字' }] }, {
    apply: (data) => seen.push((data as { name: string }[])[0]!.name),
  })
  r.check(equal(seen, ['舊名字']), '先用快取畫一次')
  await revalidate.settled
  r.check(equal(seen, ['舊名字', '新名字']), '背景查回來發現變了，再畫一次')

  __resetQueryCache()
  await cache.swr(KEY, async () => rows, { apply: () => {} }).settled
  const repaints: number[] = []
  const same = cache.swr(KEY, async () => [...rows], { apply: () => repaints.push(1) })
  await same.settled
  r.check(repaints.length === 1,
    '資料沒變就不重畫——無謂的重繪會讓捲動位置與輸入焦點跳掉')

  // ── 錯誤處理（上一輪加的東西不能被快取繞過）────────────
  r.section('背景重新驗證失敗不蓋掉畫面')
  __resetQueryCache()
  await cache.swr(KEY, async () => rows, { apply: () => {} }).settled
  let errorShown = false
  // 這一段刻意讓背景查詢失敗，實作會 console.warn。暫時靜音，讓測試輸出乾淨
  const warn = console.warn
  console.warn = () => {}
  const failing = cache.swr(KEY, async () => { throw new Error('斷線') }, {
    apply: () => {},
    onError: () => { errorShown = true },
  })
  await failing.settled
  console.warn = warn
  r.check(!errorShown, '命中時背景失敗不呼叫 onError——畫面上的內容是對的，不該被錯誤訊息蓋掉')
  r.check(cache.peek(KEY) !== null, '失敗不清掉既有快取')

  r.section('未命中且失敗要顯示錯誤')
  __resetQueryCache()
  let message = ''
  await cache.swr(KEY, async () => { throw new Error('斷線') }, {
    apply: () => {},
    onError: (e) => { message = (e as Error).message },
  }).settled
  r.check(message === '斷線', '沒有快取可用時，原本的錯誤訊息照常出現')

  // ── 半成品資料 ──────────────────────────────────────────
  r.section('列表帶進詳情的半成品')
  __resetQueryCache()
  cache.prime(cacheKeys.bean('b1'), { id: 'b1', name: '耶加雪菲' })
  const primed = cache.peek<{ name: string }>(cacheKeys.bean('b1'))
  r.check(primed?.partial === true, '標成 partial，詳情頁才知道還有欄位沒到')
  r.check(primed?.data.name === '耶加雪菲', '標題可以立刻畫出來')

  cache.set(cacheKeys.bean('b1'), { id: 'b1', name: '耶加雪菲', region: '科契爾' })
  cache.prime(cacheKeys.bean('b1'), { id: 'b1', name: '耶加雪菲' })
  const full = cache.peek<{ region?: string }>(cacheKeys.bean('b1'))
  r.check(full?.partial === false && full.data.region === '科契爾',
    '已經有完整資料時 prime 不覆蓋——部分蓋過完整是退步')

  // ── 失效 ────────────────────────────────────────────────
  r.section('失效')
  __resetQueryCache()
  await cache.swr(cacheKeys.brewPage(0), async () => ['舊'], { apply: () => {} }).settled
  await cache.swr(cacheKeys.beanList(), async () => ['豆子'], { apply: () => {} }).settled
  cache.invalidateAfter({ kind: 'brew' })
  r.check(cache.peek(cacheKeys.brewPage(0)) === null, '寫入紀錄後時間軸的快取沒了')
  r.check(cache.peek(cacheKeys.beanList()) !== null, '豆子列表不受影響')

  r.section('飛行中的請求被失效後不寫回舊資料')
  // 存檔的同時背景重查還在路上，回來時若照寫，畫面就會倒退回舊資料
  __resetQueryCache()
  const slow = cache.swr(cacheKeys.brewPage(0), async () => { await sleep(20); return ['查詢中途的舊資料'] }, {
    apply: () => {},
  })
  cache.invalidateAfter({ kind: 'brew' })
  await slow.settled
  r.check(cache.peek(cacheKeys.brewPage(0)) === null,
    '中途被失效的查詢回來後不寫進快取——否則剛存的東西會被舊資料蓋回去')

  r.section('同一個 key 同時被要兩次只發一個請求')
  __resetQueryCache()
  let calls = 0
  const shared = async () => { calls++; await sleep(10); return rows }
  const a = cache.swr(KEY, shared, { apply: () => {} })
  const b = cache.swr(KEY, shared, { apply: () => {} })
  await Promise.all([a.settled, b.settled])
  r.check(calls === 1, `兩個元件同時要同一份資料只查一次（實際 ${calls} 次）`)

  return r.finish()
}
