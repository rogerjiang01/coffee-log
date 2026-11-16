<script setup lang="ts">
// 分段注水的摘要（《02》§5、《03》§4.4，Figma 記錄表單裡的分段卡片）。
//
// 主表單只顯示各段的摘要，唯讀；編輯在子頁（PourStepsSheet）。
// 卡片的第一列是標題：選了沖煮手法就寫手法名稱，沒選寫「分段注水」。
// 每一段：段名（強調色）、累積水量、停水時長（有記而且不是最後一段才有）、備註。
// 最下面一列進入子頁：有分段寫「編輯分段」，還沒有任何一段填了水量寫「新增分段」。

const props = defineProps<{
  steps: StepInput[]
  /** 沖煮手法的名稱。沒選是 null */
  methodName: string | null
  /** 顯示停水時長（使用者偏好）。關閉時不顯示，資料照樣留著 */
  showTimes: boolean
}>()

const emit = defineEmits<{ open: [] }>()

// 只列填了水量的段：沒填的不會被存（toStepRows），摘要不顯示空的段
const rows = computed(() => props.steps
  .map((step, index) => ({ step, index, label: stepLabel(props.steps, index) }))
  .filter(row => row.step.cumulativeWater !== null))
</script>

<template>
  <div>
    <div class="card-pad-x summary-row">
      <p class="sheet-label">{{ methodName ?? '分段注水' }}</p>
    </div>

    <div v-for="(row, at) in rows" :key="row.index" class="card-pad-x summary-row py-3">
      <p class="text-sm font-medium" :style="{ color: 'var(--accent-text)' }">{{ row.label }}</p>
      <dl class="mt-0.5 grid grid-cols-2 gap-x-3">
        <div>
          <dt class="summary-term">
            <!-- Lucide droplet -->
            <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z" />
            </svg>
            累積水量
          </dt>
          <dd class="summary-value">{{ row.step.cumulativeWater }} g</dd>
        </div>
        <div v-if="showTimes && at < rows.length - 1 && row.step.holdSeconds !== null">
          <dt class="summary-term">
            <!-- Lucide clock -->
            <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
            停水時長
          </dt>
          <dd class="summary-value">{{ row.step.holdSeconds }} 秒</dd>
        </div>
      </dl>
      <p v-if="row.step.note" class="mt-0.5 text-sm text-muted">{{ row.step.note }}</p>
    </div>

    <button
      type="button"
      class="card-pad-x sheet-row w-full text-left"
      :style="{ color: 'var(--accent-text)' }"
      @click="emit('open')"
    >
      <span class="text-heading-m">{{ rows.length ? '編輯分段' : '新增分段' }}</span>
    </button>
  </div>
</template>

<style scoped>
.summary-row {
  border-bottom: 1px solid var(--border);
}
.summary-row:first-child {
  display: flex;
  align-items: center;
  min-height: 4rem;
}
.summary-term {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: var(--text-body-m);
  line-height: var(--text-body-m--line-height);
  color: var(--text-muted);
}
.summary-term > svg {
  color: var(--accent);
}
.summary-value {
  font-size: var(--text-heading-l);
  line-height: var(--text-heading-l--line-height);
  font-variant-numeric: tabular-nums;
}
</style>
