<script setup lang="ts">
// 總覽上「某一杯或某支豆子」的卡片：最近沖煮、本週最高分（《02》§4.1，Figma 的 Card / 最近沖煮、Card / 本週最高分）。
//
// 由上到下：標題列（AppCard，右端 ›）、豆名（最多兩行）、評分（只有最高分）、置中的縮圖、最下面一行小字。
// **高度固定**（--overview-card-h，Figma 的 169px），全寬時也一樣：縮圖吃掉剩下的高度，
// 所以豆名一行時縮圖大、兩行加評分時縮圖小（Figma 的四個例子是 81、65、59、43px）。
// 縮圖：有豆袋照片就用照片，沒有才是烘焙度底色加咖啡豆插畫（BeanThumb）。Figma 畫的是佔位圖。
//
// wide：同一排只剩這一張、改成全寬時，內容橫向展開——縮圖在左、文字在右。
// 星等用 StarDisplay 的預設（20px、間距 4，共 116px）。半寬卡片在 320px 寬時內容只有 108px，
// 放不下時先縮間距、最小 2px（.overview-stars），星星維持 20px——比照目標卡片數字放不下時先縮長條間距的前例（2026-11-23）。
//
// 最下面一行小字（footer）**不換行**，放不下時以省略號截斷。上週最高分把說明併進這一行：
// 「上週六，本週未評分」（2026-11-23；原本是兩行「本週還沒有評分」＋「星期六」，把縮圖壓到 33px）。
// 13px 時 9 個字約 117px，360px 以上的半寬卡片放得下，320px 會被截斷（已同意）。
// nameLines：豆名最多幾行，預設兩行。上週最高分維持一行。

import { NuxtLink } from '#components'

withDefaults(defineProps<{
  title: string
  to: string
  name: string
  photoUrl: string | null
  roastLevel: RoastLevel | null
  rating?: number | null
  /** 最下面一行：第 N 杯、星期三 */
  footer: string
  /** 豆名最多幾行（上週最高分是 1） */
  nameLines?: 1 | 2
  wide?: boolean
}>(), { rating: null, nameLines: 2, wide: false })
</script>

<template>
  <AppCard
    :as="NuxtLink" :to="to" :title="title" arrow radius="ml"
    class="flex flex-col overflow-hidden"
    :style="{ height: 'var(--overview-card-h)' }"
  >
    <span v-if="wide" class="flex min-h-0 flex-1 gap-3 px-3 pt-0.5 pb-2">
      <span class="block aspect-square h-full shrink-0 overflow-hidden rounded-sm">
        <BeanThumb :photo-url="photoUrl" :roast-level="roastLevel" :alt="name" />
      </span>
      <span class="flex min-w-0 flex-1 flex-col gap-1">
        <span class="flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
          <span class="line-clamp-2 text-sm leading-4 break-keep wrap-anywhere">{{ name }}</span>
        </span>
        <StarDisplay v-if="rating !== null" :rating="rating" class="overview-stars" />
        <span class="mt-auto flex flex-col">
          <span class="truncate text-body-s tabular-nums text-muted">{{ footer }}</span>
        </span>
      </span>
    </span>
    <span v-else class="flex min-h-0 flex-1 flex-col gap-1 px-3 pt-0.5 pb-2">
      <span class="flex shrink-0 flex-wrap items-baseline gap-x-1.5 gap-y-1">
        <span class="text-sm leading-4 break-keep wrap-anywhere" :class="nameLines === 1 ? 'line-clamp-1' : 'line-clamp-2'">{{ name }}</span>
      </span>
      <StarDisplay v-if="rating !== null" :rating="rating" class="overview-stars shrink-0" />
      <span class="flex min-h-0 flex-1 items-center justify-center">
        <span class="block aspect-square h-full overflow-hidden rounded-sm">
          <BeanThumb :photo-url="photoUrl" :roast-level="roastLevel" :alt="name" />
        </span>
      </span>
      <span class="shrink-0 truncate text-body-s tabular-nums text-muted">{{ footer }}</span>
    </span>
  </AppCard>
</template>

<style scoped>
/* 星等的間距：放得下就是 4px，放不下時往下縮，最小 2px（5 顆 20px 是 100px，剩下的寬分給 4 個間距）。
   StarDisplay 在直排的 flex 裡被拉滿這一欄的寬，百分比就是這一欄的內容寬 */
.overview-stars {
  column-gap: clamp(2px, calc((100% - 100px) / 4), 4px);
}
</style>
