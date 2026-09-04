/**
 * 表單自動暫存（《02-功能規格》§6）。
 *
 * 行為：
 *   欄位變動 → debounce 500ms → 寫入 localStorage
 *   重新進入 → 偵測到暫存就把它交給呼叫端顯示提示，**在使用者決定之前
 *   不寫入**，否則空白表單會立刻蓋掉那筆暫存
 *   成功儲存 → 清除
 *
 * 離開頁面前不攔截確認——有自動暫存就不需要用對話框打斷使用者。
 */
export function useFormDraft<T>(key: string, options: {
  /** 目前的表單狀態，必須讀取響應式資料 */
  read: () => T
  /** 還原時把資料寫回表單 */
  restore: (data: T) => void
  /** 還原前的處理，例如把指向已刪除資料的 id 清掉 */
  sanitize?: (data: T) => Promise<T> | T
}) {
  const pending = ref<T | null>(null)
  const armed = ref(false)
  let timer: ReturnType<typeof setTimeout> | null = null
  let baseline: string | null = null

  function write(value: T) {
    try {
      localStorage.setItem(key, packDraft(value))
    }
    catch {
      // 私密瀏覽或容量已滿。暫存是安全網，不該因為存不了就中斷填寫。
    }
  }

  function clear() {
    if (timer) clearTimeout(timer)
    timer = null
    try {
      localStorage.removeItem(key)
    }
    catch {}
  }

  onMounted(() => {
    baseline = JSON.stringify(options.read())
    try {
      const found = unpackDraft<T>(localStorage.getItem(key))
      // 與初始狀態相同的暫存沒有還原價值，直接丟掉
      if (found !== null && JSON.stringify(found) !== baseline) pending.value = found
      else if (found !== null) clear()
    }
    catch {}
    armed.value = true
  })

  onBeforeUnmount(() => {
    if (timer) clearTimeout(timer)
  })

  watch(options.read, (value) => {
    // 使用者還沒決定要不要還原時不寫入，否則會蓋掉那筆暫存
    if (!armed.value || pending.value !== null) return
    // 沒動過的空白表單不值得存，存了下次進來就會被問一次
    if (JSON.stringify(value) === baseline) return
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => write(value), 500)
  }, { deep: true })

  async function accept() {
    const data = pending.value
    pending.value = null
    if (data === null) return
    const cleaned = options.sanitize ? await options.sanitize(data) : data
    options.restore(cleaned)
  }

  function discard() {
    pending.value = null
    clear()
  }

  return { pending, accept, discard, clear }
}
