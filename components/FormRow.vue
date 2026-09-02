<script setup lang="ts">
// 分組卡片內的一列。相鄰兩列之間畫分隔線。
//
// 分隔線的規則寫在這裡而不是父層：兩個 .form-row 都帶著本元件的
// scope 屬性，相鄰選擇器才比對得到。
</script>

<template>
  <div class="form-row px-4 py-3">
    <slot />
  </div>
</template>

<style scoped>
.form-row + .form-row {
  border-top: 1px solid var(--border);
}
</style>
