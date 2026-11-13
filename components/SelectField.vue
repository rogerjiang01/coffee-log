<script setup lang="ts">
// 原生 <select> 的外觀包裝（表單列右側的膠囊，《03》§4.1）。
//
// 原生 select 不重設 appearance 的話，瀏覽器會用作業系統的樣式畫它，包括一圈深色外框——
// 那個顏色不在 token 系統內也蓋不掉。裡面的 <select> 掛 .sheet-pill（main.css），
// 還沒選值時加 data-empty：不畫膠囊，「選填」直接寫在卡片底色上。
//
// 這一層是 44px 高的 label：膠囊本身只有 34px，點到上下的空白也會聚焦到 select（《03》§7）。
// 沒有下拉箭頭：照 Figma，膠囊本身就是「這裡可以選」的線索。
</script>

<template>
  <label class="flex min-w-0 items-center justify-end" :style="{ minHeight: 'var(--touch-min)' }">
    <slot />
  </label>
</template>
