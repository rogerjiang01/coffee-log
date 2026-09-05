// 就地新增介面的暫存。
//
// 心智錯位：在沖煮表單裡點「新增豆子」，那個動作對系統是「建立一個豆子
// 物件」，對使用者是「填豆子這一格」。他填完直覺就是回到主表單繼續，
// 不會想到還要按一次儲存——於是關掉，內容全沒了。
//
// **解法是關掉時把內容留著，不加提示。** 不用對話框問「要放棄嗎」：
// 那等於把系統的心智模型推回給使用者，而且與全站「不用對話框打斷」
// 的原則衝突。下次打開新增介面時剛才填的還在，他自然會繼續。
//
// 只活在同一個工作階段的記憶體裡，不進 localStorage：
// 這是「剛才那幾秒」的連續性，不是跨天的暫存（那是 useFormDraft 的事）。
// 照片是 Blob，本來也塞不進 localStorage。
//
// 成功儲存後必須清掉，否則下次開會看到已經建好的那一筆。

// 模組層的 Map 在 SSR 時是跨請求共用的。這些介面只在使用者互動後出現，
// 伺服器端走不到，但仍然只在瀏覽器端寫入。
const store = new Map<string, unknown>()

export function useInlineDraft<T extends object>(key: string, empty: () => T) {
  /** 上次留下的內容；沒有就給一份空的 */
  function read(): T {
    return (store.get(key) as T | undefined) ?? empty()
  }

  function save(value: T) {
    if (import.meta.server) return
    store.set(key, { ...value })
  }

  /** 成功儲存後呼叫 */
  function clear() {
    store.delete(key)
  }

  return { read, save, clear }
}

/** 測試用 */
export function __resetInlineDrafts() {
  store.clear()
}
