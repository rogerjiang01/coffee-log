<script setup lang="ts">
// 「範例」標籤（《01》§13、《03》§4.12）。
//
// 樣式與器材列表的「常用」標籤相同（pages/equipment/index.vue）：
// 同一種東西——不可點的狀態標記，所以不另立一套外觀，也不新增顏色。
//
// 它只說明這筆資料的來源，不影響任何動作：範例可以照常編輯、刪除、複製。
</script>

<template>
  <span
    class="shrink-0 rounded-sm px-2 py-0.5 text-xs"
    :style="{ background: 'var(--accent-wash)', color: 'var(--on-accent-wash)' }"
  >範例</span>
</template>
