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
// 圓角是膠囊形（2026-11-17）。可收合的卡片收合時是單列、傳 true，展開後傳 false。
// **圓角是那一列基本高度的一半**（2026-11-23，列高兩級）：56 的列 28px（--radius-pill）；
// 那一列裡面有膠囊（65 的列，FormRow 的 tall）時一起傳 tall，32.5px（--radius-pill-tall）。
// 卡片長高時（心得筆記打成好幾行）圓角不變。一般的圓角是 --radius-lg。
//
// 綠底模式（登入、註冊，html.theme-green）不畫外框，照 Figma 的新版登入頁（2026-11-23）；淺色的表單維持外框。

defineProps<{ pill?: boolean, tall?: boolean }>()

const footer = ref<HTMLElement | null>(null)
provide(FORM_CARD_FOOTER, footer)
</script>

<template>
  <div>
    <!-- 外框畫在內側，不另外佔高度：單列卡片的高度就是那一列的高度（56 或 65），膠囊形的兩端剛好是半圓 -->
    <AppCard :radius="pill ? (tall ? 'pill-tall' : 'pill') : 'lg'" border-inside class="form-card overflow-hidden">
      <slot />
    </AppCard>
    <div ref="footer" class="form-card-footer" />
  </div>
</template>

<style scoped>
/* 綠底模式（登入、註冊）不畫外框，照 Figma 的新版登入頁（2026-11-23）。淺色的表單維持外框 */
:global(.theme-green) .form-card {
  --card-border: transparent;
}
</style>
