<script setup lang="ts">
// 左上角的 ‹（《03》§3）。icon 封閉清單的三個之一：關閉 ×、返回 ‹、設定齒輪。
//
// 同一個圖示在兩種畫面裡：檢視型叫「返回」（回上一層），流程型叫「離開」
// （離開這個流程，暫存保留）。兩者都不丟東西——會丟東西的動作一律用
// 「取消」文字，不用圖示（《04》）。

defineProps<{
  to: string
  label: '返回' | '離開'
}>()
</script>

<template>
  <!-- 44px 觸控目標；負邊距讓圖示本身對齊頁面內距，而不是整個觸控區 -->
  <NuxtLink
    :to="to"
    :aria-label="label"
    class="-ml-3 flex shrink-0 items-center justify-center"
    :style="{ minWidth: 'var(--touch-min)', minHeight: 'var(--touch-min)' }"
  >
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M12 4l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
    </svg>
  </NuxtLink>
</template>
