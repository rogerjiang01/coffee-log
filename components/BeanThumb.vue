<script setup lang="ts">
// 豆子的正方形縮圖：總覽的「上一杯」與結算頁的摘要（《03》§4.5）。
// 有照片時用縮圖檔（長邊 384px，《01》§7.1）；沒有照片時是烘焙度底色加咖啡豆插畫（BeanArt）。

const props = defineProps<{
  photoUrl: string | null
  roastLevel: RoastLevel | null
  alt: string
}>()

const fill = computed(() => roastFill(props.roastLevel))
</script>

<template>
  <img v-if="photoUrl" :src="photoUrl" :alt="alt" class="block aspect-square w-full object-cover">
  <BeanArt v-else :background="fill.background" />
</template>
