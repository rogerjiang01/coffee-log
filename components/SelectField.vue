<script setup lang="ts">
// 原生 <select> 的外觀包裝。
//
// 為什麼需要它：.field 設了 border: 0 加底線，但沒有重設 appearance 時，
// 瀏覽器仍會用作業系統的樣式畫 select，包括一圈深色外框——那個顏色
// 不在 token 系統內，也蓋不掉。重設 appearance 之後原生的下拉箭頭
// 也會消失，所以在這裡自己補一個，顏色一樣走 token。

defineProps<{ filled?: boolean }>()
</script>

<template>
  <div class="relative">
    <slot />
    <svg
      width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"
      class="pointer-events-none absolute top-1/2 right-0 -translate-y-1/2"
      :style="{ color: 'var(--text-muted)' }"
    >
      <path d="M3 6l5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.5" />
    </svg>
  </div>
</template>
