<script setup lang="ts">
// 強度的唯讀顯示（紀錄詳情、分享頁共用；《03》§4.22）。放在唯讀卡片的 <dl> 裡，一個維度一列。
//
// **四項中只要有一項有值，四項全部顯示**（呼叫端決定要不要放這個元件）；沒填的那項寫「—」
// （和紀錄卡片的空值同一種寫法），不畫五個空點——五個空點讀起來像「0」。
// **資料不補 0**：沒填就是沒有那個 key。補 0 會讓比較區出現「— → 3」以外的假變化（0 → 3）。
//
// 有值的項目和表單的 IntensityPicker 同一組圓點與排列：18px、中心相距 50px、最後一顆對齊列的右緣、
// 已填 --accent、未填 --control-inactive（寬度不夠時縮間距，見樣式）。但它不是控制項：不是 button、不是 radiogroup，
// 每一項是一張圖（role="img"），名稱「酸質 3 / 5」；「—」那項念「酸質 未填」。
// 名稱與順序照 IntensityPicker（utils/brew.ts 的 INTENSITY_DIMENSIONS）。

const props = defineProps<{ intensity: Intensity }>()

const levels = [1, 2, 3, 4, 5]

const rows = computed(() => INTENSITY_DIMENSIONS.map(({ key, label }) => {
  const value = props.intensity[key]
  return { key, label, value: typeof value === 'number' ? value : null }
}))
</script>

<template>
  <ReadonlyRow v-for="row in rows" :key="row.key" :label="row.label" label-hidden>
    <span
      v-if="row.value !== null"
      role="img"
      :aria-label="`${row.label} ${row.value} / 5`"
      class="intensity-track flex justify-between"
    >
      <span v-for="level in levels" :key="level" class="intensity-cell flex items-center justify-center">
        <span
          class="block rounded-full"
          :style="{
            width: '18px',
            height: '18px',
            background: row.value >= level ? 'var(--accent)' : 'var(--control-inactive)',
          }"
        />
      </span>
    </span>
    <span v-else role="img" :aria-label="`${row.label} 未填`">—</span>
  </ReadonlyRow>
</template>

<style scoped>
/* 和 IntensityPicker 同一組幾何：圓點 18px、中心相距 50px、最後一顆的邊緣對齊列的右緣。
   表單的軌道是 5 格 44px 的可點範圍（244px、右邊外推 13px），看得到的圓點從第一顆左緣到最後一顆右緣是 218px；
   這裡沒有可點範圍，直接排這 218px。
   **放不下時縮間距，不超出卡片**（320px 寬：標籤之後只剩約 200px）。表單在 320px 時軌道會超出卡片，那是既有的情況 */
.intensity-track {
  width: 218px;
  max-width: 100%;
}
.intensity-cell {
  width: 18px;
}
</style>
