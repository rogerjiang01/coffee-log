<script setup lang="ts">
// 兩行的列（2026-11-27，Figma「器材列表（草稿）－分組卡片」3670:1804，《03》§4.24）。
// 器材列表的每一台、豆子列表的每一支（start 放縮圖，Figma 3675:2023，《03》§4.5.2）；
// 之後記錄表單裡的器材選擇器可以共用（這一輪不改選擇器）。
//
// 放在卡片（FormCard 或 AppCard）裡的 <ul>，元件本身是 <li>：列與列之間一條分隔線，最後一列不畫，
// 畫法和 FormRow、ReadonlyRow 相同（inset 陰影，不另外佔 1px）。左右內距是 --card-pad，和段落標題對齊。
//
//   第一行（title）  名稱與標籤：Heading M、--text。名稱太長時截斷成一行（呼叫端給名稱 min-w-0 truncate），標籤 shrink-0 不縮
//   第二行（meta）   附屬資訊：Body M、--text-muted，項目之間 16px，不用中間點（《03》§1）。會變長的項目由呼叫端給 min-w-0 truncate
//   左側（start）    選用：縮圖（豆子列表，64px）。和文字之間 12px，垂直置中
//   右側（end）      預設：有 to 時是 ›（--icon-muted，16px），垂直置中
//
// **高度由內容決定，不套 56／65**：上下內距 --sheet-pad-two-line（14px，照 Figma），
// 兩行時 78px。第二行沒有內容時不留空行。
// 有 start（縮圖）時上下內距是 --sheet-pad-thumb（12px，照 Figma），列高由縮圖決定：64 的縮圖是 88，只有一行字也一樣。
//
// to：整列是連結（NuxtLink）。無障礙名稱由呼叫端給（aria-label，會落在連結上，不在 <li>）。
// 按下時沒有另外的回饋，和其他整張可點的卡片（紀錄卡片、總覽的卡片）一樣；鍵盤焦點框畫在列的內側，
// 不會被卡片的圓角裁掉。

defineOptions({ inheritAttrs: false })
defineProps<{ to?: string }>()

const NuxtLink = resolveComponent('NuxtLink')
</script>

<template>
  <li class="two-line-row">
    <component
      :is="to ? NuxtLink : 'div'" :to="to" class="two-line-row__body card-pad-x"
      :class="{ 'two-line-row__body--thumb': !!$slots.start }" v-bind="$attrs"
    >
      <slot name="start" />
      <span class="two-line-row__text">
        <span class="two-line-row__title"><slot name="title" /></span>
        <span v-if="$slots.meta" class="two-line-row__meta"><slot name="meta" /></span>
      </span>
      <slot name="end">
        <svg
          v-if="to"
          width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" class="shrink-0"
          fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"
          :style="{ color: 'var(--icon-muted)' }"
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
      </slot>
    </component>
  </li>
</template>

<style scoped>
.two-line-row:not(:last-child) {
  box-shadow: inset 0 -1px 0 var(--border);
}
.two-line-row__body {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding-block: var(--sheet-pad-two-line);
}
.two-line-row__body--thumb {
  padding-block: var(--sheet-pad-thumb);
}
/* 卡片是 overflow: hidden、有圓角：焦點框畫在內側才不會被裁掉 */
.two-line-row__body:focus-visible {
  outline-offset: -2px;
}
.two-line-row__text {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 2px;
}
.two-line-row__title {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.5rem;
  font-size: var(--text-heading-m);
  line-height: var(--text-heading-m--line-height);
  color: var(--text);
}
.two-line-row__meta {
  display: flex;
  min-width: 0;
  gap: 1rem;
  font-size: var(--text-body-m);
  line-height: var(--text-body-m--line-height);
  color: var(--text-muted);
}
</style>
