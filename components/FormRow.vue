<script setup lang="ts">
// 分組卡片內的一列（Figma 的 Sheet Row，《03》§4.1）。
//
// **標籤在左、值在右**，列與列之間一條分隔線，最後一列不畫（避免和卡片外框貼在一起）。
// 標籤不縮、不截斷；值太長時讓的是值。
//
// 兩種用法：
//   - 給 label：這一列自己排標籤，預設 slot 是右側的控制項
//   - 不給 label：整列交給 slot。自帶標籤的元件（下拉、器材欄位、星等）
//     與不是單一欄位的區塊（強度、收合區）用這種
//
// 這一列的提示、錯誤與衍生值不放在列裡：用 FormNote，它會顯示在卡片下方（《03》§4.1）。
// error：這一列有錯誤時，標籤右邊加 circle-alert——訊息在卡片下方，要看得出是哪一列。

defineProps<{
  label?: string
  /** 標籤對應的控制項 id */
  for?: string
  /** 必填的 *。必填欄位只有三個（CLAUDE.md 硬性規則 7） */
  required?: boolean
  /** 不要左右內距：內容自己帶（強度選擇器） */
  flush?: boolean
  error?: boolean
}>()
</script>

<template>
  <div class="form-row" :class="flush ? '' : 'card-pad-x'">
    <div v-if="label" class="sheet-row">
      <label class="sheet-label" :for="$props.for">
        {{ label }}<template v-if="required"><span :style="{ color: 'var(--danger)' }" aria-hidden="true">*</span><span class="sr-only">必填</span></template>
        <AlertIcon v-if="error" class="sheet-label-alert" />
      </label>
      <div class="sheet-value">
        <slot />
      </div>
    </div>
    <slot v-else />
  </div>
</template>

<style scoped>
.form-row:not(:last-child) {
  border-bottom: 1px solid var(--border);
}
</style>
