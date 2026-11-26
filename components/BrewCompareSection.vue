<script setup lang="ts">
// 「和 M/D 那一杯相比」（紀錄詳情與結算頁共用；《02》§7、《03》§4.7）。
//
// 外觀是記錄表單的唯讀版（《03》§4.22）：FormSection 的標題，加一張 FormCard，每一列是 ReadonlyRow。
// 值是「舊值 → 新值」：舊值與箭頭 --text-muted，新值 --diff 加粗。箭頭是資料的一部分，不是裝飾（§1 的例外）。
//
// 兩頁的差別只有 summary 這一個 prop：
//   紀錄詳情（預設）  沒有比較對象、或沒有任何一列時整段不顯示。兩邊都有評分時評分那一列照列（相同也列）
//   結算頁（summary） 有比較對象就一定出現。參數完全相同時，標題下面是一句「參數和 M/D 那一杯相同。」，
//                     評分不同才再接一張只有評分一列的卡片（評分相同時那一列是「4 → 4」，句子已經說了相同，不再列）
//   feedback          結算頁的回饋句（utils/feedback.ts）：標題下、卡片上方；參數相同時接在那一句後面，同一段
//
// 比較本身（比較對象、哪些欄位、一邊沒填就略過）在 useBrewComparison／utils/brewDiff.ts，這裡只負責畫。

const props = withDefaults(defineProps<{
  comparison: Comparison
  summary?: boolean
  feedback?: string | null
}>(), { summary: false, feedback: null })

const date = computed(() => (props.comparison.target ? monthDay(props.comparison.target.brewed_at) : ''))
const same = computed(() => props.comparison.diffs.length === 0)

const rows = computed(() => {
  const { diffs, rating } = props.comparison
  if (props.summary && same.value) return rating && rating.before !== rating.after ? [rating] : []
  return rating ? [...diffs, rating] : diffs
})

const visible = computed(() => !!props.comparison.target && (props.summary || rows.value.length > 0))

// 結算頁標題下的那一段：參數相同的那一句、回饋句，同一段
const note = computed(() => {
  if (!props.summary) return ''
  return `${same.value ? `參數和 ${date.value} 那一杯相同。` : ''}${props.feedback ?? ''}`
})
</script>

<template>
  <FormSection v-if="visible" :title="`和 ${date} 那一杯相比`">
    <!-- 左右和標題、列文字對齊（--card-pad） -->
    <p v-if="note" class="card-pad-x text-body-l">{{ note }}</p>
    <FormCard v-if="rows.length">
      <dl>
        <ReadonlyRow v-for="diff in rows" :key="diff.field" :label="diff.label">
          <span>
            <span :style="{ color: 'var(--text-muted)' }">{{ diff.before }}</span>
            <span class="mx-2" :style="{ color: 'var(--text-muted)' }">→</span>
            <span class="compare-after font-medium" :style="{ color: 'var(--diff)' }">{{ diff.after }}</span>
          </span>
        </ReadonlyRow>
      </dl>
    </FormCard>
  </FormSection>
</template>

<style scoped>
/* 新值是 Noto Sans TC Medium，前面的舊值與箭頭是台北黑體：兩種字型的上下緣不同，混在同一行時行高會從 26 撐成 27，
   單行的列就變成 57px（2026-11-26，列的上下內距改成固定的 15px 之後才看得出來）。
   行高設成 1 只縮小這一段在行裡佔的高度，字的基線不動；這一行的高度回到台北黑體的 26 */
.compare-after {
  line-height: 1;
}
</style>
