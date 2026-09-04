<script setup lang="ts">
// 先把連線建起來。所有資料查詢都在 onMounted 才發，第一趟因此要付
// DNS ＋ TCP ＋ TLS 的錢——實測冷連線約 990ms，暖連線只要約 115ms。
// preconnect 讓瀏覽器在解析 HTML 時就開始握手，跟載入 JS 平行進行。
const supabaseUrl = useRuntimeConfig().public.supabase.url

useHead({
  link: [{ rel: 'preconnect', href: supabaseUrl, crossorigin: '' }],
})
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
        <p class="mt-3 text-sm">
          已經記錄的資料沒有受影響。回上一頁或回首頁都可以繼續使用。
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
            重試這一頁
          </button>
        </div>

        <p class="mt-8 text-xs text-muted">
          錯誤代碼 {{ String((error as Error)?.name || 'Error') }}
        </p>
      </main>
    </template>
  </NuxtErrorBoundary>
</template>
