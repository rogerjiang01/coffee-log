/**
 * 表單自動暫存（《02-功能規格》§6）。
 *
 * 還原分成兩種，依離開多久決定——技術上無法區分「重整」與「隔天回來」，
 * 但離開時長是使用者意圖的合理代理指標：
 *
 *   30 分鐘內   直接填入，頂部 sticky 橫幅告知並提供「全部清除」。
 *               沒有東西需要使用者決定，不該擋畫面。填入後立刻恢復寫入。
 *   超過 30 分鐘 用 overlay 問。這時使用者很可能是要記新的一杯，
 *               直接填入舊資料會讓他得先刪一輪才能開始。
 *
 * 離開頁面前不攔截確認——有自動暫存就不需要用對話框打斷使用者。
 */
export function useFormDraft<T>(key: string, options: {
  /** 目前的表單狀態，必須讀取響應式資料 */
  read: () => T
  /** 把資料寫回表單 */
  restore: (data: T) => void
  /** 把表單還原成初始狀態，供「全部清除」使用 */
  reset?: () => void
  /** 還原前的處理，例如把指向已刪除資料的 id 清掉 */
  sanitize?: (data: T) => Promise<T> | T
}) {
  /** overlay 模式：等使用者決定 */
  const pending = ref<T | null>(null)
  /** 橫幅模式：已經填入，只是告知 */
  const recovered = ref(false)

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
    recovered.value = false
    try {
      localStorage.removeItem(key)
    }
    catch {}
  }

  async function applyDraft(data: T) {
    const cleaned = options.sanitize ? await options.sanitize(data) : data
    options.restore(cleaned)
  }

  onMounted(async () => {
    baseline = JSON.stringify(options.read())

    let envelope: { savedAt: number, data: T } | null = null
    try {
      envelope = unpackDraftEnvelope<T>(localStorage.getItem(key))
    }
    catch {}

    if (!envelope) {
      armed.value = true
      return
    }
    // 與初始狀態相同的暫存沒有還原價值
    if (JSON.stringify(envelope.data) === baseline) {
      clear()
      armed.value = true
      return
    }

    if (draftAge(envelope.savedAt) === 'recent') {
      // 直接填入。**不捲動頁面**——使用者原本在哪個位置是他的位置。
      await applyDraft(envelope.data)
      recovered.value = true
      // 內容已經在表單上，繼續填的東西應該被保護，立刻恢復寫入
      armed.value = true
    }
    else {
      pending.value = envelope.data
      armed.value = true
    }
  })

  onBeforeUnmount(() => {
    if (timer) clearTimeout(timer)
  })

  watch(options.read, (value) => {
    // overlay 還開著時不寫入，否則空白表單會蓋掉那筆暫存。
    // 橫幅模式不受此限——內容已經填進去了。
    if (!armed.value || pending.value !== null) return
    // 沒動過的空白表單不值得存，存了下次進來就會被問一次
    if (JSON.stringify(value) === baseline) return
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => write(value), 500)
  }, { deep: true })

  /** overlay：接著填 */
  async function accept() {
    const data = pending.value
    pending.value = null
    if (data === null) return
    await applyDraft(data)
  }

  /** overlay：重新開始 */
  function discard() {
    pending.value = null
    clear()
  }

  /** 橫幅：全部清除。把表單退回初始狀態並丟掉暫存。 */
  function clearAll() {
    options.reset?.()
    clear()
  }

  return { pending, recovered, accept, discard, clearAll, clear }
}
