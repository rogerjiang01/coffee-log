<script setup lang="ts">
// 每週記錄目標的環（《03》§4.15）。總覽的目標環卡片與結算頁共用。
//
// 第一圈是本週杯數占目標的比例；超過目標時第二圈疊在第一圈上繼續畫（像 Apple Fitness），
// 看得出超出多少。顏色一律是語意 token：底圈 --accent-wash、第一圈 --accent、
// 第二圈 --accent-active（比第一圈深一階，疊上去分得出來）。
//
// from：結算頁用。環從 from 畫到 count；手機開啟「減少動態效果」時直接顯示最後的狀態。
// 動畫只用 CSS 的 transition，不用動畫函式庫。

const props = withDefaults(defineProps<{
  count: number
  goal: number
  /** 動畫的起點杯數。沒有就不播動畫 */
  from?: number | null
  size?: number
  /** 補滿的瞬間加上強調（結算頁，這一筆剛好跨過目標時） */
  celebrate?: boolean
}>(), { from: null, size: 96, celebrate: false })

const emit = defineEmits<{ filled: [] }>()

const STROKE = 10
const radius = computed(() => (props.size - STROKE) / 2)
const circumference = computed(() => 2 * Math.PI * radius.value)

const shown = ref(props.from ?? props.count)
const laps = computed(() => ringLaps(shown.value, props.goal))
const offset = (fraction: number) => circumference.value * (1 - fraction)

const DURATION_MS = 900
const animating = ref(false)
const pulsing = ref(false)

function reduceMotion() {
  return import.meta.client && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

onMounted(() => {
  if (props.from === null || props.from === props.count) return
  if (reduceMotion()) {
    shown.value = props.count
    emit('filled')
    return
  }
  // 先畫出起點，下一幀再換成終點，transition 才有東西可以補
  requestAnimationFrame(() => requestAnimationFrame(() => {
    animating.value = true
    shown.value = props.count
    window.setTimeout(() => {
      emit('filled')
      if (props.celebrate) pulsing.value = true
    }, DURATION_MS)
  }))
})
</script>

<template>
  <svg
    :width="size" :height="size" :viewBox="`0 0 ${size} ${size}`" aria-hidden="true"
    class="shrink-0 -rotate-90"
    :class="{ 'goal-ring-pulse': pulsing }"
  >
    <circle :cx="size / 2" :cy="size / 2" :r="radius" fill="none" :stroke-width="STROKE" stroke="var(--accent-wash)" />
    <circle
      :cx="size / 2" :cy="size / 2" :r="radius" fill="none" :stroke-width="STROKE" stroke-linecap="round"
      stroke="var(--accent)"
      :stroke-dasharray="circumference"
      :stroke-dashoffset="offset(laps.first)"
      :style="{ transition: animating ? `stroke-dashoffset ${DURATION_MS}ms ease-out` : 'none', opacity: laps.first > 0 ? 1 : 0 }"
    />
    <!-- 第二圈一直在，沒有超出時透明：圓頭線端在長度 0 時會畫出一個點 -->
    <circle
      :cx="size / 2" :cy="size / 2" :r="radius" fill="none" :stroke-width="STROKE" stroke-linecap="round"
      stroke="var(--accent-active)"
      :stroke-dasharray="circumference"
      :stroke-dashoffset="offset(laps.second)"
      :style="{ transition: animating ? `stroke-dashoffset ${DURATION_MS}ms ease-out` : 'none', opacity: laps.second > 0 ? 1 : 0 }"
    />
  </svg>
</template>

<style scoped>
/* 補滿的瞬間：環放大一下再回來。簡單版本，預覽時再定案 */
.goal-ring-pulse {
  animation: goal-ring-pulse 600ms ease-out 1;
  transform-origin: center;
}
@keyframes goal-ring-pulse {
  0% { transform: rotate(-90deg) scale(1); filter: none; }
  40% { transform: rotate(-90deg) scale(1.12); filter: drop-shadow(0 0 6px var(--accent-soft)); }
  100% { transform: rotate(-90deg) scale(1); filter: none; }
}
@media (prefers-reduced-motion: reduce) {
  .goal-ring-pulse { animation: none; }
}
</style>
