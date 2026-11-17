// 目標設定頁的出現時機（《02》§4.4）：已登入、而且還沒有任何每週記錄目標時，
// 先到 /goal，不直接去總覽。新使用者註冊後、現有使用者上線後第一次打開都會走到這裡。
// 分享頁、登入註冊與目標設定頁本身不導向（utils/weeklyGoal.ts 的 needsGoalSetup）。
//
// **整頁載入由伺服器判斷，站內換頁由用戶端判斷**（2026-11-17 改）。
// 原本只在用戶端判斷：整頁載入時伺服器照網址算繪 A 頁，瀏覽器在 hydration 途中導向 /goal，
// 拿 A 頁的 HTML 去對 /goal 的畫面。正式版的 Vue 不修屬性的差異，/goal 就沿用了 A 頁 <main> 的
// class 與 style——「開始」按鈕不在底部、上方留白不對。每個還沒有目標的人打開 App 都會遇到
// （上線後的第一次打開就是這個情況）。現在伺服器先查、直接回 302，瀏覽器拿到的就是 /goal 的 HTML。
// 這是全站唯一在伺服器端查資料的地方；它不碰任何和時間有關的值。
//
// 「有沒有目標」一旦查到有，記在 useState 裡（依使用者）：伺服器查到的會跟著頁面帶到瀏覽器，
// 之後換頁不再查。
// 查詢失敗時不擋：寧可這一次沒導過去，也不要讓整個 app 因為一個目標查詢打不開。

export default defineNuxtRouteMiddleware(async (to) => {
  const userId = useCurrentUserId().value
  if (!needsGoalSetup(to.path, userId !== null, false)) return

  const known = useState<string | null>('goal-known-for', () => null)
  if (known.value === userId) return

  // 整頁載入的第一次導覽：伺服器已經判斷過了（要導向的話伺服器已經回 302）。
  // 這時在瀏覽器導向一定會對不上伺服器的 HTML，所以不導；伺服器沒查成功的話，下一次換頁再查
  if (import.meta.client && useNuxtApp().isHydrating) return

  const supabase = useSupabaseClient()
  const { data, error } = await supabase.from('weekly_goals').select('id').limit(1)
  if (error) return
  if (data?.length) {
    known.value = userId
    return
  }
  return navigateTo(GOAL_SETUP_PATH, { replace: true })
})
