<script setup lang="ts">
// 載入中的佔位方塊（《03-介面規範》§9 授權自行決定樣式）。
//
// **刻意不做閃爍動畫。** §6 規定不做進場動畫，而骨架的閃光本質上就是
// 一種進場動畫——它會在每次切換頁面時把注意力拉走。靜態的淡色塊
// 已經足夠傳達「這裡等一下會有東西」。
//
// 用 --border（sand-100）而不是更深的灰：這裡不是內容，不該比真的內容顯眼。

withDefaults(defineProps<{ width?: string; height?: string; radius?: string }>(), {
  width: '100%',
  height: '1rem',
  radius: '2px',
})
</script>

<template>
  <div
    aria-hidden="true"
    :style="{ width, height, borderRadius: radius, background: 'var(--border)' }"
  />
</template>
