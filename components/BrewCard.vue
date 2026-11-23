<script setup lang="ts">
// 紀錄卡片：紀錄分頁的列表一筆（《03》§4.21，Figma「紀錄卡片ver1123」）。
//
// 只呈現「這一杯」的沖煮參數，**不和上一杯比較**——差異只在紀錄詳情頁與結算頁（《02》§4.2）。
// 所有數值同一個顏色，不標示改過的值。整張卡片是連到紀錄詳情的連結，卡片上不放按鈕。
//
// 標題區三行：豆名／星等或「未評分」／沖煮日期（2026-11-23 決定）。Figma 把星等和日期放在同一行，
// 但 360、375px 寬時那一行放不下（星等 116 + 日期約 121，中間那欄只有 190–241px；不是今年的日期更寬），
// 所以拆成三行，每張卡片一樣高。縮圖 48px 靠上。
//
// 豆名用 text-heading-s 的 Medium（16px）：Figma 綁的 Heading MS（17px）在 tokens 裡沒有，不新增（2026-11-23）。
// 和日期（16px Regular、--text-muted）靠字重與顏色區分。
//
// 五欄等寬、沒填的寫「—」，位置保留，每張卡片的欄位上下對齊（utils/brewCard.ts）。
// 360px 寬時一欄約 52px，最寬的值「1:16.0」約 46px、標籤「粉水比」45px。

import { NuxtLink } from '#components'

const props = defineProps<{
  id: string
  /** null：沒有指定豆子 */
  beanName: string | null
  photoUrl: string | null
  roastLevel: RoastLevel | null
  rating: number | null
  brewedAt: string
  isFavorite: boolean
  dose: number | null
  grindSetting: number | null
  waterTemp: number | null
  totalTime: number | null
  totalWater: number | null
}>()

const date = computed(() => cardBrewDate(props.brewedAt))
const params = computed(() => cardParams(props))
</script>

<template>
  <AppCard :as="NuxtLink" :to="`/brews/${id}`" radius="ml" class="brew-card block">
    <!-- 卡片是連結：裡面只放行內元素（span），用 class 排版 -->
    <span class="flex items-start gap-3">
      <!-- 豆名就在旁邊，縮圖不另外唸一次 -->
      <span class="block size-12 shrink-0 overflow-hidden rounded-md">
        <BeanThumb :photo-url="photoUrl" :roast-level="roastLevel" alt="" />
      </span>

      <span class="flex min-w-0 flex-1 flex-col">
        <span role="heading" aria-level="2" class="truncate text-heading-s font-medium">{{ beanName ?? '沒有指定豆子' }}</span>
        <span class="flex h-6 items-center">
          <StarDisplay v-if="rating !== null" :rating="rating" />
          <span v-else class="text-heading-s text-muted">未評分</span>
        </span>
        <span class="text-heading-s whitespace-nowrap text-muted">{{ date }}</span>
      </span>

      <!-- 收藏：有收藏才顯示。24px 的框裡 18px 的愛心（Figma） -->
      <span v-if="isFavorite" class="flex size-6 shrink-0 items-center justify-center">
        <svg
          width="18" height="18" viewBox="0 0 24 24" role="img" aria-label="收藏"
          fill="var(--favorite)" stroke="var(--favorite)"
          stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
        >
          <path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5" />
        </svg>
      </span>
    </span>

    <!-- 分隔線，寬度等於內容寬度 -->
    <span class="my-3 block h-px" :style="{ background: 'var(--border)' }" aria-hidden="true" />

    <span class="grid grid-cols-5 gap-1.5 py-2.5">
      <span v-for="param in params" :key="param.label" class="flex min-w-0 flex-col gap-0.5">
        <span class="text-body-l whitespace-nowrap text-muted">{{ param.label }}</span>
        <span class="text-heading-s font-medium whitespace-nowrap">{{ param.value }}</span>
      </span>
    </span>
  </AppCard>
</template>

<style scoped>
/* 內距照 Figma：上 16、左右 16、下 14 */
.brew-card {
  padding: var(--card-pad) var(--card-pad) 14px;
}
</style>
