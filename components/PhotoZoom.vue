<script setup lang="ts">
// 可以點開放大的豆袋照片縮圖（分享頁與紀錄詳情頁，《03》§4.13.4、§4.14）。
//
// 縮圖是按鈕，點下去全螢幕顯示照片：完整顯示、不裁切，背後是 --media-scrim。
// 點任何地方、Esc、返回鍵都能關閉。沿用原生 <dialog> 的 showModal()（焦點鎖定、
// 背景 inert、Esc）與 useOverlayHistory（佔一筆 history，返回鍵只關浮層）。
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
const dialog = ref<HTMLDialogElement | null>(null)
const image = ref<HTMLImageElement | null>(null)

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

function close() {
  open.value = false
}

useOverlayHistory(() => open.value, close)

watch(open, (value) => {
  if (!dialog.value) return
  if (value && !dialog.value.open) {
    dialog.value.showModal()
    // 裡面沒有可以聚焦的東西，showModal() 會把焦點放在 dialog 本身。
    // 改放在照片上：螢幕閱讀器直接讀到豆名，不畫焦點框（它不是互動元素）
    image.value?.focus()
  }
  if (!value && dialog.value.open) dialog.value.close()
})
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

    <!-- 全螢幕：四周留白與頁面邊距相同（20px），並避開 iPhone 的安全區域。
         照片以 object-contain 完整顯示。點到哪裡都關（包括照片本身）：這裡沒有別的動作 -->
    <dialog
      ref="dialog"
      class="photo-zoom backdrop:bg-[var(--media-scrim)]"
      aria-label="豆袋照片"
      @cancel.prevent="close"
      @click="close"
    >
      <img
        v-if="zoomed"
        ref="image"
        :src="zoomed"
        :alt="alt"
        tabindex="-1"
        class="size-full object-contain outline-none"
      >
    </dialog>
  </template>
</template>

<style scoped>
/* 全站 dialog 的留白是 1.25rem（main.css）；這裡另外疊上安全區域，取兩者較大的一邊 */
.photo-zoom:modal {
  padding:
    max(1.25rem, env(safe-area-inset-top))
    max(1.25rem, env(safe-area-inset-right))
    max(1.25rem, env(safe-area-inset-bottom))
    max(1.25rem, env(safe-area-inset-left));
}
</style>
