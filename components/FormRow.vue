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
//
// **列高兩級**（2026-11-23，《03》§4.1）：預設 56px（--sheet-row-h）；**裡面有膠囊的列傳 tall**（65px，--sheet-row-h-tall）——
// 原生的 select、日期、時刻（SelectField）與沖煮時間的分秒框。自帶標籤的下拉（BeanSelect、EquipmentTrigger……）
// 不經過這裡的 label，自己掛 .sheet-row--tall。高度看列的種類，不看有沒有選值：沒選時沒有膠囊，列高也不變。

defineProps<{
  label?: string
  /** 標籤對應的控制項 id */
  for?: string
  /** 必填的 *。必填欄位只有三個（CLAUDE.md 硬性規則 7） */
  required?: boolean
  /** 不要左右內距：內容自己帶（強度選擇器） */
  flush?: boolean
  error?: boolean
  /** 裡面有膠囊的列：65px（--sheet-row-h-tall）。只對 label 模式有效 */
  tall?: boolean
}>()
</script>

<template>
  <div class="form-row" :class="flush ? '' : 'card-pad-x'">
    <div v-if="label" class="sheet-row" :class="tall ? 'sheet-row--tall' : ''">
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
/* 分隔線畫在列裡（inset 陰影），不另外佔 1px：單行的列含分隔線是 56px（--sheet-row-h）或 65px（--sheet-row-h-tall），
   最後一列沒有分隔線也一樣高（2026-11-17，照 Figma 的 Sheet Row；兩級是 2026-11-23） */
.form-row:not(:last-child) {
  box-shadow: inset 0 -1px 0 var(--border);
}
</style>
