<script setup lang="ts">
// 短時間離開後自動填入的告知橫幅。
//
// 用 sticky 而不是自動捲動：使用者原本在哪個位置是他的位置，
// 強制移動會讓他失去方向感。橫幅跟著捲動就解決了可見性。
//
// 沒有東西需要他決定，所以不擋畫面。「全部清除」是次要動作，不用強調色。

defineProps<{ note?: string }>()
defineEmits<{ clearAll: [] }>()
</script>

<template>
  <div
    class="sticky top-0 z-20 -mx-5 flex items-center gap-3 border-b px-5 py-3"
    :style="{ borderColor: 'var(--border)', background: 'var(--accent-wash)' }"
    role="status"
  >
    <span class="min-w-0 flex-1 text-sm" :style="{ color: 'var(--on-accent-wash)' }">
      未儲存的內容已恢復<template v-if="note">。{{ note }}</template>
    </span>
    <button
      type="button"
      class="shrink-0 rounded-sm border px-3 py-2 text-sm"
      :style="{ borderColor: 'var(--border-strong)', background: 'var(--surface)', minHeight: '44px' }"
      @click="$emit('clearAll')"
    >
      全部清除
    </button>
  </div>
</template>
