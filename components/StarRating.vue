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
        <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z"
            :fill="(modelValue ?? 0) >= level ? 'var(--favorite)' : 'transparent'"
            :stroke="(modelValue ?? 0) >= level ? 'var(--favorite)' : 'var(--border)'"
            stroke-width="1.5"
            stroke-linejoin="round"
          />
        </svg>
      </button>
    </div>
  </div>
</template>
