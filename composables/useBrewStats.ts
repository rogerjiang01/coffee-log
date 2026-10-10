/**
 * 總覽卡片與結算頁共用的兩份資料（cacheKeys.brewStats、cacheKeys.goals）。
 * 同一個快取 key 只能有一種欄位（utils/cacheKeys.ts），所以查詢只寫在這裡。
 *
 * 統計排除範例紀錄（《01》§13）：這裡用 is_sample = false 過濾，utils/dashboard.ts 再擋一次。
 */
export function useBrewStats() {
  const supabase = useSupabaseClient()

  async function fetchStats(): Promise<StatBrew[]> {
    const { data, error } = await supabase
      .from('brews')
      .select('id, bean_id, brewed_at, rating, dose, is_sample, beans ( name, photo_path, roast_level, is_finished, is_sample )')
      .eq('is_sample', false)
      .order('brewed_at', { ascending: false })
      .order('id', { ascending: false })
    if (error) throw toError(error)
    return (data ?? []) as unknown as StatBrew[]
  }

  async function fetchGoals(): Promise<GoalRow[]> {
    const { data, error } = await supabase
      .from('weekly_goals')
      .select('cups, created_at')
      .order('created_at', { ascending: true })
    if (error) throw toError(error)
    return (data ?? []) as unknown as GoalRow[]
  }

  return { fetchStats, fetchGoals }
}
