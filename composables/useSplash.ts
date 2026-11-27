// 開場（《02》§3、《03》§6 的開場動畫）。
//
// 出現在兩個時機：
//   1. **打開 App**：這一次載入的第一個畫面是 `/`（已登入，總覽）或 `/login`（未登入）。
//      由伺服器在算繪時決定——useState 的初始值只在伺服器算一次，瀏覽器沿用同一份。
//   2. **在設定頁按「登出」之後**（2026-11-25）：登入頁演一次和打開 App 時相同的 'login' 開場。
//      設定頁在導向前呼叫 prepareLoginIntro()，登入頁的 AuthShell 掛上時接手。
// 其他站內導覽（從註冊頁回登入頁、登入過期被導回登入頁）、分享頁、直接打開的其他頁面都不演。
//
//   'app'    已登入：首圖蓋在總覽上，資料到了就淡出（最少 0.3 秒、最多 0.8 秒），AppSplash.vue。
//            首圖淡出時底下只有頁面底色；完全消失之後總覽才淡入（revealing）
//   'login'  未登入：登入頁自己演「首圖 → 綠色漸層與 logo 往上 → 表單出現」，AuthShell.vue
//   null     不演
//
// 首圖從 Cover 的 4 張插畫隨機挑一張。打開 App 時由伺服器挑、寫進 HTML 並預先載入，瀏覽器不必等程式就看得到；
// 登出時由瀏覽器重新挑一張，導向前先等它解碼（最多 LOGIN_INTRO_PRELOAD_MS，超過照樣導向，
// 圖還沒到時底下是 --splash-bg）。

export type SplashMode = 'app' | 'login' | null

export const COVER_COUNT = 4
/** 首圖的網址。路徑裡的 v1 是圖檔的版本：這個目錄設了一年的不可變快取（vercel.json），換圖要換版本 */
export const coverUrl = (index: number) => `/splash/v1/cover-${index}.webp`
/** 登出後導向登入頁之前，最多等首圖解碼多久 */
export const LOGIN_INTRO_PRELOAD_MS = 500

const randomCover = () => 1 + Math.floor(Math.random() * COVER_COUNT)

export function useSplash() {
  const mode = useState<SplashMode>('splash-mode', () => {
    if (!import.meta.server) return null
    const path = useRoute().path
    return path === '/' ? 'app' : path === '/login' ? 'login' : null
  })
  // 站內導覽到登入頁時瀏覽器才第一次用到，那時由瀏覽器挑（頁面是瀏覽器算繪的，沒有對不上的問題）
  const cover = useState('splash-cover', randomCover)
  /** 總覽的資料到了沒有。pages/index.vue 讀完之後設成 true */
  const ready = useState('splash-ready', () => false)
  /** 已登入的開場剛結束、總覽正在淡入的那一小段（AppSplash.vue 設，app.vue 掛成 <html> 的 class） */
  const revealing = useState('splash-revealing', () => false)
  /**
   * 登出後要演的登入開場還沒開始（prepareLoginIntro 設、AuthShell 掛上時收回並把 mode 設成 'login'）。
   * 不在設定頁就直接設 mode：mode 一改，app.vue 就在 <html> 掛 splash-on，
   * 換頁之前的那一下設定頁會露出深綠的底色
   */
  const loginIntroPending = useState('splash-login-pending', () => false)

  /** 設定頁登出、導向 /login 之前呼叫：重新挑一張首圖，等它解碼（最多 LOGIN_INTRO_PRELOAD_MS） */
  async function prepareLoginIntro() {
    cover.value = randomCover()
    const image = new Image()
    image.src = coverUrl(cover.value)
    await Promise.race([
      image.decode().catch(() => {}),
      new Promise(resolve => window.setTimeout(resolve, LOGIN_INTRO_PRELOAD_MS)),
    ])
    loginIntroPending.value = true
  }

  return { mode, cover, ready, revealing, loginIntroPending, prepareLoginIntro }
}
