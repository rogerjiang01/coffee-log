<script setup lang="ts">
// Laeta 的 logo（Figma 的 Group 12）。圖檔當遮罩、顏色由 token 填（--brand-mark），和咖啡豆插畫同一個做法：
// 圖檔本身不帶顏色，品牌色更換時不必重新輸出。
// 圖檔：public/brand/v1/laeta-logo.svg（250×80.66，從 Figma 匯出）。
</script>

<template>
  <span class="brand-logo" role="img" aria-label="Laeta" />
</template>

<style scoped>
.brand-logo {
  display: block;
  width: 250px;
  max-width: 100%;
  aspect-ratio: 250 / 80.66;
  background: var(--brand-mark);
  mask: url("/brand/v1/laeta-logo.svg") center / contain no-repeat;
  -webkit-mask: url("/brand/v1/laeta-logo.svg") center / contain no-repeat;
}
</style>
