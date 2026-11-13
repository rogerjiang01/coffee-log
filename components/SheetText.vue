<script setup lang="ts">
// 表單列裡的單行文字輸入（《03》§4.1）：靠右、沒有框。
//
// **沒在輸入時，值最多顯示兩行，超過省略**（長豆名）；輸入時是一般的單行輸入框，
// 整串都可以左右捲動著改。兩者疊在同一格：
//   - 顯示用的那一層撐出高度（一行或兩行）
//   - <input> 一直都在、佔滿整格，所以點哪裡都能開始輸入；
//     沒在輸入而且有值時只是把它的文字藏起來，讓底下那一層顯示
// 用 <input> 而不是 textarea：要支援 datalist（產區的建議），也不必處理換行。

defineOptions({ inheritAttrs: false })

const model = defineModel<string | null>({ default: '' })
const focused = ref(false)
const hasValue = computed(() => !!model.value)
</script>

<template>
  <span class="sheet-text">
    <!-- 兩層：外層是上下的留白，內層做兩行省略。省略寫在有留白的那一層上，第三行會從留白露出來 -->
    <span v-if="hasValue && !focused" class="sheet-text__display" aria-hidden="true"><span class="sheet-clamp">{{ model }}</span></span>
    <input
      v-bind="$attrs"
      v-model="model"
      type="text"
      class="sheet-input sheet-text__input"
      :class="hasValue && !focused ? 'sheet-text__input--hidden' : ''"
      @focus="focused = true"
      @blur="focused = false"
    >
  </span>
</template>

<style scoped>
.sheet-text {
  display: grid;
  flex: 1;
  min-width: 0;
  align-items: center;
}
.sheet-text > * {
  grid-area: 1 / 1;
}
.sheet-text__display {
  padding: 0.5625rem 0;
  text-align: right;
  pointer-events: none;
}
.sheet-text__input {
  height: 100%;
}
.sheet-text__input--hidden {
  color: transparent;
}
</style>
