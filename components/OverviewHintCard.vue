<script setup lang="ts">
// 總覽空狀態方案 B 的說明卡：卡片還沒有資料時，位置留著，寫它之後會顯示什麼。
// 不放數字、不能點，所以沒有 ›。**方案 B 沒被選上的話，這個元件一起刪掉。**

defineProps<{ title: string, text: string }>()
</script>

<template>
  <AppCard :title="title" class="flex aspect-square flex-col">
    <span class="px-3 pt-0.5 pb-2 text-sm text-muted">{{ text }}</span>
  </AppCard>
</template>
