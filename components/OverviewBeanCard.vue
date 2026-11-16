<script setup lang="ts">
// 總覽上「某一杯或某支豆子」的卡片：最近沖煮、本週最高分（《02》§4.1，Figma 的 Card / 最近沖煮、Card / 本週最高分）。
//
// 由上到下：標題列（AppCard，右端 ›）、豆名（最多兩行）、評分（只有最高分）、置中的縮圖、最下面一行小字。
// 縮圖：有豆袋照片就用照片，沒有才是烘焙度底色加咖啡豆插畫（BeanThumb）。Figma 畫的是佔位圖。
//
// wide：同一排只剩這一張、改成全寬時，內容橫向展開——縮圖在左、文字在右（空狀態方案 A）。

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
  /** footer 上面多一行說明（空狀態方案 B 的「本週還沒有評分」） */
  note?: string
  wide?: boolean
}>(), { rating: null, note: '', wide: false })
</script>

<template>
  <AppCard :as="NuxtLink" :to="to" :title="title" arrow class="flex flex-col" :class="{ 'aspect-square': !wide }">
    <span v-if="wide" class="flex items-center gap-3 px-3 pt-2 pb-3">
      <span class="block size-16 shrink-0 overflow-hidden rounded-sm">
        <BeanThumb :photo-url="photoUrl" :roast-level="roastLevel" :alt="name" />
      </span>
      <span class="flex min-w-0 flex-1 flex-col gap-0.5">
        <span class="flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
          <span class="line-clamp-2 text-sm break-keep wrap-anywhere">{{ name }}</span>
          <SampleBadge v-if="isSample" />
        </span>
        <StarDisplay v-if="rating !== null" :rating="rating" :size="18" />
        <span v-if="note" class="text-label-m text-muted">{{ note }}</span>
        <span class="text-label-m tabular-nums text-muted">{{ footer }}</span>
      </span>
    </span>
    <span v-else class="flex min-h-0 flex-1 flex-col px-3 pb-2">
      <span class="flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
        <span class="line-clamp-2 text-sm break-keep wrap-anywhere">{{ name }}</span>
        <SampleBadge v-if="isSample" />
      </span>
      <StarDisplay v-if="rating !== null" :rating="rating" :size="18" />
      <span class="flex flex-1 items-center justify-center py-1.5">
        <span class="block size-11 overflow-hidden rounded-sm">
          <BeanThumb :photo-url="photoUrl" :roast-level="roastLevel" :alt="name" />
        </span>
      </span>
      <span v-if="note" class="text-label-m text-muted">{{ note }}</span>
      <span class="text-label-m tabular-nums text-muted">{{ footer }}</span>
    </span>
  </AppCard>
</template>
