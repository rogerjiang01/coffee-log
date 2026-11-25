<script setup lang="ts">
// 唯讀卡片裡的一列（紀錄詳情、分享頁共用；《03》§4.13.4、§4.22）。
//
// 外觀是表單的 Sheet Row（FormRow）：標籤在左（.sheet-label）、值在右（.sheet-value），列高 --sheet-row-h，
// 列與列之間一條分隔線、最後一列不畫。**但它不是控制項**：沒有箭頭、hover、pointer、按下狀態，
// 也沒有 <label>——標籤與值是 <dt>／<dd>，所以要放在 <dl> 裡（BrewReadonlySections 的每一張卡片）。
//
// 值太長時讓的是值（換行），標籤不縮。單位直接接在數值後面（「15 g」），所有值對齊卡片右緣。
//
// tall：裡面有膠囊的列（風味的唯讀標籤），65px（--sheet-row-h-tall），和表單的規則相同。
// start：值靠左排、標籤對齊第一行（心得：一段文字，不是一個值）。
// labelHidden：標籤只給眼睛看，值自己帶了完整的無障礙名稱（強度：「酸質 3 / 5」），不重複唸一次標籤。

defineProps<{
  label: string
  tall?: boolean
  start?: boolean
  labelHidden?: boolean
}>()
</script>

<template>
  <!-- dt／dd 要是 <dl> 裡那個 div 的直接子項（HTML 的內容模型），所以列本身就是 .sheet-row，不再多包一層 -->
  <div class="readonly-row sheet-row card-pad-x" :class="{ 'sheet-row--tall': tall, 'readonly-row--start': start }">
    <dt class="sheet-label" :aria-hidden="labelHidden ? 'true' : undefined">{{ label }}</dt>
    <dd class="sheet-value tabular-nums"><slot /></dd>
  </div>
</template>

<style scoped>
/* 分隔線和 FormRow 同一種畫法：畫在列裡（inset 陰影），不另外佔 1px；最後一列不畫 */
.readonly-row:not(:last-child) {
  box-shadow: inset 0 -1px 0 var(--border);
}
/* 值換成兩行時靠右對齊（.sheet-value 是 flex，文字是它的匿名子項，對齊跟著這裡） */
.readonly-row .sheet-value {
  text-align: right;
}
/* 心得：值靠左、保留換行；標籤對齊第一行。上下內距讓單行時和一般列一樣置中在 56px 裡 */
.readonly-row--start {
  align-items: flex-start;
  padding-block: calc((var(--sheet-row-h) - var(--text-heading-m) * var(--text-heading-m--line-height)) / 2);
}
.readonly-row--start .sheet-value {
  justify-content: flex-start;
  text-align: left;
  white-space: pre-line;
}
</style>
