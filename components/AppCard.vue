<script setup lang="ts">
// 卡片（《03》§4.19，Figma 的 Card）。
//
// 標題列在上、內容在下，一般的上下排列。Figma 把標題列疊在內容區上面（絕對定位），
// 程式不照抄：疊上去的話內容要自己留出標題的高度，標題換行就會蓋到內容。
//
// 圓角三種：md（12px，總覽這類獨立的卡片）、lg（24px，表單的卡片容器）、
// pill（--radius-pill，只有一列的表單卡片，2026-11-17）。pill 是單列高度的一半，不是 9999px：
// 那張卡片長高時（心得筆記打成好幾行）圓角不變，不會變成兩端全圓。pill 另外加 corner-shape（.pill-corner，漸進增強）。
// 陰影是 --shadow-light：卡片底色和頁面底色幾乎一樣，靠它分層（《03》§2.3）。
//
// borderInside：外框畫在內側（inset 陰影），不另外佔高度——Figma 的外框是內側的，表單的卡片因此是
// 列高的整數倍（一列 65、兩列 130），膠囊形的半徑剛好是高度的一半（FormCard 用，2026-11-17）。
//
// as：整張卡片可以點的時候，卡片本身就是那個連結或按鈕（不在外面再包一層——
// button 裡面不能放 div）。傳 'button'、'section'，或 NuxtLink 元件。

import type { Component } from 'vue'

withDefaults(defineProps<{
  title?: string
  /** 標題列右端的 ›。只在整張卡片可點、而且規格指定要放的時候用（《03》§1） */
  arrow?: boolean
  radius?: 'md' | 'lg' | 'pill'
  as?: string | Component
  borderInside?: boolean
}>(), { radius: 'md', as: 'div', borderInside: false })
</script>

<template>
  <component
    :is="as"
    class="app-card"
    :class="[radius === 'lg' ? 'rounded-lg' : radius === 'md' ? 'rounded-md' : 'pill-corner', borderInside ? '' : 'border']"
    :style="{
      borderColor: 'var(--border)',
      background: 'var(--surface)',
      boxShadow: borderInside ? 'inset 0 0 0 1px var(--border), var(--shadow-light)' : 'var(--shadow-light)',
      borderRadius: radius === 'pill' ? 'var(--radius-pill)' : undefined,
    }"
  >
    <span v-if="title" class="flex items-center justify-between gap-2 px-3 pt-2">
      <!-- span 加 role：卡片是 button 或連結時，裡面只能放行內元素 -->
      <span role="heading" aria-level="2" class="min-w-0 text-heading-s font-medium">{{ title }}</span>
      <svg
        v-if="arrow"
        width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" class="shrink-0"
        fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"
        :style="{ color: 'var(--icon-muted)' }"
      >
        <path d="m9 18 6-6-6-6" />
      </svg>
    </span>
    <slot />
  </component>
</template>
