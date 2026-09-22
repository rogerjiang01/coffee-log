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
      :style="{ minHeight: 'var(--touch-min)' }"
      @click="$emit('open')"
    >
      <span class="min-w-0 truncate" :style="{ color: name ? 'var(--text)' : 'var(--text-muted)' }">
        {{ name ?? '選填' }}
      </span>
      <svg
        width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" :style="{ color: 'var(--text-muted)' }"
        fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"
      >
        <path d="m9 18 6-6-6-6" />
      </svg>
    </button>
  </div>
</template>
