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
    // 階段 2 起恢復模組預設的自動導向：未登入者一律導向 /login。
    // exclude 需自行加上 /signup，否則還沒有帳號的人會被導走、無法註冊。
    redirectOptions: {
      login: '/login',
      callback: '/confirm',
      exclude: ['/signup'],
    },
  },

  app: {
    head: {
      htmlAttrs: { lang: 'zh-Hant-TW' },
      title: '手沖咖啡紀錄',
      link: [
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
  },
})
