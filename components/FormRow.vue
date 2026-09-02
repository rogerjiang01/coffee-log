<script setup lang="ts">
// 分組卡片內的一列。
//
// 預設**不畫線**——欄位的底線已經是這一列的分隔線了，再畫一條會重複。
// 只有結尾沒有底線的列（收合標題、chip 群組、圓點選擇器）才加 divider，
// 由它自己畫下緣線。最後一列不畫，避免和卡片外框貼在一起。

defineProps<{ divider?: boolean }>()
</script>

<template>
  <div class="form-row px-4 py-3" :class="divider ? 'form-row--divider' : ''">
    <slot />
  </div>
</template>

<style scoped>
.form-row--divider:not(:last-child) {
  border-bottom: 1px solid var(--border);
}
</style>
