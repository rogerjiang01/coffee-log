<script setup lang="ts">
// 表單列右側的膠囊（Figma 的 Dropdown Pill，《03》§4.1）：下拉與器材欄位用它顯示已選的值。
//
// - 值最多兩行，超過省略；標籤不讓位，換行的是值（長豆名）
// - empty：還沒選值時不畫膠囊，提示字直接寫在卡片底色上（main.css 的 .sheet-pill 說明）
// - active：下拉開著（Figma 的 dropdown_input），文字換成強調色
//
// 兩層 span：外層是膠囊的內距與底色，內層做兩行省略——
// 省略寫在有內距的那一層上，被切掉的第三行會從下方的內距露出來。

defineProps<{ empty?: boolean, active?: boolean }>()
</script>

<template>
  <span class="sheet-pill block" :data-empty="empty || undefined" :data-active="active || undefined">
    <span class="sheet-clamp"><slot /></span>
  </span>
</template>
