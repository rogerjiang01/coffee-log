<script setup lang="ts">
// 偵測到未存完的暫存時的提示。
//
// 用行內橫幅而不是對話框：對話框會打斷使用者，而這件事不緊急也不危險——
// 兩個選項都不會失去資料。

defineProps<{ note?: string }>()
defineEmits<{ accept: []; discard: [] }>()
</script>

<template>
  <div
    class="rounded-md border p-4"
    :style="{ borderColor: 'var(--accent)', background: 'var(--accent-wash)' }"
    role="status"
  >
    <p :style="{ color: 'var(--on-accent-wash)' }">上次有一筆沒存完，要接著填嗎？</p>
    <p v-if="note" class="mt-1 text-sm" :style="{ color: 'var(--on-accent-wash)' }">{{ note }}</p>

    <div class="mt-3 flex gap-3">
      <button
        type="button"
        class="flex-1 rounded-sm px-4 py-3 font-medium"
        :style="{ background: 'var(--accent)', color: 'var(--on-accent)', minHeight: '44px' }"
        @click="$emit('accept')"
      >
        接著填
      </button>
      <button
        type="button"
        class="flex-1 rounded-sm border px-4 py-3"
        :style="{ borderColor: 'var(--border-strong)', background: 'var(--surface)', minHeight: '44px' }"
        @click="$emit('discard')"
      >
        重新開始
      </button>
    </div>
  </div>
</template>
