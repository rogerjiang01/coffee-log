<script setup lang="ts">
// 可以點開放大的照片縮圖（分享頁的豆袋照片，《03》§4.13.4）。
//
// 縮圖是按鈕，點下去全螢幕顯示同一張照片：完整顯示、不裁切，背後是遮罩。
// 點任何地方、Esc、返回鍵都能關閉。沿用原生 <dialog> 的 showModal()（焦點鎖定、
// 背景 inert、Esc）與 useOverlayHistory（佔一筆 history，返回鍵只關浮層）。
//
// 放大用的是縮圖已經載入的同一個網址，瀏覽器不會再讀一次。
// 縮圖載入失敗（網址過期、照片被換掉）就整個不出現，不留破圖。

const props = defineProps<{
  src: string
  /** 放大後照片的替代文字：豆名 */
  alt: string
}>()

const open = ref(false)
const failed = ref(false)
const dialog = ref<HTMLDialogElement | null>(null)
const image = ref<HTMLImageElement | null>(null)

watch(() => props.src, () => {
  failed.value = false
})

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
         按鈕的名稱說動作；縮圖本身的替代文字留空，不重複唸 -->
    <button
      type="button"
      class="block size-16 shrink-0 overflow-hidden rounded-md"
      aria-label="放大豆袋照片"
      @click="open = true"
    >
      <img :src="src" alt="" class="size-full object-cover" @error="failed = true">
    </button>

    <!-- 全螢幕：鋪滿視窗、不留邊，照片以 object-contain 完整顯示。
         點到哪裡都關（包括照片本身）：這裡沒有任何別的動作可以做 -->
    <dialog
      ref="dialog"
      class="p-0 backdrop:bg-[var(--overlay-scrim)]"
      aria-label="豆袋照片"
      @cancel.prevent="close"
      @click="close"
    >
      <img
        ref="image"
        :src="src"
        :alt="alt"
        tabindex="-1"
        class="size-full object-contain outline-none"
      >
    </dialog>
  </template>
</template>
