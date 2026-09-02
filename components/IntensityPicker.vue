<script setup lang="ts">
// 強度選擇器（《03-介面規範》§4.3、《02-功能規格》§5 區塊四）。
//
// 四個維度只描述強度，不評價好壞——文案不得出現「評分」「分數」「幾分」。
// 好壞交給愛心與心得筆記。
//
// 一次點擊完成，不用滑桿（手機上難精準）、不用下拉（需兩次操作）。
// 全站一致採「被選中的點與其左側一併填實」表達強度累進。
// 未選取要明顯是「可以不填」，不用紅色、驚嘆號或任何催促性的視覺。

// Intensity 定義在 utils/brew.ts，由 Nuxt 自動匯入

const props = defineProps<{ modelValue: Intensity }>()
const emit = defineEmits<{ 'update:modelValue': [Intensity] }>()

const dimensions: { key: keyof Intensity; label: string }[] = [
  { key: 'acidity', label: '酸質' },
  { key: 'sweetness', label: '甜感' },
  { key: 'body', label: '醇厚' },
  { key: 'bitterness', label: '苦味' },
]

const levels = [1, 2, 3, 4, 5]

function pick(key: keyof Intensity, level: number) {
  const next = { ...props.modelValue }
  // 再點一次同一個點就清掉，四個維度都可以留空
  if (next[key] === level) delete next[key]
  else next[key] = level
  emit('update:modelValue', next)
}
</script>

<template>
  <section>
    <h2 class="font-serif text-lg font-bold">強度</h2>
    <p class="mt-1 text-sm text-muted">描述強弱，不是好壞。留空也可以。</p>

    <div
      v-for="dimension in dimensions"
      :key="dimension.key"
      class="mt-3 flex items-center gap-3"
    >
      <span class="w-10 shrink-0 text-sm">{{ dimension.label }}</span>
      <span class="shrink-0 text-xs" :style="{ color: 'var(--text-muted)' }">弱</span>

      <div class="flex flex-1 justify-between" role="radiogroup" :aria-label="dimension.label">
        <button
          v-for="level in levels"
          :key="level"
          type="button"
          role="radio"
          :aria-checked="modelValue[dimension.key] === level"
          :aria-label="`${dimension.label} ${level}`"
          class="flex items-center justify-center"
          :style="{ minWidth: '44px', minHeight: '44px' }"
          @click="pick(dimension.key, level)"
        >
          <!-- 觸控區 44px，圓點視覺可以小 -->
          <span
            class="block size-4 rounded-lg border"
            :style="{
              borderColor: (modelValue[dimension.key] ?? 0) >= level ? 'var(--accent)' : 'var(--border)',
              background: (modelValue[dimension.key] ?? 0) >= level ? 'var(--accent)' : 'transparent',
              transition: 'background var(--motion-duration) var(--motion-ease)',
            }"
          />
        </button>
      </div>

      <span class="shrink-0 text-xs" :style="{ color: 'var(--text-muted)' }">強</span>
    </div>
  </section>
</template>
