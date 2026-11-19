<script setup lang="ts">
// 可以複選的標籤（《03》§4.20，Figma 的 Choice chip）。目前用在風味標籤。
//
// 外觀高 36px（Figma 是 34px，內距調到 4 的倍數），**可點範圍用 ::before 撐到 44px**（《03》§7）。
// 所以相鄰兩排之間至少要留 8px，可點範圍才不會互相重疊。
//
// 已選和未選同時變三樣：底色、框線、文字顏色（《03》§4.10：色彩不是唯一的載體）。

defineProps<{ selected: boolean }>()
</script>

<template>
  <button type="button" class="choice-chip" :aria-pressed="selected">
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
</style>
