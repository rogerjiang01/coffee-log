<script setup lang="ts">
// 分組卡片：表單的卡片容器（《03》§4.19）。裡面是一列一列的 FormRow，
// 列與列之間的分隔線由 FormRow 畫，左右內距也由 FormRow 提供（--card-pad）。
//
// **卡片下方的小字（footer）**：說明、提示、錯誤、衍生值都不放進卡片，放在卡片外面的下方，
// 緊貼卡片、左側和列文字對齊（iOS inset grouped 列表的慣例，2026-11-16）。
// 卡片裡的 FormNote 會自己傳送到這裡，所以訊息仍然寫在它的欄位旁邊。
//
// 區塊標題不在這裡：一個區塊有好幾張卡片，標題由 FormSection 畫。

const footer = ref<HTMLElement | null>(null)
provide(FORM_CARD_FOOTER, footer)
</script>

<template>
  <div>
    <AppCard radius="lg" class="overflow-hidden">
      <slot />
    </AppCard>
    <div ref="footer" class="form-card-footer" />
  </div>
</template>
