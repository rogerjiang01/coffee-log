<script setup lang="ts">
// 「本週目標」卡片（《03》§4.16，Figma 的「Card / 本週目標」）：總覽與結算頁共用同一個元件。
//
// 標題列在上（AppCard）；下面一排三塊：左邊 100px 的環，中間是「記錄」與「N／M 杯」，
// 右邊是週一到週日的每日長條圖。每一天都有一條全高的底軌（--accent-wash），杯數的長條疊在上面；
// 沒有紀錄的日子只看得到底軌（照 Figma）。
//
// 結算頁特有的行為由 props 開：
//   from        環從存檔前的杯數畫到存檔後的杯數（GoalRing 的動畫，減少動態效果時直接顯示最後狀態）
//   celebrate   這一筆剛好跨過目標：環補滿時的強調，「N／M 杯」下方顯示「已達成」
// 總覽的卡片可以點（修改目標，標題列右端有 ›），結算頁的不行。
//
// 超過目標時兩頁都一樣（《02》§4.1、§5，2026-11-16）：環停在一圈、不畫第二圈，數字下方寫「超過 N 杯」。
// 結算頁上已經超過目標之後的紀錄，環的起點與終點都是滿的一圈，所以沒有動畫，數字直接是存檔後的杯數。

const props = withDefaults(defineProps<{
  count: number
  goal: number
  /** 週一到週日每天的杯數 */
  days: number[]
  from?: number | null
  celebrate?: boolean
  clickable?: boolean
}>(), { from: null, celebrate: false, clickable: false })

const emit = defineEmits<{ click: [] }>()

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']
const BAR_HEIGHT = 54

// 環最多畫到一圈
const ringCount = computed(() => Math.min(props.count, props.goal))
const ringFrom = computed(() => (props.from === null ? null : Math.min(props.from, props.goal)))

// 有動畫時，數字等環畫完才換成存檔後的杯數。起點和終點相同（已經超過目標）就沒有動畫
const filled = ref(ringFrom.value === null || ringFrom.value === ringCount.value)
const shown = computed(() => (filled.value || props.from === null ? props.count : props.from))

const barMax = computed(() => Math.max(1, ...props.days))

const status = computed(() => {
  if (props.celebrate) return filled.value ? '已達成' : ''
  if (props.count > props.goal) return `超過 ${props.count - props.goal} 杯`
  return ''
})
</script>

<template>
  <AppCard
    :as="clickable ? 'button' : 'section'"
    :type="clickable ? 'button' : undefined"
    title="本週目標"
    :arrow="clickable"
    class="flex w-full flex-col text-left"
    :style="{ minHeight: 'var(--overview-card-h)' }"
    @click="clickable && emit('click')"
  >
    <span class="flex items-end justify-between gap-3 px-3 pt-3.25 pb-2">
      <GoalRing :count="ringCount" :from="ringFrom" :goal="goal" :size="100" :celebrate="celebrate" @filled="filled = true" />
      <span class="flex min-w-0 flex-col justify-center self-stretch pb-2.5 font-medium">
        <span class="text-body-s">記錄</span>
        <span class="whitespace-nowrap tabular-nums" :style="{ color: 'var(--accent-text)' }">
          <span class="text-heading-l">{{ shown }}／{{ goal }}</span>
          <span class="ml-1.5 text-body-l">杯</span>
        </span>
        <span v-if="status" class="text-body-s" :style="{ color: 'var(--accent-text)' }">{{ status }}</span>
      </span>
      <!-- 每日長條圖：8px 寬、圓頭。底軌全高 54px，杯數的長條疊在上面，最多的那一天頂到最高 -->
      <span class="flex shrink-0 gap-2" aria-hidden="true">
        <span v-for="(cups, day) in days" :key="day" class="flex w-2 flex-col items-center gap-0.5">
          <span class="relative w-full rounded-full" :style="{ height: `${BAR_HEIGHT}px`, background: 'var(--accent-wash)' }">
            <span
              v-if="cups"
              class="absolute inset-x-0 bottom-0 rounded-full"
              :style="{ height: `${Math.max(8, (cups / barMax) * BAR_HEIGHT)}px`, background: 'var(--accent)' }"
            />
          </span>
          <span class="text-label-m whitespace-nowrap text-muted">{{ WEEKDAYS[day] }}</span>
        </span>
      </span>
    </span>
  </AppCard>
</template>
