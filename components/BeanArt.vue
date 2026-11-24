<script setup lang="ts">
// 沒有豆袋照片時的縮圖（《03》§4.5，Figma 的「coffee bean image 2」）。
//
// 底色是烘焙度（沒填用 --roast-unknown），上面三顆咖啡豆的插畫。
// 插畫的顏色是 --roast-art：Figma 的圖檔寫死了一個接近白的顏色，這裡把圖檔當遮罩、
// 顏色由 token 填，所以圖檔本身不必改（public/illustrations/bean-*.svg，從 Figma 匯出）。
//
// 三顆豆子在 Figma 都是 40×40（縮圖 64×64 的 62.5%），位置與角度照 Figma 換算成百分比，
// 任何尺寸的正方形都是同一個構圖。超出縮圖的部分由外層裁掉。

defineProps<{ background: string }>()
</script>

<template>
  <div class="bean-art" :style="{ background }" aria-hidden="true">
    <span class="bean-art__bean bean-art__bean--a" />
    <span class="bean-art__bean bean-art__bean--b" />
    <span class="bean-art__bean bean-art__bean--c" />
  </div>
</template>

<style scoped>
.bean-art {
  position: relative;
  overflow: hidden;
  width: 100%;
  aspect-ratio: 1;
}
.bean-art__bean {
  position: absolute;
  width: 62.5%;
  height: 62.5%;
  background: var(--roast-art);
  mask-size: 100% 100%;
  mask-repeat: no-repeat;
  -webkit-mask-size: 100% 100%;
  -webkit-mask-repeat: no-repeat;
}
.bean-art__bean--a {
  left: -4.69%;
  top: 4.69%;
  mask-image: url("/illustrations/bean-a.svg");
  -webkit-mask-image: url("/illustrations/bean-a.svg");
}
.bean-art__bean--b {
  left: 62.5%;
  top: -4.69%;
  rotate: 53.16deg;
  mask-image: url("/illustrations/bean-b.svg");
  -webkit-mask-image: url("/illustrations/bean-b.svg");
}
.bean-art__bean--c {
  left: 37.43%;
  top: 60.87%;
  rotate: 12.89deg;
  mask-image: url("/illustrations/bean-c.svg");
  -webkit-mask-image: url("/illustrations/bean-c.svg");
}
</style>
