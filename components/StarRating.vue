<script setup lang="ts">
// 星等評分（1–5，可留空代表未評分）。
//
// 清除規則與強度選擇器一致：再次點擊目前已選中的那顆星，整組清空。
//
// 這個欄位只描述這一杯好不好喝，與「收藏／常沖」是兩件事，
// 介面上分開呈現，不疊成複合元件。

const props = defineProps<{ modelValue: number | null }>()
const emit = defineEmits<{ 'update:modelValue': [number | null] }>()

const levels = [1, 2, 3, 4, 5]

function pick(level: number) {
  emit('update:modelValue', props.modelValue === level ? null : level)
}
</script>

<template>
  <div>
    <p class="text-sm">評分</p>
    <div class="mt-1 flex" role="radiogroup" aria-label="評分">
      <button
        v-for="level in levels"
        :key="level"
        type="button"
        role="radio"
        :aria-checked="modelValue === level"
        :aria-label="`${level} 顆星`"
        class="flex items-center justify-center"
        :style="{ minWidth: 'var(--touch-min)', minHeight: 'var(--touch-min)' }"
        @click="pick(level)"
      >
        <svg
          width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"
          stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
          :fill="(modelValue ?? 0) >= level ? 'var(--favorite)' : 'transparent'"
          :stroke="(modelValue ?? 0) >= level ? 'var(--favorite)' : 'var(--control-empty)'"
        >
          <path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" />
        </svg>
      </button>
    </div>
  </div>
</template>
