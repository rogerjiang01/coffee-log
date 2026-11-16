<script setup lang="ts">
// 表單的一個區塊：標題加上一張或多張卡片（Figma 的記錄表單，《03》§4.19）。
//
// 間距兩層：區塊內（標題到第一張卡片、卡片與卡片之間）是 --gap-group（20px），
// 區塊與區塊之間是 --gap-section（30px，由表單的容器排）。
// 標題 24px、字重 500，左側和卡片內的列文字對齊（--card-pad）。

defineProps<{ title?: string }>()
</script>

<template>
  <section class="flex flex-col" :style="{ gap: 'var(--gap-group)' }">
    <h2 v-if="title" class="card-pad-x text-xl font-medium">{{ title }}</h2>
    <slot />
  </section>
</template>
