<script setup lang="ts">
// 暫存狀態指示，放在儲存按鈕下方（《03》§4.11）。
//
// 放底部不放頂部：這個表單有儲存按鈕，使用者擔心「我填的東西安全嗎」是在
// 按儲存之前那一刻，視線在底部。頂部的指示他看不到。
//
// 用「暫存」不用「儲存」：暫存是這台裝置上的草稿，儲存是寫進資料庫。
// 混用會讓人以為已經存好了。
//
// 不做旋轉動畫：寫入只等半秒，轉半圈沒人看得清楚（《03》§6）。
// 圖示與文字的切換就是全部的回饋。
//
// 不設 aria-live：持續輸入時每停半秒就會唸一次，對螢幕閱讀器使用者是噪音。

defineProps<{ status: DraftSaveStatus }>()
</script>

<template>
  <p
    v-if="status"
    class="flex items-center justify-center gap-1 text-xs"
    :style="{ color: 'var(--text-muted)' }"
  >
    <!-- 暫存中：雙箭頭圍圈（sync） -->
    <svg
      v-if="status === 'saving'"
      width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M20 12a8 8 0 0 1-13.66 5.66" />
      <path d="M4 12a8 8 0 0 1 13.66-5.66" />
      <path d="M18 3v4h-4" />
      <path d="M6 21v-4h4" />
    </svg>
    <!-- 已暫存：細線打勾，不加實心圓底——那太像完成的慶祝符號 -->
    <svg
      v-else
      width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
    {{ status === 'saving' ? '暫存中' : '已暫存' }}
  </p>
</template>
