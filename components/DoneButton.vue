<script setup lang="ts">
// 「完成」：右上角 44px 的 --accent 圓形按鈕，中間是 --on-accent 的勾勾（《03》§3 圖示表的「完成」）。
// 結算頁與分段子頁共用。
// floating：結算頁右上角、浮在主圖與內容上的那一顆，加陰影 --shadow-light（和分享鈕、頁首的圓鈕同一個，也是卡片的那一個；2026-11-27 第二版，原本是 --float-shadow）。
// 分段子頁的在標題列裡，不浮，不加。
//
// **名稱是「完成」，不是「儲存」**：它不寫資料庫。分段子頁上按它只是回到表單，改動要等表單的「儲存」才寫進去；
// 叫「儲存」會讓人以為已經存好，就直接離開表單（2026-11-17）。

defineProps<{ floating?: boolean }>()
const emit = defineEmits<{ click: [] }>()
</script>

<template>
  <button
    type="button"
    aria-label="完成"
    class="flex shrink-0 items-center justify-center rounded-full"
    :style="{ width: 'var(--touch-min)', height: 'var(--touch-min)', background: 'var(--accent)', color: 'var(--on-accent)', boxShadow: floating ? 'var(--shadow-light)' : undefined }"
    @click="emit('click')"
  >
    <svg
      width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2.18" stroke-linecap="round" stroke-linejoin="round"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  </button>
</template>
