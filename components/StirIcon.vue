<script setup lang="ts">
// 攪拌標記的圖示。編輯器（可切換的按鈕）與詳情頁（唯讀）共用，
// 兩邊必須是同一個形狀，否則使用者認不出那是同一件事。
//
// 原本標題寫成「第 2 段・攪拌」，文字後綴在 375px 下把標題可用寬
// 壓到 84px。改成只靠圖示表達：編輯器靠按鈕的顏色狀態，詳情頁靠強調色。
//
// label 有值時這個圖示自己就是資訊（唯讀頁），要讓螢幕閱讀器讀得到；
// 沒有值時它只是按鈕裡的裝飾，按鈕自己有 aria-label，圖示要藏起來。
defineProps<{ label?: string }>()
</script>

<template>
  <svg
    width="18" height="18" viewBox="0 0 24 24"
    :aria-hidden="label ? undefined : true"
    :role="label ? 'img' : undefined"
    :aria-label="label"
    fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"
  >
    <path d="M12 3a6 6 0 016 6c0 3.5-3 5-6 5s-6-1.5-6-5" />
    <path d="M12 14v7" />
    <path d="M9 21h6" />
  </svg>
</template>
