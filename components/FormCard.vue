<script setup lang="ts">
// 分組卡片：表單的卡片容器（《03》§4.19）。裡面是一列一列的 FormRow，
// 列與列之間的分隔線由 FormRow 畫，左右內距也由 FormRow 提供。
//
// 標題放在卡片上方外側，小字、--text-muted。它是標籤不是段落標題，
// 不搶欄位的視覺權重。（Figma 的分區標題比較大，那是第三批調整頁面結構時的事。）

defineProps<{ title?: string }>()
</script>

<template>
  <section>
    <p v-if="title" class="mb-1.5 px-1 text-sm" :style="{ color: 'var(--text-muted)' }">
      {{ title }}
    </p>
    <AppCard radius="lg" class="overflow-hidden">
      <slot />
    </AppCard>
  </section>
</template>
