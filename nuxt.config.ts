import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2025-08-31',
  devtools: { enabled: true },

  modules: ['@nuxtjs/supabase'],

  css: ['~/assets/css/main.css'],

  vite: {
    plugins: [tailwindcss()],
  },

  supabase: {
    // 專案沒有產 database.types.ts，模組每次啟動都會警告一次。
    // 明講關掉，而不是留著警告——目前型別本來就是 unknown，
    // 關掉沒有少掉任何保護，只是把「還沒做」寫清楚。
    // 之後若要真的補上：supabase gen types typescript > types/database.types.ts，
    // 那會一併解決各處 `as unknown as` 與 `as never` 的轉型。
    types: false,

    // 階段 2 起恢復模組預設的自動導向：未登入者一律導向 /login。
    // exclude 需自行加上 /signup，否則還沒有帳號的人會被導走、無法註冊。
    redirectOptions: {
      login: '/login',
      callback: '/confirm',
      exclude: ['/signup'],
    },

    cookieOptions: {
      // 模組預設只有 8 小時，時間到就得重新登入。這是個人紀錄工具，
      // 沒有理由讓使用者每天重登，改為 30 天。
      maxAge: 60 * 60 * 24 * 30,
      sameSite: 'lax',
      // 正式環境走 HTTPS，維持 true。開發環境在下方的 $development 覆寫成
      // false：若用手機連區網 IP（http://192.168.x.x）測試，瀏覽器會直接
      // 丟棄 Secure cookie，於是每次回來都要重新登入。
      secure: true,
    },
  },

  // Nuxt 的環境覆寫，只影響 nuxt dev
  $development: {
    supabase: {
      cookieOptions: { secure: false },
    },
  },

  app: {
    head: {
      htmlAttrs: { lang: 'zh-Hant-TW' },
      title: '手沖咖啡紀錄',
      link: [
        // iOS 加到主畫面時會去要 apple-touch-icon.png。沒有這個檔的話
        // 請求會落到 SPA 路由上，dev console 每次都跟著噴 Vue Router 警告。
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32.png' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          // 只載入實際會用到的字重：Sans 400/500/700、Serif 500/700。
          // CJK 全字重過重。display=swap 對應《03-介面規範》第 8 節。
          href: 'https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700&family=Noto+Serif+TC:wght@500;700&display=swap',
        },
      ],
    },
  },

  typescript: {
    strict: true,
    // tests/ 用 Node 內建的型別剝除直接跑 .ts，import 需要帶副檔名。
    // 開這個選項才能同時讓測試受 typecheck 保護，而不是把 tests/ 排除掉。
    tsConfig: {
      compilerOptions: {
        allowImportingTsExtensions: true,
      },
    },
  },
})
