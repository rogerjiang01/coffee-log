<script setup lang="ts">
// 強度選擇器（《03-介面規範》§4.3、《02-功能規格》§5 區塊四）。
//
// 四個維度只描述強度，不評價好壞——文案不得出現「評分」「分數」「幾分」。
// 好壞交給愛心與心得筆記。
//
// 一次點擊完成，不用滑桿（手機上難精準）、不用下拉（需兩次操作）。
// 全站一致採「被選中的點與其左側一併填實」表達強度累進。
//
// 圓點照 Figma 的 Rating：18px、**未選也是實心**，顏色是 --control-inactive（2026-11-13 決定）。
// 已選（--accent）和未選的明度對比是 3.88:1，不只靠色相；數值本身由「從左數來深色幾個」表達。
// 每一顆的可點範圍是 44px（《03》§7），圓點的間距因此是 50px（Figma 是 18 ＋ 32）。
//
// 鍵盤：一列是一個 radiogroup，只佔一個 Tab 停駐點，方向鍵移動並選取（useRadioKeys）。

// Intensity 定義在 utils/brew.ts，由 Nuxt 自動匯入

const props = defineProps<{ modelValue: Intensity }>()
const emit = defineEmits<{ 'update:modelValue': [Intensity] }>()

const dimensions: { key: keyof Intensity, label: string }[] = [
  { key: 'acidity', label: '酸質' },
  { key: 'sweetness', label: '甜感' },
  { key: 'body', label: '醇厚' },
  { key: 'bitterness', label: '苦味' },
]

const levels = [1, 2, 3, 4, 5]
const keys = useRadioKeys(levels)

function set(key: keyof Intensity, level: number) {
  emit('update:modelValue', { ...props.modelValue, [key]: level })
}

function pick(key: keyof Intensity, level: number) {
  const next = { ...props.modelValue }
  // 再點一次同一個點就清掉，四個維度都可以留空
  if (next[key] === level) delete next[key]
  else next[key] = level
  emit('update:modelValue', next)
}

function onKeydown(event: KeyboardEvent, key: keyof Intensity) {
  const level = keys.onKeydown(event, props.modelValue[key])
  if (level !== null) set(key, level)
}
</script>

<template>
  <section>
    <div class="px-4 pt-4">
      <p>強度</p>
      <p class="text-sm text-muted">描述強弱，不是好壞</p>
    </div>

    <!-- 「弱／強」只標一次，在四列圓點的上方、與圓點欄的兩端對齊。
         四列的意思相同，逐列重複是雜訊，在 375px 下也放不進卡片。 -->
    <div class="flex justify-end px-4 pt-3" aria-hidden="true">
      <div class="rating-track flex justify-between text-sm text-muted">
        <span class="rating-cell text-center">弱</span>
        <span class="rating-cell text-center">強</span>
      </div>
    </div>

    <div
      v-for="dimension in dimensions"
      :key="dimension.key"
      class="rating-row flex items-center justify-between gap-2 px-4"
    >
      <span class="sheet-label">{{ dimension.label }}</span>

      <div
        class="rating-track flex justify-between"
        role="radiogroup"
        :aria-label="dimension.label"
        @keydown="onKeydown($event, dimension.key)"
      >
        <button
          v-for="level in levels"
          :key="level"
          type="button"
          role="radio"
          :tabindex="keys.tabindex(level, modelValue[dimension.key])"
          :aria-checked="modelValue[dimension.key] === level"
          :aria-label="`${dimension.label} ${level}`"
          class="rating-cell flex items-center justify-center"
          @click="pick(dimension.key, level)"
        >
          <!-- 可點範圍 44px，圓點本身 18px -->
          <span
            class="block rounded-full"
            :style="{
              width: '18px',
              height: '18px',
              background: (modelValue[dimension.key] ?? 0) >= level ? 'var(--accent)' : 'var(--control-inactive)',
              transition: 'background var(--motion-duration) var(--motion-ease)',
            }"
          />
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* 五格各 44px、間隔 6px：圓點中心相距 50px。右邊往外推 13px，最後一顆圓點的邊緣才對齊列的右緣 */
.rating-track {
  width: 244px;
  margin-right: -13px;
  flex-shrink: 0;
}
.rating-cell {
  width: var(--touch-min);
  min-height: var(--touch-min);
}
.rating-row {
  min-height: 64px;
}
.rating-row + .rating-row {
  border-top: 1px solid var(--border);
}
</style>
