// stale-while-revalidate 的客戶端快取。
//
// 要解決的不是「查詢慢」，是「每次跳頁都得等一趟來回」。
// 到東京的 RTT 約 115ms 是物理距離，減不掉；能減的是來回的次數。
// 命中時畫面立刻出來，同時背景重查，資料真的變了才更新。
//
// **放記憶體不放 localStorage。** 重新整理後重抓一次可以接受，
// 跨分頁一致性要處理的東西（storage 事件、序列化、配額）不值得。
//
// 沒有大小上限：單一使用者的資料量級是幾百 KB（一筆紀錄約 500 bytes，
// 1000 筆也才 500KB），比一張豆袋照片還小。
//
// **不快取照片的簽名網址。** 它有時效，快取起來過期之後圖會裂掉。
// 網址每次重新取得，但可以與主資料查詢並行，不要串行。

// 明寫 import 而不是靠 Nuxt 自動匯入：測試要能直接載入這支檔案，
// 量的才是真正跑在使用者機器上的那段程式，不是一份仿製品。
import { invalidationsFor, matchesPattern, type Mutation } from '../utils/cacheKeys.ts'

interface Entry {
  data: unknown
  /** 只有部分欄位。從列表帶進詳情頁時會是 true */
  partial: boolean
}

// 模組層的 Map 在 SSR 時是跨請求共用的，所以伺服器端一律不快取（見 swr）。
// 本專案的資料查詢全部在 onMounted 發生，伺服器端本來就走不到這裡。
const store = new Map<string, Entry>()

/** 同一個 key 同時被要兩次時共用一個請求，不發兩次 */
const inflight = new Map<string, Promise<unknown>>()

export interface SwrHandlers<T> {
  /** 資料到手時呼叫。命中會呼叫一次，背景重查回來若有變動再呼叫一次 */
  apply: (data: T) => void
  /**
   * 查詢失敗。**只在沒有快取可用時呼叫**——畫面上已經有正確內容時，
   * 背景重新驗證失敗不該把它蓋掉，那只會讓使用者看到莫名其妙的錯誤。
   */
  onError?: (error: unknown) => void
}

export function useQueryCache() {
  function peek<T>(key: string): { data: T, partial: boolean } | null {
    const entry = store.get(key)
    return entry ? { data: entry.data as T, partial: entry.partial } : null
  }

  /**
   * 先放進去一份不完整的資料。用在「列表已經查到的欄位，
   * 別讓詳情頁再要一次」——例如豆子列表已有豆名、照片路徑、烘焙日期。
   *
   * 已經有完整資料時不覆蓋：部分蓋過完整是退步。
   */
  function prime<T>(key: string, data: T) {
    const existing = store.get(key)
    if (existing && !existing.partial) return
    store.set(key, { data, partial: true })
  }

  function set<T>(key: string, data: T) {
    store.set(key, { data, partial: false })
  }

  /** 清掉符合任一樣式的 key。樣式結尾的 `*` 是前綴比對 */
  function invalidate(patterns: string[]) {
    for (const key of [...store.keys()]) {
      if (patterns.some(pattern => matchesPattern(key, pattern))) store.delete(key)
    }
    // 正在飛的請求也要作廢，否則它回來會把舊資料寫回去
    for (const key of [...inflight.keys()]) {
      if (patterns.some(pattern => matchesPattern(key, pattern))) inflight.delete(key)
    }
  }

  /** 寫入之後呼叫。對應關係定義在 utils/cacheKeys.ts */
  function invalidateAfter(mutation: Mutation) {
    invalidate(invalidationsFor(mutation))
  }

  async function run<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const pending = inflight.get(key) as Promise<T> | undefined
    if (pending) return await pending

    const promise = fetcher()
      .then((data) => {
        // 這中間可能被 invalidate 掉了。還在 inflight 裡才代表這份結果仍然有效
        if (inflight.get(key) === promise) set(key, data)
        return data
      })
      .finally(() => {
        if (inflight.get(key) === promise) inflight.delete(key)
      })

    inflight.set(key, promise)
    return await promise
  }

  /**
   * 快取命中就立刻 apply 並在背景重查；未命中就等查詢回來再 apply。
   *
   * 回傳 `hit`：呼叫端用它決定要不要顯示骨架。命中時同步就 apply 過了，
   * 骨架連一幀都不該出現。
   */
  function swr<T>(key: string, fetcher: () => Promise<T>, handlers: SwrHandlers<T>): {
    hit: boolean
    settled: Promise<void>
  } {
    if (import.meta.server) {
      return {
        hit: false,
        settled: fetcher().then(handlers.apply).catch(e => handlers.onError?.(e)),
      }
    }

    const cached = peek<T>(key)

    if (cached) {
      handlers.apply(cached.data)
      const settled = run(key, fetcher)
        .then((fresh) => {
          // 只有真的變了才動畫面：無謂的重繪會讓捲動位置與輸入焦點跳掉
          if (JSON.stringify(fresh) !== JSON.stringify(cached.data)) handlers.apply(fresh)
        })
        // 背景重新驗證失敗不蓋掉畫面上已經正確的內容，只留線索
        .catch(e => console.warn(`[cache] 背景重新驗證失敗：${key}`, e))
      return { hit: true, settled }
    }

    const settled = run(key, fetcher)
      .then(handlers.apply)
      .catch((e) => { handlers.onError?.(e) })
    return { hit: false, settled }
  }

  return { swr, peek, prime, set, invalidate, invalidateAfter }
}

/** 測試用：清空整個快取 */
export function __resetQueryCache() {
  store.clear()
  inflight.clear()
}
