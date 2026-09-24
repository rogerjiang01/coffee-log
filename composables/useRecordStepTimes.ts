// 使用者偏好：記錄停水時間（profiles.record_step_times，《02》§5 區塊三）。
// 唯一的切換入口在沖煮表單的分段注水區標題列，設定頁沒有第二個控制點。
//
// 預設關閉。**只決定沖煮表單上顯不顯示停水時間欄位**——不刪除、不改寫任何
// 已記錄的時間。表單狀態裡的 holdSeconds 不管開關開不開都一樣存在、一樣儲存。
//
// 為什麼放 profiles 而不是 localStorage：見《01》§3.1 與
// migration 20260911100000_profile_record_step_times.sql。
//
// 讀取走 SWR 快取：第一次打開表單要一趟來回，之後跳頁立即可用。
// 還沒讀到之前一律當成關閉，與預設一致——多數人（關閉）不會看到欄位閃一下；
// 打開的人第一次載入時時間欄位會晚一點出現，這是比較能接受的方向。

interface ProfilePrefs { record_step_times: boolean }

export function useRecordStepTimes() {
  const supabase = useSupabaseClient()
  const cache = useQueryCache()
  const userId = useCurrentUserId()

  const enabled = ref(false)
  const loaded = ref(false)
  const saving = ref(false)
  const error = ref('')

  async function fetchPrefs(): Promise<ProfilePrefs> {
    // RLS 只給自己那一列，一個使用者也只有一列
    const { data, error: fetchError } = await supabase
      .from('profiles')
      .select('record_step_times')
      .maybeSingle()
    if (fetchError) throw toError(fetchError)
    return { record_step_times: (data as ProfilePrefs | null)?.record_step_times === true }
  }

  onMounted(async () => {
    const { settled } = cache.swr(cacheKeys.profilePrefs(), fetchPrefs, {
      apply: (prefs) => { enabled.value = prefs.record_step_times },
      onError: (e) => { error.value = `讀不到設定：${errorText(e)}` },
    })
    await settled
    loaded.value = true
  })

  async function set(next: boolean) {
    if (!userId.value) {
      error.value = SESSION_EXPIRED
      return
    }
    const previous = enabled.value
    // 開關立刻反應；存不進去再退回，並講出原因
    enabled.value = next
    saving.value = true
    error.value = ''
    const { data, error: updateError } = await supabase
      .from('profiles')
      .update({ record_step_times: next } as never)
      .eq('id', userId.value)
      .select('record_step_times')
      .maybeSingle()
    saving.value = false
    if (updateError || !data) {
      enabled.value = previous
      error.value = `沒有存到：${updateError ? errorText(updateError) : '找不到帳號資料'}`
      return
    }
    cache.set(cacheKeys.profilePrefs(), { record_step_times: next })
  }

  return { enabled, loaded, saving, error, set }
}
