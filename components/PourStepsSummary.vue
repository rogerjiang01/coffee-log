<script setup lang="ts">
// 分段注水的摘要（《02》§5、《03》§4.4，Figma 記錄表單裡的分段卡片）。
//
// 主表單只顯示各段的摘要，唯讀；編輯在子頁（PourStepsSheet）。
// 卡片的第一列是標題：選了沖煮手法就寫手法名稱，沒選寫「分段注水」。
// 每一段的寫法在 PourStepList（紀錄詳情與分享頁共用同一個）。
// 最下面一列進入子頁：有分段寫「編輯分段」，還沒有任何一段填了水量寫「新增分段」。

const props = defineProps<{
  steps: StepInput[]
  /** 沖煮手法的名稱。沒選是 null */
  methodName: string | null
  /** 顯示停水時長（使用者偏好）。關閉時不顯示，資料照樣留著 */
  showTimes: boolean
}>()

const emit = defineEmits<{ open: [] }>()

const hasSteps = computed(() => props.steps.some(step => step.cumulativeWater !== null))
</script>

<template>
  <div>
    <div class="card-pad-x summary-title">
      <p class="sheet-label">{{ methodName ?? '分段注水' }}</p>
    </div>

    <PourStepList :steps="steps" :show-times="showTimes" in-card />

    <button
      type="button"
      class="card-pad-x sheet-row w-full text-left"
      :style="{ color: 'var(--accent-text)' }"
      @click="emit('open')"
    >
      <span class="text-heading-m">{{ hasSteps ? '編輯分段' : '新增分段' }}</span>
    </button>
  </div>
</template>

<style scoped>
.summary-title {
  display: flex;
  align-items: center;
  min-height: var(--sheet-row-h);
  box-shadow: inset 0 -1px 0 var(--border);
}
</style>
