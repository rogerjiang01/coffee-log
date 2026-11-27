<script setup lang="ts">
// 可以點開放大的豆袋照片縮圖（分享頁與紀錄詳情頁，《03》§4.13.4、§4.14）。
//
// 縮圖是按鈕，點下去全螢幕顯示照片。放大檢視本身是 PhotoViewer（主圖 BrewHero 也用它，2026-11-27）：
// 完整顯示、不裁切，背後是 --media-scrim；點任何地方、Esc、返回鍵都能關閉。
//
// **縮圖與原圖分開**（utils/beanPhoto.ts）：
//   thumb 還是 null   位置先留好（64×64 的淡色塊），版面不跳動；按鈕還不能按
//   縮圖載入完成      在背景預先載入原圖
//   點開時原圖還沒到  先顯示放大的縮圖，原圖到了再換上
// 縮圖載入失敗就整個不出現，不留破圖。原圖載入失敗就一直顯示縮圖。

const props = defineProps<{
  /** 縮圖網址。還在要的時候是 null */
  thumb: string | null
  /** 原圖網址，只用在放大檢視 */
  full: string | null
  /** 放大後照片的替代文字：豆名 */
  alt: string
}>()

const open = ref(false)
const failed = ref(false)
const thumbReady = ref(false)
const fullReady = ref(false)

watch(() => props.thumb, () => {
  failed.value = false
  thumbReady.value = false
})

// 縮圖顯示之後才開始載原圖：原圖不能跟縮圖搶頻寬
let preloading: HTMLImageElement | null = null
watch([thumbReady, () => props.full], ([ready, full]) => {
  fullReady.value = false
  if (preloading) preloading.onload = null
  preloading = null
  if (!ready || !full) return
  const loader = new Image()
  loader.onload = () => {
    if (preloading === loader) fullReady.value = true
  }
  loader.src = full
  preloading = loader
})
onBeforeUnmount(() => {
  if (preloading) preloading.onload = null
})

const zoomed = computed(() => (fullReady.value && props.full ? props.full : props.thumb))
</script>

<template>
  <template v-if="!failed">
    <!-- 縮圖：64×64、--radius-md，與分享對話框的縮圖同一個圓角（《03》§4.13.2）。
         縮圖還沒到時底色是骨架的 --border，按鈕還不能按。
         按鈕的名稱說動作；縮圖本身的替代文字留空，不重複唸 -->
    <button
      type="button"
      class="block size-16 shrink-0 overflow-hidden rounded-md"
      :style="{ background: 'var(--border)' }"
      aria-label="放大豆袋照片"
      :disabled="!thumbReady"
      @click="open = true"
    >
      <img
        v-if="thumb"
        :src="thumb"
        alt=""
        class="size-full object-cover"
        @load="thumbReady = true"
        @error="failed = true"
      >
    </button>

    <PhotoViewer v-model:open="open" :src="zoomed" :alt="alt" />
  </template>
</template>
