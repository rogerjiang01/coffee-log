/**
 * 未喝完的豆子（總覽的「沖煮中的豆子」，以及兩個浮動新增按鈕判斷要不要帶入豆子）。
 *
 * 總覽與紀錄分頁共用 beans:active 這個快取 key，所以查詢只能有這一份——
 * 兩頁各寫一份 select 的話，誰先跑誰決定快取內容，後到的那頁會拿到缺欄位的資料，
 * 而且不會有錯誤（utils/cacheKeys.ts）。
 */
export interface ActiveBean {
  id: string
  name: string
  photo_path: string | null
  roast_date: string | null
  roast_level: RoastLevel | null
  is_sample: boolean
}

export function useActiveBeans() {
  const supabase = useSupabaseClient()
  return async function fetchActiveBeans(): Promise<ActiveBean[]> {
    const { data, error } = await supabase
      .from('beans')
      .select('id, name, photo_path, roast_date, roast_level, is_sample')
      .eq('is_finished', false)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
    if (error) throw toError(error)
    return (data ?? []) as unknown as ActiveBean[]
  }
}
