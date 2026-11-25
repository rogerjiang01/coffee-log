<script setup lang="ts">
// 先把連線建起來。所有資料查詢都在 onMounted 才發，第一趟因此要付
// DNS ＋ TCP ＋ TLS 的錢——實測冷連線約 990ms，暖連線只要約 115ms。
// preconnect 讓瀏覽器在解析 HTML 時就開始握手，跟載入 JS 平行進行。
const supabaseUrl = useRuntimeConfig().public.supabase.url

useHead({
  link: [{ rel: 'preconnect', href: supabaseUrl, crossorigin: '' }],
})

// 分頁列在這裡統一放，依頁面宣告的畫面類型（definePageMeta 的 screen）決定，
// 不由各頁自己放（《03》§3）。放在錯誤邊界外面：頁內算繪出錯時它還在，仍然是出口。
// 分享頁例外：分頁列由登入狀態決定（utils/navigation.ts）
const route = useRoute()

// 開場（composables/useSplash.ts）：打開 App 時伺服器挑一張首圖寫進 HTML，並預先載入；
// 開場期間 <html> 的底色換成插畫的深綠，圖還沒到也不會白閃。
const splash = useSplash()
if (import.meta.server && splash.mode.value) {
  useHead({ link: [{ rel: 'preload', as: 'image', href: coverUrl(splash.cover.value), fetchpriority: 'high' }] })
}
// splash-app：已登入的開場期間把頁面內容藏起來，首圖淡出時底下只看得到底色；
// splash-reveal：首圖消失之後內容淡入（assets/css/main.css）
useHead({
  htmlAttrs: {
    class: computed(() => {
      if (splash.mode.value === 'app') return 'splash-on splash-app'
      if (splash.mode.value) return 'splash-on'
      return splash.revealing.value ? 'splash-reveal' : ''
    }),
  },
})
// 開完之後，閒置時把另外三張抓進快取（下次打開挑到哪一張都是現成的）
onMounted(() => {
  if (!splash.mode.value) return
  const warm = () => {
    for (let index = 1; index <= COVER_COUNT; index++) {
      if (index !== splash.cover.value) new Image().src = coverUrl(index)
    }
  }
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(warm)
  else setTimeout(warm, 2000)
})

const userId = useCurrentUserId()
const tabBar = computed(() => showsTabBar(route.meta.screen, userId.value !== null))
// 瀏覽型的右下角還有浮動新增按鈕（《03》§3），要多讓出按鈕的高度
const tabBarSpace = computed(() => route.meta.screen === 'browse' ? 'var(--fab-clearance)' : 'var(--tab-bar-clearance)')
</script>

<template>
  <!-- 已登入時的開場：首圖蓋在總覽上，資料到了就淡出；首圖完全消失之後總覽才淡入（《03》§6.1） -->
  <AppSplash v-if="splash.mode.value === 'app'" />

  <!-- 元件層的例外只讓這一塊掛掉，不要整個應用程式變白畫面。
       error.vue 接的是致命錯誤與路由錯誤；這一層接的是頁面內的
       算繪例外——後者比前者常見得多，而且往往只影響一小塊。 -->
  <NuxtErrorBoundary>
    <NuxtPage />

    <template #error="{ error, clearError }">
      <main
        class="mx-auto flex min-h-dvh flex-col justify-center px-5 py-12"
        :style="{ maxWidth: 'var(--content-max-narrow)' }"
      >
        <h1 class="text-display-s font-medium">這一頁沒有顯示成功</h1>
        <!-- 與 error.vue 同一句：開發者直接跟使用者說話，保留溝通語氣（《03》§5.5 的例外） -->
        <p class="mt-3 text-sm">
          已記錄的資料不受影響，重試通常可以解決。如果一直出現同一組代碼，歡迎來信
          <a
            :href="supportMailto(errorReportCode(error))"
            class="whitespace-nowrap underline"
            :style="{ color: 'var(--accent)' }"
          >{{ SUPPORT_EMAIL }}</a>。
        </p>

        <div class="mt-8 flex flex-col gap-3">
          <AppButton block
            to="/"
            @click="clearError"
          >
            回總覽
          </AppButton>
          <AppButton variant="outline" block
            @click="clearError"
          >
            重試
          </AppButton>
        </div>

        <p class="mt-8 text-sm text-muted">
          錯誤代碼 {{ errorReportCode(error) }}
        </p>
      </main>
    </template>
  </NuxtErrorBoundary>

  <template v-if="tabBar">
    <!-- 分頁列浮在內容上面，頁面最底下要讓出它（與瀏覽型的浮動新增按鈕）佔的高度，最後一張卡片才不會被蓋住。
         **只在這裡留**，頁面的 main 不再自己留底部空白（tokens.css 的 --tab-bar-clearance、--fab-clearance） -->
    <div aria-hidden="true" :style="{ height: tabBarSpace }" />
    <BottomNav />
  </template>
</template>
