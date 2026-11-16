<script setup lang="ts">
// 指標數字加單位（Figma 的 Display S ＋ Metric Unit）：總覽的累計與本月。
// 數字與單位底線對齊，顏色 --accent-text。
defineProps<{ value: number | string, unit: string }>()
</script>

<template>
  <span class="flex items-end gap-1 whitespace-nowrap tabular-nums" :style="{ color: 'var(--accent-text)' }">
    <span class="text-display-s">{{ value }}</span>
    <span class="text-metric-unit">{{ unit }}</span>
  </span>
</template>
