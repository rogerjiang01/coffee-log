<script setup lang="ts">
// 分組卡片。卡片內的欄位用分隔線區隔，輸入區直接坐在卡片內。
//
// 卡片會把 --field-border / --field-bg 覆寫成透明：輸入框放棄自己的邊框
// 之後，分組層級才會成為畫面上唯一的結構線索，不會變成框中框。
//
// 標題放在卡片上方外側，小字、--text-muted。它是標籤不是段落標題，
// 不搶欄位的視覺權重。

defineProps<{ title?: string }>()
</script>

<template>
  <section>
    <p v-if="title" class="mb-1.5 px-1 text-sm" :style="{ color: 'var(--text-muted)' }">
      {{ title }}
    </p>
    <div
      class="form-card overflow-hidden rounded-md border"
      :style="{ borderColor: 'var(--border)', background: 'var(--surface)' }"
    >
      <slot />
    </div>
  </section>
</template>

<style scoped>
.form-card {
  /* 自訂屬性會往下繼承，子元件不必知道自己在卡片裡 */
  --field-border: transparent;
  --field-bg: transparent;
}

/* 水平內距由 FormRow 提供，欄位本身貼齊列的左右邊界。
   padding 是用 class 設的（px-3），不是 inline style，所以不需要 !important。 */
.form-card :deep(input),
.form-card :deep(select),
.form-card :deep(textarea),
.form-card :deep([data-field]) {
  padding-left: 0;
  padding-right: 0;
}
</style>
