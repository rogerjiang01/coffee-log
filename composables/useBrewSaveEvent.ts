// 每次儲存沖煮紀錄就記一列耗時（brew_save_events，《01》§9.2）。
//
// **不能讓它擋住儲存。** 它是量測用的，寫不進去就算了：不顯示錯誤、不重試、
// 不影響已經存好的紀錄，只在開發模式印出來。使用者存不了紀錄的代價，
// 遠高於少一列統計。
//
// 寫入時機是紀錄儲存成功之後——失敗的儲存不該產生一列「記錄花了多久」，
// 那次的時間會被下一次成功的儲存一起帶進去。

export function useBrewSaveEvent() {
  const supabase = useSupabaseClient()

  /**
   * 記一列。**呼叫端要 await**：SPA 導頁不會等未完成的請求，
   * 不 await 的話換頁那一刻就可能把它丟掉，而這張表的價值就在於不漏。
   * 代價是多一趟往返，而這條路徑本來就已經有好幾趟。
   */
  async function record(event: {
    brewId: string
    userId: string
    entry: BrewSaveEntry | null
    duration: InteractionDuration
  }): Promise<void> {
    // 認不出入口就不記：歸錯的一列比缺一列難處理（utils/draft.ts）
    if (!event.entry) return
    try {
      // 不可以接 .select()：這張表沒有給 authenticated select 權限
      const { error } = await supabase.from('brew_save_events').insert({
        brew_id: event.brewId,
        user_id: event.userId,
        entry: event.entry,
        params_seconds: event.duration.params,
        tasting_seconds: event.duration.tasting,
        total_seconds: event.duration.total,
      } as never)
      if (error && import.meta.dev) console.warn('[save-event] 耗時沒記到', error)
    }
    catch (e) {
      if (import.meta.dev) console.warn('[save-event] 耗時沒記到', e)
    }
  }

  return { record }
}
