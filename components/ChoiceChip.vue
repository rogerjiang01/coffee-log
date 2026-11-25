<script setup lang="ts">
// 可以複選的標籤（《03》§4.20，Figma 的 Choice chip）。目前用在風味標籤。
//
// 外觀高 36px（Figma 是 34px，內距調到 4 的倍數），**可點範圍用 ::before 撐到 44px**（《03》§7）。
// 所以相鄰兩排之間至少要留 8px，可點範圍才不會互相重疊。
//
// 已選和未選同時變三樣：底色、框線、文字顏色（《03》§4.10：色彩不是唯一的載體）。
//
// readonly（Figma 的 state=readonly，2026-11-25；紀錄詳情與分享頁的風味）：同一個盒子——內距、字級、轉角都一樣，
// 外框保留 1px 但改成透明，高度和表單裡的 chip 完全一樣。底色 --surface-muted、文字 --text。
// 它不是按鈕：是 <span>，沒有可點範圍、沒有 aria-pressed。清單語意（ul／li）由呼叫端包。

defineProps<{ selected?: boolean, readonly?: boolean }>()
</script>

<template>
  <span v-if="readonly" class="choice-chip choice-chip--readonly"><slot /></span>
  <button v-else type="button" class="choice-chip" :aria-pressed="selected">
    <slot />
  </button>
</template>

<style scoped>
.choice-chip {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.25rem 0.75rem;
  border: 1px solid var(--field-border);
  border-radius: 9999px;
  /* 兩端的曲率連續（tokens.css 的 --corner-chip，漸進增強） */
  corner-shape: var(--corner-chip);
  font-size: var(--text-heading-m);
  line-height: var(--text-heading-m--line-height);
  color: var(--text);
  transition: background var(--motion-duration) var(--motion-ease);
}
.choice-chip::before {
  content: "";
  position: absolute;
  inset: -4px 0;
}
.choice-chip[aria-pressed="true"] {
  border-color: var(--accent);
  background: var(--accent-wash);
  color: var(--on-accent-wash);
}
.choice-chip--readonly {
  border-color: transparent;
  background: var(--surface-muted);
}
.choice-chip--readonly::before {
  content: none;
}
</style>
