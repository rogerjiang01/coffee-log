<script setup lang="ts">
// 分組卡片。卡片內的欄位用分隔線區隔，輸入區直接坐在卡片內。
//
// 欄位是底線制（見 main.css 的 .field）：底線同時扮演該列的分隔線，
// 卡片內不另外畫線。使用者一眼看得出哪裡可以填、填到哪裡為止，
// 同時不會出現框中框。
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
/* 水平內距由 FormRow 提供，欄位本身貼齊列的內容邊界——
   底線因此不會碰到卡片外框，左右各有一個 FormRow 內距的呼吸空間。
   padding 是用 class 設的（px-3），不是 inline style，不需要 !important。 */
.form-card :deep(input),
.form-card :deep(select),
.form-card :deep(textarea),
.form-card :deep([data-field]) {
  padding-left: 0;
  padding-right: 0;
}
</style>
