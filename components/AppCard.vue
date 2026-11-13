<script setup lang="ts">
// 卡片（《03》§4.19，Figma 的 Card）。
//
// 標題列在上、內容在下，一般的上下排列。Figma 把標題列疊在內容區上面（絕對定位），
// 程式不照抄：疊上去的話內容要自己留出標題的高度，標題換行就會蓋到內容。
//
// 圓角兩種：md（12px，總覽這類獨立的卡片）、lg（24px，表單的卡片容器）。
// 陰影是 --shadow-light：卡片底色和頁面底色幾乎一樣，靠它分層（《03》§2.3）。

withDefaults(defineProps<{
  title?: string
  /** 標題列右端的 ›。只在整張卡片可點、而且規格指定要放的時候用（《03》§1） */
  arrow?: boolean
  radius?: 'md' | 'lg'
}>(), { radius: 'md' })
</script>

<template>
  <div
    class="app-card border"
    :class="radius === 'lg' ? 'rounded-lg' : 'rounded-md'"
    :style="{ borderColor: 'var(--border)', background: 'var(--surface)', boxShadow: 'var(--shadow-light)' }"
  >
    <div v-if="title" class="flex items-center justify-between gap-2 px-3 pt-2">
      <p class="min-w-0 text-body-m font-medium">{{ title }}</p>
      <svg
        v-if="arrow"
        width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" class="shrink-0"
        fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"
        :style="{ color: 'var(--icon-muted)' }"
      >
        <path d="m9 18 6-6-6-6" />
      </svg>
    </div>
    <slot />
  </div>
</template>
