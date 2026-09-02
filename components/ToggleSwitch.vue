<script setup lang="ts">
// 標準 toggle switch（《03-介面規範》§4.10 狀態表現）。
//
// 表達的是狀態不是動作：標籤固定不變，開關位置本身說明目前狀態。
// 用 role="switch" 而不是 aria-pressed 的按鈕——前者輔助技術會讀成
// 「開／關」，後者讀成「已按下」，語意不同。

const props = defineProps<{
  modelValue: boolean
  label: string
  busy?: boolean
}>()

const emit = defineEmits<{ 'update:modelValue': [boolean] }>()
</script>

<template>
  <button
    type="button"
    role="switch"
    :aria-checked="modelValue"
    :disabled="busy"
    class="flex w-full items-center justify-between rounded-sm border px-4 py-3 disabled:opacity-60"
    :style="{ borderColor: 'var(--field-border)', background: 'var(--field-bg)', minHeight: '44px' }"
    @click="emit('update:modelValue', !modelValue)"
  >
    <span>{{ label }}</span>

    <!-- 軌道與滑鈕。開啟時軌道填 --accent，滑鈕移到右側。 -->
    <span
      class="relative inline-block h-6 w-11 shrink-0 rounded-lg"
      :style="{
        background: modelValue ? 'var(--accent)' : 'var(--border)',
        transition: 'background var(--motion-duration) var(--motion-ease)',
      }"
      aria-hidden="true"
    >
      <span
        class="absolute top-0.5 size-5 rounded-lg"
        :style="{
          background: 'var(--surface)',
          left: modelValue ? 'calc(100% - 1.375rem)' : '0.125rem',
          transition: 'left var(--motion-duration) var(--motion-ease)',
        }"
      />
    </span>
  </button>
</template>
