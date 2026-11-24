<script setup lang="ts">
// 每週記錄目標的加減按鈕（目標設定頁與修改目標的對話框共用，《03》§4.15）。
//
// 加減按鈕的 − 與 ＋ 是《03》§3 圖示表的「數量加減」：和「新增 ＋」意思不同，
// 只用在這組按鈕上。到邊界時那一側的按鈕停用。

const model = defineModel<number>({ required: true })

const atMin = computed(() => model.value <= GOAL_MIN)
const atMax = computed(() => model.value >= GOAL_MAX)

function step(delta: number) {
  model.value = clampGoal(model.value + delta)
}
</script>

<template>
  <div class="flex items-center justify-center gap-6">
    <button
      type="button"
      aria-label="減少"
      :disabled="atMin"
      class="flex shrink-0 items-center justify-center rounded-full border"
      :style="{
        width: 'var(--touch-min)', height: 'var(--touch-min)',
        borderColor: atMin ? 'var(--border)' : 'var(--border-strong)',
        color: atMin ? 'var(--control-empty)' : 'var(--text)',
      }"
      @click="step(-1)"
    >
      <svg
        width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"
        fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"
      >
        <path d="M5 12h14" />
      </svg>
    </button>

    <p class="flex min-w-[5.5rem] items-baseline justify-center gap-1">
      <output class="text-display-l tabular-nums" aria-live="polite">{{ model }}</output>
      <span>杯</span>
    </p>

    <button
      type="button"
      aria-label="增加"
      :disabled="atMax"
      class="flex shrink-0 items-center justify-center rounded-full border"
      :style="{
        width: 'var(--touch-min)', height: 'var(--touch-min)',
        borderColor: atMax ? 'var(--border)' : 'var(--border-strong)',
        color: atMax ? 'var(--control-empty)' : 'var(--text)',
      }"
      @click="step(1)"
    >
      <svg
        width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"
        fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"
      >
        <path d="M5 12h14" />
        <path d="M12 5v14" />
      </svg>
    </button>
  </div>
</template>
