<script setup lang="ts">
// 原生 <select> 與日期、時刻輸入的外框（表單列右側，《03》§4.1）。
//
// **給 text 時，看得到的是下拉列的膠囊（SheetPill），原生控制項攤成透明、蓋在上面**（2026-11-17）：
//   - 膠囊的寬度貼合文字。原生 select 的寬度跟著最長的選項走，原生的日期在各瀏覽器寫法、寬度都不同
//   - 沒選值時只寫「選填」、不畫膠囊，和其他下拉列同一個元件、同一種寫法
//   - 點膠囊的任何地方都是點到原生控制項，手機上照樣開系統的選擇器
//   - 聚焦時膠囊的文字換成強調色（和下拉開著同一個狀態）
//   - **焦點框只在鍵盤操作時畫**，畫在膠囊上（main.css 的 .select-field）。手指點的時候不畫：
//     原本 iOS 點了之後「選填」外面會留一圈。不靠原生控制項的 :focus-visible——select 被點到時
//     瀏覽器也可能算它 focus-visible，所以自己分：整份文件最後一次互動是按鍵還是點擊（useInputModality）。
//     點的是列左邊的標籤（label for）也算點擊；用鍵盤聚焦之後再按方向鍵，框照樣在
// 不給 text：原生控制項自己顯示（目前沒有這種用法，留著給不需要膠囊的情況）。
//
// 這一層是 44px 高的 label：膠囊本身只有 34px，點到上下的空白也會聚焦（《03》§7）。
// 沒有下拉箭頭：照 Figma，膠囊本身就是「這裡可以選」的線索。

defineProps<{
  /** 膠囊上的文字（已選的選項名稱、日期，或沒選時的「選填」）。不給時顯示原生控制項 */
  text?: string
  /** 還沒選值：不畫膠囊 */
  empty?: boolean
}>()

const focused = ref(false)
const modality = useInputModality()
const keyboardFocus = computed(() => focused.value && modality.value === 'keyboard')
</script>

<template>
  <label
    class="select-field relative flex min-w-0 items-center justify-end"
    :data-overlay="text !== undefined || undefined"
    :data-keyboard-focus="keyboardFocus || undefined"
    :style="{ minHeight: 'var(--touch-min)' }"
    @focusin="focused = true"
    @focusout="focused = false"
  >
    <SheetPill v-if="text !== undefined" :empty="empty" aria-hidden="true">{{ text }}</SheetPill>
    <slot />
  </label>
</template>
