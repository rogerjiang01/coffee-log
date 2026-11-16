<script setup lang="ts">
// 分段注水的唯讀呈現（《03》§4.4）：記錄表單的摘要卡片、紀錄詳情、分享頁共用。
// **同一份資料只有這一種寫法**——兩個地方兩種寫法，會被當成兩件事（2026-11-16）。
//
// 每一段：段名（強調色）、累積水量（水滴）、停水時長（時鐘；有記而且不是最後一段才有）、備註。
// increments：段名那一列的右端顯示這一段的增量水量（「+ 120 g」）。紀錄詳情與分享頁要完整顯示
// 衍生值（《02》§7），表單的摘要不顯示（增量在分段子頁裡）。
//
// 舊紀錄的攪拌段由呼叫端先併掉（utils/brewSteps.ts 的 withoutStir），這裡不認得 stir。

const props = withDefaults(defineProps<{
  steps: StepInput[]
  /** 顯示停水時長。關閉時不顯示，資料照樣留著 */
  showTimes?: boolean
  increments?: boolean
  /** 在卡片裡：每一列自己帶卡片的左右內距，分隔線畫在列的下面（下面還有別的列）。不在卡片裡時線在上面 */
  inCard?: boolean
}>(), { showTimes: true, increments: false, inCard: false })

const deltas = computed(() => incrementalWater(props.steps))

// 只列填了水量的段：沒填的不會被存（toStepRows），不顯示空的段
const rows = computed(() => props.steps
  .map((step, index) => ({ step, index, label: stepLabel(props.steps, index), delta: deltas.value[index] ?? null }))
  .filter(row => row.step.cumulativeWater !== null))
</script>

<template>
  <div>
    <div v-for="(row, at) in rows" :key="row.index" class="step-row py-3" :class="inCard ? 'card-pad-x step-row--below' : 'step-row--above'">
      <p class="flex items-baseline justify-between gap-3 text-sm font-medium" :style="{ color: 'var(--accent-text)' }">
        <span>{{ row.label }}</span>
        <span v-if="increments && row.delta !== null" class="tabular-nums">+ {{ row.delta }} g</span>
      </p>
      <dl class="mt-0.5 grid grid-cols-2 gap-x-3">
        <div>
          <dt class="step-term">
            <!-- Lucide droplet -->
            <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z" />
            </svg>
            累積水量
          </dt>
          <dd class="step-value">{{ row.step.cumulativeWater }} g</dd>
        </div>
        <div v-if="showTimes && at < rows.length - 1 && row.step.holdSeconds !== null">
          <dt class="step-term">
            <!-- Lucide clock -->
            <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
            停水時長
          </dt>
          <dd class="step-value">{{ row.step.holdSeconds }} 秒</dd>
        </div>
      </dl>
      <p v-if="row.step.note" class="mt-0.5 text-sm text-muted">{{ row.step.note }}</p>
    </div>
  </div>
</template>

<style scoped>
.step-row--below {
  border-bottom: 1px solid var(--border);
}
.step-row--above {
  border-top: 1px solid var(--border);
}
.step-term {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: var(--text-body-m);
  line-height: var(--text-body-m--line-height);
  color: var(--text-muted);
}
.step-term > svg {
  color: var(--accent);
}
.step-value {
  font-size: var(--text-heading-l);
  line-height: var(--text-heading-l--line-height);
  font-variant-numeric: tabular-nums;
}
</style>
