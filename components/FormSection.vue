<script setup lang="ts">
// 表單的一個區塊：標題加上一張或多張卡片（Figma 的記錄表單，《03》§4.19）。
//
// 間距兩層：區塊內（標題到第一張卡片、卡片與卡片之間）是 --gap-group（20px），
// 區塊與區塊之間是 --gap-section（30px，由表單的容器排）。
// 標題是 Heading L 的 Medium（20px、字重 500，Figma 的 Chinese-Medium/Heading L，2026-11-24；原本 24px），
// 左側和卡片內的列文字對齊（--card-pad）。頁面標題（「新增紀錄」）不在這裡，不受影響。

defineProps<{ title?: string }>()
</script>

<template>
  <section class="flex flex-col" :style="{ gap: 'var(--gap-group)' }">
    <h2 v-if="title" class="card-pad-x text-heading-l font-medium">{{ title }}</h2>
    <slot />
  </section>
</template>
