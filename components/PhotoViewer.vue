<script setup lang="ts">
// 豆袋照片的全螢幕放大檢視（《03》§4.14）。開啟它的按鈕不在這裡，由用的地方放：
//   PhotoZoom  分享頁與紀錄詳情頁的 64×64 縮圖
//   BrewHero   結算頁與豆子詳情頁的主圖（2026-11-27）
//
// 照片完整顯示、不裁切，背後是 --media-scrim。點任何地方、Esc、返回鍵都能關閉。
// 沿用原生 <dialog> 的 showModal()（焦點鎖定、背景 inert、Esc；關閉後焦點回到開啟它的按鈕）
// 與 useOverlayHistory（佔一筆 history，返回鍵只關浮層）。

defineProps<{
  /** 要顯示的照片。PhotoZoom 在原圖還沒到時先給縮圖 */
  src: string | null
  /** 照片的替代文字：豆名 */
  alt: string
}>()

const open = defineModel<boolean>('open', { required: true })

const dialog = ref<HTMLDialogElement | null>(null)
const image = ref<HTMLImageElement | null>(null)

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
      v-if="src"
      ref="image"
      :src="src"
      :alt="alt"
      tabindex="-1"
      class="size-full object-contain outline-none"
    >
  </dialog>
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
