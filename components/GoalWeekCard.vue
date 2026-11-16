<script setup lang="ts">
// 「本週目標」卡片（《03》§4.16，Figma 的「Card / 本週目標」）：總覽與結算頁共用同一個元件。
//
// 標題列在上（AppCard）；下面一排三塊：左邊 100px 的環，中間是「記錄」與「N／M 杯」，
// 右邊是週一到週日的每日長條圖。0 杯的那一天不畫長條，只留星期。
//
// 結算頁特有的行為由 props 開：
//   from        環從存檔前的杯數畫到存檔後的杯數（GoalRing 的動畫，減少動態效果時直接顯示最後狀態）
//   celebrate   這一筆剛好跨過目標：環補滿時的強調，「N／M 杯」下方顯示「已達成」
// 總覽的卡片可以點（修改目標，標題列右端有 ›），結算頁的不行。
//
// over：超過目標時怎麼表示（總覽空狀態的兩個方案，使用者選定後留下一個）
//   'lap'   環畫第二圈，數字下方寫「已達成」
//   'text'  環停在一圈，數字下方寫「超過 N 杯」

const props = withDefaults(defineProps<{
  count: number
  goal: number
  /** 週一到週日每天的杯數 */
  days: number[]
  from?: number | null
  celebrate?: boolean
  clickable?: boolean
  over?: 'lap' | 'text' | null
}>(), { from: null, celebrate: false, clickable: false, over: null })

const emit = defineEmits<{ click: [] }>()

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']
const BAR_HEIGHT = 54

// 有動畫時，數字等環畫完才換成存檔後的杯數
const filled = ref(props.from === null)
const shown = computed(() => (filled.value || props.from === null ? props.count : props.from))

const barMax = computed(() => Math.max(1, ...props.days))

const reached = computed(() => props.count >= props.goal)
const ringCount = computed(() => (props.over === 'text' ? Math.min(props.count, props.goal) : props.count))
const status = computed(() => {
  if (props.celebrate) return filled.value ? '已達成' : ''
  if (props.over === 'lap' && reached.value) return '已達成'
  if (props.over === 'text' && props.count > props.goal) return `超過 ${props.count - props.goal} 杯`
  return ''
})
</script>

<template>
  <AppCard
    :as="clickable ? 'button' : 'section'"
    :type="clickable ? 'button' : undefined"
    title="本週目標"
    :arrow="clickable"
    class="block w-full text-left"
    @click="clickable && emit('click')"
  >
    <span class="flex items-end justify-between gap-3 px-3 pt-3 pb-3">
      <GoalRing :count="ringCount" :from="from" :goal="goal" :size="100" :celebrate="celebrate" @filled="filled = true" />
      <span class="flex min-w-0 flex-col self-center font-medium">
        <span class="text-body-s">記錄</span>
        <span class="whitespace-nowrap tabular-nums" :style="{ color: 'var(--accent-text)' }">
          <span class="text-heading-l">{{ shown }}／{{ goal }}</span>
          <span class="ml-1.5 text-body-l">杯</span>
        </span>
        <span v-if="status" class="text-body-s" :style="{ color: 'var(--accent-text)' }">{{ status }}</span>
      </span>
      <!-- 每日長條圖：長條 8px 寬、圓頭，最多的那一天頂到 54px -->
      <span class="flex shrink-0 gap-2" aria-hidden="true">
        <span v-for="(cups, day) in days" :key="day" class="flex w-2 flex-col items-center gap-0.5">
          <span class="flex w-full items-end" :style="{ height: `${BAR_HEIGHT}px` }">
            <span
              v-if="cups"
              class="w-full rounded-full"
              :style="{ height: `${Math.max(8, (cups / barMax) * BAR_HEIGHT)}px`, background: 'var(--accent)' }"
            />
          </span>
          <span class="text-label-m whitespace-nowrap text-muted">{{ WEEKDAYS[day] }}</span>
        </span>
      </span>
    </span>
  </AppCard>
</template>
