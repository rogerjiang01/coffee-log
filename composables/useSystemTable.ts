// 純系統表的一次性讀取。
//
// **只給不會在執行期改變的表用。** 目前符合條件的只有兩張：
//   - countries（《01》§4.4 明訂為純系統表，使用者不可新增）
//   - equipment_catalog（純系統表，程式裡沒有任何寫入路徑）
//
// 混合表（brew_methods、flavor_tags、processing_methods、varieties）**不得**
// 使用這裡：使用者可以就地新增，快取會讓他剛建好的項目在別頁看不到。
// 要納入的話得先想清楚失效時機，那不是加一個 key 就能解決的事。
//
// 存在 useState 而不是模組層變數：模組層在 SSR 時是跨請求共用的，
// 就算這些資料對所有人都相同，也不該養成那個習慣。

/** 同一份資料被兩個元件同時要時共用同一個請求，不發兩次 */
const inflight = new Map<string, Promise<unknown>>()

export function useSystemTable() {
  const cache = useState<Record<string, unknown[]>>('system-tables', () => ({}))

  /** key 只是快取格子的名字，通常用「表名」或「表名:條件」 */
  async function read<T>(key: string, fetcher: () => Promise<T[]>): Promise<T[]> {
    const cached = cache.value[key]
    if (cached) return cached as T[]

    const pending = inflight.get(key)
    if (pending) return await pending as T[]

    const promise = fetcher()
      .then((rows) => {
        cache.value[key] = rows as unknown[]
        return rows
      })
      .finally(() => inflight.delete(key))

    inflight.set(key, promise)
    return await promise
  }

  return { read }
}
