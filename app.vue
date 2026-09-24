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
const userId = useCurrentUserId()
const tabBar = computed(() => showsTabBar(route.meta.screen, userId.value !== null))
</script>

<template>
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
        <h1 class="font-serif text-xl font-bold">這一頁沒有顯示成功</h1>
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
          <NuxtLink
            to="/"
            class="w-full rounded-sm px-4 py-3 text-center font-medium"
            :style="{ background: 'var(--accent)', color: 'var(--on-accent)', minHeight: 'var(--touch-min)' }"
            @click="clearError"
          >
            回首頁
          </NuxtLink>
          <button
            type="button"
            class="w-full rounded-sm border px-4 py-3"
            :style="{ borderColor: 'var(--border-strong)', minHeight: 'var(--touch-min)' }"
            @click="clearError"
          >
            重試
          </button>
        </div>

        <p class="mt-8 text-xs text-muted">
          錯誤代碼 {{ errorReportCode(error) }}
        </p>
      </main>
    </template>
  </NuxtErrorBoundary>

  <template v-if="tabBar">
    <!-- 分頁列是 fixed，頁面最底下要讓出它的高度，最後一個按鈕才不會被蓋住 -->
    <div aria-hidden="true" :style="{ height: 'calc(52px + env(safe-area-inset-bottom))' }" />
    <BottomNav />
  </template>
</template>
