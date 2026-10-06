// 目標設定頁的出現時機（《02》§4.4）：已登入、而且還沒有任何每週記錄目標時，
// 先到 /goal，不直接去總覽。新使用者註冊後、現有使用者上線後第一次打開都會走到這裡。
// 分享頁、登入註冊與目標設定頁本身不導向（utils/weeklyGoal.ts 的 needsGoalSetup）。
//
// 只在用戶端判斷：這個專案的資料一律在用戶端查（onMounted），伺服器端沒有查詢的路徑。
// 初次載入時 Nuxt 會在用戶端再跑一次 middleware，所以直接打開網址也會被導過去。
//
// 「有沒有目標」一旦查到有，記在 useState 裡（依使用者），之後換頁不再查。
// 查詢失敗時不擋：寧可這一次沒導過去，也不要讓整個 app 因為一個目標查詢打不開。

export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) return
  const userId = useCurrentUserId().value
  if (!needsGoalSetup(to.path, userId !== null, false)) return

  const known = useState<string | null>('goal-known-for', () => null)
  if (known.value === userId) return

  const supabase = useSupabaseClient()
  const { data, error } = await supabase.from('weekly_goals').select('id').limit(1)
  if (error) return
  if (data?.length) {
    known.value = userId
    return
  }
  return navigateTo(GOAL_SETUP_PATH, { replace: true })
})
