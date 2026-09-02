<script setup lang="ts">
// 器材類型的簡單識別圖示。單一線條風格，不混用多套。
defineProps<{ type: EquipmentType }>()
</script>

<template>
  <svg
    width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"
    class="shrink-0"
    :style="{ color: 'var(--text-muted)' }"
    fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
  >
    <!-- 磨豆機：漏斗加機身 -->
    <template v-if="type === 'grinder'">
      <path d="M6 4h12l-3 6H9z" />
      <path d="M9 10v4a3 3 0 003 3 3 3 0 003-3v-4" />
      <path d="M8 20h8" />
    </template>
    <!-- 濾杯：錐形 -->
    <template v-else-if="type === 'dripper'">
      <path d="M4 6h16l-6 9h-4z" />
      <path d="M10 15v4h4v-4" />
    </template>
    <!-- 濾紙：折角的紙 -->
    <template v-else-if="type === 'filter'">
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v4h4" />
    </template>
    <!-- 手沖壺：壺身加細嘴 -->
    <template v-else-if="type === 'kettle'">
      <path d="M7 9h9v8a3 3 0 01-3 3h-3a3 3 0 01-3-3z" />
      <path d="M16 11c3 0 4-3 4-5" />
      <path d="M9 9V7a2 2 0 012-2h1" />
    </template>
    <!-- 分享壺：玻璃壺 -->
    <template v-else>
      <path d="M9 3h6v4l3 6v6a2 2 0 01-2 2H8a2 2 0 01-2-2v-6l3-6z" />
      <path d="M6.5 13h11" />
    </template>
  </svg>
</template>
