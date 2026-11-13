<script setup lang="ts">
// 分組卡片內的一列（Figma 的 Sheet Row，《03》§4.1）。
//
// **標籤在左、值在右**，列與列之間一條分隔線，最後一列不畫（避免和卡片外框貼在一起）。
// 標籤不縮、不截斷；值太長時讓的是值。
//
// 兩種用法：
//   - 給 label：這一列自己排標籤，預設 slot 是右側的控制項
//   - 不給 label：整列交給 slot。自帶標籤的元件（下拉、器材欄位、研磨刻度、星等）
//     與不是單一欄位的區塊（強度、分段注水、收合區）用這種
// below slot 是列下方的提示、錯誤與衍生值，放在分隔線之前。

defineProps<{
  label?: string
  /** 標籤對應的控制項 id */
  for?: string
  /** 必填的 *。必填欄位只有三個（CLAUDE.md 硬性規則 7） */
  required?: boolean
  /** 不要左右內距：內容自己帶（強度選擇器） */
  flush?: boolean
}>()
</script>

<template>
  <div class="form-row" :class="flush ? '' : 'px-4'">
    <div v-if="label" class="sheet-row">
      <label class="sheet-label" :for="$props.for">
        {{ label }}<template v-if="required"><span :style="{ color: 'var(--danger)' }" aria-hidden="true">*</span><span class="sr-only">必填</span></template>
      </label>
      <div class="sheet-value">
        <slot />
      </div>
    </div>
    <slot v-else />
    <div v-if="$slots.below" class="sheet-below">
      <slot name="below" />
    </div>
  </div>
</template>

<style scoped>
.form-row:not(:last-child) {
  border-bottom: 1px solid var(--border);
}
</style>
