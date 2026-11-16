<script setup lang="ts">
// 錯誤的圖示（Lucide 的 circle-alert，《03》§3）。
//
// 用形狀區分錯誤，不只靠顏色（2026-11-16）：綠底上能當文字用的 coral 幾乎是白色，
// 聚焦和錯誤分不出來。三個地方用：有框輸入框的右側、錯誤訊息前面、表單裡出錯那一列的標籤右邊。
// 顏色跟著文字（currentColor），外面決定是不是 --danger。
withDefaults(defineProps<{ size?: number }>(), { size: 16 })
</script>

<template>
  <svg
    :width="size" :height="size" viewBox="0 0 24 24" aria-hidden="true" class="shrink-0"
    fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M12 8v4" />
    <path d="M12 16h.01" />
  </svg>
</template>
