<script setup lang="ts">
// 紀錄卡片：紀錄分頁的列表一筆（《03》§4.21，Figma「紀錄卡片ver1123」）。
//
// 只呈現「這一杯」的沖煮參數，**不和上一杯比較**——差異只在紀錄詳情頁與結算頁（《02》§4.2）。
// 所有數值同一個顏色，不標示改過的值。整張卡片是連到紀錄詳情的連結，卡片上不放按鈕。
//
// 標題區依**卡片的寬度**（container query，不看 viewport）切換兩種版面（2026-11-24）：
//   兩行（一般）：豆名＋右側愛心／星等或「未評分」＋沖煮日期。縮圖 52px（和兩行等高）、圓角 --radius-sm
//   三行（第二行放不下時）：豆名＋愛心／星等／沖煮日期。縮圖 80px（和三行等高）、圓角 --radius-md
// 兩種都是行距 4px、縮圖和文字相距 16px；愛心只佔第一行的寬度。
// 切換點：最長的第二行是星等 116 + 間距 8 + 「2025/12/28」約 83.5 = 207.5px，
// 文字欄 = 卡片內容寬 − 縮圖 52 − 間距 16，所以卡片內容寬 ≥ 276px 用兩行（頁面約 350px 以上）。
// 卡片之間不會一張兩行、一張三行：切換只看寬度，不看內容。
//
// 豆名用 text-heading-s 的 Medium（16px）：Figma 綁的 Heading MS（17px）在 tokens 裡沒有，不新增（2026-11-23）。
// 和日期（16px Regular、--text-muted）靠字重與顏色區分。
//
// 五欄等寬、沒填的寫「—」，位置保留，每張卡片的欄位上下對齊（utils/brewCard.ts）。
// 最寬的值「1:16.0」約 46px、「20.5 g」約 45px，標籤「粉水比」45px。欄間距兩級（2026-11-24）：
//   兩行版面 6px：360px 寬時一欄約 52px
//   三行版面 2px：320px 寬時卡片內容 246px，一欄 (246 − 4×2) / 5 = 47.6px，不縮字
//   （比照總覽半寬卡片的星等在 320px 先縮間距）

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
    <span class="brew-card__head flex items-start gap-4">
      <!-- 豆名就在旁邊，縮圖不另外唸一次 -->
      <span class="brew-card__thumb block shrink-0 overflow-hidden">
        <BeanThumb :photo-url="photoUrl" :roast-level="roastLevel" alt="" />
      </span>

      <span class="flex min-w-0 flex-1 flex-col gap-1">
        <span class="flex h-6 items-center gap-2">
          <span role="heading" aria-level="2" class="min-w-0 flex-1 truncate text-heading-s font-medium">{{ beanName ?? '沒有指定豆子' }}</span>
          <!-- 收藏：有收藏才顯示，只佔第一行。24px 的框裡 18px 的愛心（Figma） -->
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
        <!-- 兩行時是一行（星等＋日期，間距 8）；三行時拆成兩行（間距 4） -->
        <span class="brew-card__meta flex min-w-0 flex-col gap-1">
          <span class="flex h-6 shrink-0 items-center">
            <StarDisplay v-if="rating !== null" :rating="rating" />
            <span v-else class="text-heading-s text-muted">未評分</span>
          </span>
          <span class="min-w-0 truncate text-heading-s text-muted">{{ date }}</span>
        </span>
      </span>
    </span>

    <!-- 分隔線，寬度等於內容寬度 -->
    <span class="my-3 block h-px" :style="{ background: 'var(--border)' }" aria-hidden="true" />

    <span class="brew-card__params grid grid-cols-5 py-2.5">
      <span v-for="param in params" :key="param.label" class="flex min-w-0 flex-col gap-0.5">
        <span class="text-body-l whitespace-nowrap text-muted">{{ param.label }}</span>
        <span class="text-heading-s font-medium whitespace-nowrap">{{ param.value }}</span>
      </span>
    </span>
  </AppCard>
</template>

<style scoped>
/* 內距照 Figma：上 16、左右 16、下 14。
   container：標題區的版面看卡片自己的內容寬度（不看 viewport），見上面的切換點 */
.brew-card {
  padding: var(--card-pad) var(--card-pad) 14px;
  container-type: inline-size;
}

/* 三行（預設）：縮圖 80px＝三行 24 + 兩個間距 4 */
.brew-card__thumb {
  width: 80px;
  height: 80px;
  border-radius: var(--radius-md);
}
/* 三行時卡片窄，五欄的間距縮成 2px，每欄才至少 46px（「1:16.0」）；不縮字 */
.brew-card__params {
  column-gap: 2px;
}

/* 兩行：第二行放得下星等＋最長的日期時（卡片內容寬 ≥ 276px） */
@container (min-width: 276px) {
  .brew-card__thumb {
    width: 52px;
    height: 52px;
    border-radius: var(--radius-sm);
  }
  .brew-card__meta {
    flex-direction: row;
    align-items: center;
    gap: 8px;
  }
  .brew-card__params {
    column-gap: 6px;
  }
}
</style>
