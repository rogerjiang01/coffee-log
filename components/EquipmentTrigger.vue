<script setup lang="ts">
// 沖煮表單上的器材欄位。點下去開全頁選擇器，本身只負責顯示目前選了什麼。

defineProps<{ label: string; name: string | null }>()
defineEmits<{ open: [] }>()
</script>

<template>
  <div>
    <p class="text-sm">{{ label }}</p>
    <button
      type="button"
      class="mt-1 flex w-full items-center justify-between field px-3 py-2.5 text-left"
      data-field
      :data-filled="!!name"
      :style="{ minHeight: '44px' }"
      @click="$emit('open')"
    >
      <span class="min-w-0 truncate" :style="{ color: name ? 'var(--text)' : 'var(--text-muted)' }">
        {{ name ?? '選填' }}
      </span>
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" :style="{ color: 'var(--text-muted)' }">
        <path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
      </svg>
    </button>
  </div>
</template>
