<script setup lang="ts">
// 顯示用的星等（紀錄詳情、分享頁、總覽的最高分）。不能點，表單裡可以點的是 StarRating。
//
// 和表單同一套外觀（2026-11-16，Laeta 改版第三批）：**未選也是實心**，顏色 --control-inactive；
// 已選是 --favorite。描邊和填色同色，只用來把星角補圓；線寬換算後固定是 1.5px。

const props = withDefaults(defineProps<{ rating: number, size?: number }>(), { size: 20 })

const strokeWidth = computed(() => (1.5 * 24) / props.size)
</script>

<template>
  <span class="flex" role="img" :aria-label="`評分 ${rating} 顆星`">
    <svg
      v-for="level in 5" :key="level"
      :width="size" :height="size" viewBox="0 0 24 24" aria-hidden="true"
      :stroke-width="strokeWidth" stroke-linecap="round" stroke-linejoin="round"
      :fill="rating >= level ? 'var(--favorite)' : 'var(--control-inactive)'"
      :stroke="rating >= level ? 'var(--favorite)' : 'var(--control-inactive)'"
    >
      <path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" />
    </svg>
  </span>
</template>
