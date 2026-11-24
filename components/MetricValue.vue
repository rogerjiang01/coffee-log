<script setup lang="ts">
// 指標數字加單位（Figma 的 Display M ＋ Metric Unit，2026-11-17 從 Display S 放大）：總覽的累計與本月。
// 數字與單位底線對齊，顏色 --accent-text。
defineProps<{ value: number | string, unit: string }>()
</script>

<template>
  <span class="flex items-end gap-1 whitespace-nowrap tabular-nums" :style="{ color: 'var(--accent-text)' }">
    <span class="text-display-m">{{ value }}</span>
    <span class="text-metric-unit">{{ unit }}</span>
  </span>
</template>
