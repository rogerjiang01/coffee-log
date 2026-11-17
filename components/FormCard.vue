<script setup lang="ts">
// 分組卡片：表單的卡片容器（《03》§4.19）。裡面是一列一列的 FormRow，
// 列與列之間的分隔線由 FormRow 畫，左右內距也由 FormRow 提供（--card-pad）。
//
// **卡片下方的小字（footer）**：說明、提示、錯誤、衍生值都不放進卡片，放在卡片外面的下方，
// 緊貼卡片、左側和列文字對齊（iOS inset grouped 列表的慣例，2026-11-16）。
// 卡片裡的 FormNote 會自己傳送到這裡，所以訊息仍然寫在它的欄位旁邊。
//
// 區塊標題不在這裡：一個區塊有好幾張卡片，標題由 FormSection 畫。
//
// pill：**只有一列**、獨立成一張卡片的（沖煮時間、心得筆記、評分、收藏、設為常用……），
// 圓角是膠囊形（--radius-pill，2026-11-17）。可收合的卡片收合時是單列、傳 true，展開後傳 false。
// 一般的圓角是 --radius-lg。

defineProps<{ pill?: boolean }>()

const footer = ref<HTMLElement | null>(null)
provide(FORM_CARD_FOOTER, footer)
</script>

<template>
  <div>
    <!-- 外框畫在內側：卡片是列高的整數倍，膠囊形的兩端剛好是半圓 -->
    <AppCard :radius="pill ? 'pill' : 'lg'" border-inside class="overflow-hidden">
      <slot />
    </AppCard>
    <div ref="footer" class="form-card-footer" />
  </div>
</template>
