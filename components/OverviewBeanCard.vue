<script setup lang="ts">
// 總覽上「某一杯或某支豆子」的卡片：最近沖煮、本週最高分（《02》§4.1，Figma 的 Card / 最近沖煮、Card / 本週最高分）。
//
// 由上到下：標題列（AppCard，右端 ›）、豆名（最多兩行）、評分（只有最高分）、置中的縮圖、最下面一行小字。
// **高度固定**（--overview-card-h，Figma 的 169px），全寬時也一樣：縮圖吃掉剩下的高度，
// 所以豆名一行時縮圖大、兩行加評分時縮圖小（Figma 的四個例子是 81、65、59、43px）。
// 縮圖：有豆袋照片就用照片，沒有才是烘焙度底色加咖啡豆插畫（BeanThumb）。Figma 畫的是佔位圖。
//
// wide：同一排只剩這一張、改成全寬時，內容橫向展開——縮圖在左、文字在右。
// note：最下面一行小字上面多一行說明（上週最高分的「本週還沒有評分」）。半寬時多這一行，
// 豆名就只留一行——不然縮圖只剩不到 20px。

import { NuxtLink } from '#components'

withDefaults(defineProps<{
  title: string
  to: string
  name: string
  isSample?: boolean
  photoUrl: string | null
  roastLevel: RoastLevel | null
  rating?: number | null
  /** 最下面一行：第 N 杯、星期三 */
  footer: string
  note?: string
  wide?: boolean
}>(), { rating: null, note: '', wide: false })
</script>

<template>
  <AppCard
    :as="NuxtLink" :to="to" :title="title" arrow
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
          <SampleBadge v-if="isSample" />
        </span>
        <StarDisplay v-if="rating !== null" :rating="rating" :size="18" class="gap-0.5" />
        <span class="mt-auto flex flex-col">
          <span v-if="note" class="text-body-s text-muted">{{ note }}</span>
          <span class="text-body-s tabular-nums text-muted">{{ footer }}</span>
        </span>
      </span>
    </span>
    <span v-else class="flex min-h-0 flex-1 flex-col gap-1 px-3 pt-0.5 pb-2">
      <span class="flex shrink-0 flex-wrap items-baseline gap-x-1.5 gap-y-1">
        <span class="text-sm leading-4 break-keep wrap-anywhere" :class="note ? 'line-clamp-1' : 'line-clamp-2'">{{ name }}</span>
        <SampleBadge v-if="isSample" />
      </span>
      <StarDisplay v-if="rating !== null" :rating="rating" :size="18" class="shrink-0 gap-0.5" />
      <span class="flex min-h-0 flex-1 items-center justify-center">
        <span class="block aspect-square h-full overflow-hidden rounded-sm">
          <BeanThumb :photo-url="photoUrl" :roast-level="roastLevel" :alt="name" />
        </span>
      </span>
      <span v-if="note" class="shrink-0 text-body-s text-muted">{{ note }}</span>
      <span class="shrink-0 text-body-s tabular-nums text-muted">{{ footer }}</span>
    </span>
  </AppCard>
</template>
