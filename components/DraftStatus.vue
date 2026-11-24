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
//
// 置左不置中：它是狀態資訊不是主要內容，置中會讓它看起來像一個獨立的區塊。

defineProps<{ status: DraftSaveStatus }>()
</script>

<template>
  <p
    v-if="status"
    class="flex items-center gap-1 text-sm"
    :style="{ color: 'var(--text-muted)' }"
  >
    <!-- 暫存中：兩支箭頭繞成一圈（Lucide 的 refresh-cw）。2026-11-13 從自繪換成 Lucide，
         同一個元件裡的打勾早就是 Lucide 了 -->
    <svg
      v-if="status === 'saving'"
      width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </svg>
    <!-- 已暫存：細線打勾，不加實心圓底——那太像完成的慶祝符號 -->
    <svg
      v-else
      width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
    {{ status === 'saving' ? '暫存中' : '已暫存' }}
  </p>
</template>
