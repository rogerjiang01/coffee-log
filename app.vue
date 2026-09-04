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
  <NuxtPage />
</template>
