<script setup lang="ts">
// 首頁下區的時間軸一列（《02-功能規格》§4）。
//
// 差異提示是這一列存在的理由之一：使用者不需要多做任何事，
// 只是照原本的動線複製、改數字、儲存，這裡就會一眼看見他的調整軌跡。

const props = defineProps<{
  beanName: string | null
  brewedAt: string
  dose: number | null
  totalWater: number | null
  waterTemp: number | null
  grindSetting: number | null
  isFavorite: boolean
  diffs: BrewDiff[]
}>()

const ratio = computed(() => brewRatioLabel(props.totalWater, props.dose))

const date = computed(() => {
  const d = new Date(props.brewedAt)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}`
})

// 極簡：只顯示第一項，其餘用數量帶過
const hint = computed(() => props.diffs[0] ?? null)
</script>

<template>
  <article class="py-3">
    <div class="flex items-baseline justify-between gap-3">
      <h3 class="min-w-0 flex-1 truncate font-medium">{{ beanName ?? '沒有指定豆子' }}</h3>
      <span class="shrink-0 text-sm tabular-nums text-muted">{{ date }}</span>
      <svg
        v-if="isFavorite"
        width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" class="shrink-0"
      >
        <path
          d="M12 20s-7-4.5-7-9.5A3.5 3.5 0 0112 8a3.5 3.5 0 017 2.5C19 15.5 12 20 12 20z"
          fill="var(--favorite)" stroke="var(--favorite)" stroke-width="1.5" stroke-linejoin="round"
        />
      </svg>
    </div>

    <p class="mt-1 text-sm tabular-nums text-muted">
      <span v-if="dose !== null">{{ dose }}g</span>
      <span v-if="ratio" class="ml-3">{{ ratio }}</span>
      <span v-if="waterTemp !== null" class="ml-3">{{ waterTemp }}°C</span>
      <span v-if="grindSetting !== null" class="ml-3">刻度 {{ grindSetting }}</span>
    </p>

    <!-- 差異提示。此處的箭頭是資料的一部分，不是裝飾。 -->
    <p v-if="hint" class="mt-1 text-sm tabular-nums">
      <span :style="{ color: 'var(--text-muted)' }">{{ hint.label }}</span>
      <span class="ml-2" :style="{ color: 'var(--text-muted)' }">{{ hint.before }}</span>
      <span class="mx-1" :style="{ color: 'var(--text-muted)' }">→</span>
      <span class="font-medium" :style="{ color: 'var(--diff)' }">{{ hint.after }}</span>
      <span v-if="diffs.length > 1" class="ml-2 text-xs" :style="{ color: 'var(--text-muted)' }">
        等 {{ diffs.length }} 項
      </span>
    </p>
  </article>
</template>
