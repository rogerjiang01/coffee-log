<script setup lang="ts">
// 星等評分（1–5，可留空代表未評分）。
//
// 清除規則與強度選擇器一致：再次點擊目前已選中的那顆星，整組清空。
//
// 這個欄位只描述這一杯好不好喝，與「收藏／常沖」是兩件事，
// 介面上分開呈現，不疊成複合元件。
//
// 外觀照 Figma 的 star：**未選也是實心**，顏色是 --control-inactive（2026-11-13 決定），
// 已選是 --favorite。每一顆的可點範圍是 44px。版面是表單的一列：標籤在左、五顆星在右。
// 鍵盤：一個 radiogroup，只佔一個 Tab 停駐點，方向鍵移動並選取（useRadioKeys）。

const props = defineProps<{ modelValue: number | null }>()
const emit = defineEmits<{ 'update:modelValue': [number | null] }>()

const levels = [1, 2, 3, 4, 5]
const keys = useRadioKeys(levels)

function pick(level: number) {
  emit('update:modelValue', props.modelValue === level ? null : level)
}

function onKeydown(event: KeyboardEvent) {
  const level = keys.onKeydown(event, props.modelValue)
  if (level !== null) emit('update:modelValue', level)
}
</script>

<template>
  <div class="sheet-row">
    <span class="sheet-label">評分</span>
    <div class="star-track flex justify-between" role="radiogroup" aria-label="評分" @keydown="onKeydown">
      <button
        v-for="level in levels"
        :key="level"
        type="button"
        role="radio"
        :tabindex="keys.tabindex(level, modelValue)"
        :aria-checked="modelValue === level"
        :aria-label="`${level} 顆星`"
        class="flex items-center justify-center"
        :style="{ width: 'var(--touch-min)', minHeight: 'var(--touch-min)' }"
        @click="pick(level)"
      >
        <svg
          width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"
          stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
          :fill="(modelValue ?? 0) >= level ? 'var(--favorite)' : 'var(--control-inactive)'"
          :stroke="(modelValue ?? 0) >= level ? 'var(--favorite)' : 'var(--control-inactive)'"
          class="star"
        >
          <path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" />
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
/* 和強度圓點同樣的淡入淡出（--motion-duration、--motion-ease）；系統開啟「減少動態」時全站的規則會關掉它 */
.star {
  transition: fill var(--motion-duration) var(--motion-ease), stroke var(--motion-duration) var(--motion-ease);
}
/* 與強度圓點同一組間距：五格各 44px、間隔 6px；右邊往外推 12px，最後一顆星的邊緣對齊列的右緣 */
.star-track {
  width: 244px;
  margin-right: -12px;
  flex-shrink: 0;
}
</style>
