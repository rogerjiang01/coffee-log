<script setup lang="ts">
// 總沖煮時間的分:秒選擇器。
//
// 用兩個原生 <select>：手機上會叫出系統的滾輪選單，桌機是原生下拉，
// 都不需要打字。HTML 沒有 mm:ss 的原生 picker——type="time" 是 hh:mm，
// 讓使用者填 00:02:30 反而更糟。
//
// **底層儲存格式不變，仍是 total_time 總秒數。** 這個元件只換輸入介面。

const props = defineProps<{
  modelValue: number | null
  id?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [number | null] }>()

// 手沖很少超過十分鐘，給到 20 分足夠且不讓選單過長
const minuteOptions = Array.from({ length: 21 }, (_, i) => i)
const secondOptions = Array.from({ length: 60 }, (_, i) => i)

const minutes = computed(() => (props.modelValue === null ? null : Math.floor(props.modelValue / 60)))
const seconds = computed(() => (props.modelValue === null ? null : props.modelValue % 60))

function update(nextMinutes: number | null, nextSeconds: number | null) {
  if (nextMinutes === null && nextSeconds === null) {
    emit('update:modelValue', null)
    return
  }
  emit('update:modelValue', (nextMinutes ?? 0) * 60 + (nextSeconds ?? 0))
}

function onMinutes(event: Event) {
  const raw = (event.target as HTMLSelectElement).value
  update(raw === '' ? null : Number(raw), seconds.value)
}

function onSeconds(event: Event) {
  const raw = (event.target as HTMLSelectElement).value
  update(minutes.value, raw === '' ? null : Number(raw))
}

function clear() {
  emit('update:modelValue', null)
}

const selectStyle = (value: number | null) => ({
  borderColor: 'var(--border)',
  background: 'var(--surface)',
  minHeight: '44px',
  color: value === null ? 'var(--text-muted)' : 'var(--text)',
})
</script>

<template>
  <div class="flex items-center gap-2">
    <select
      :id="id"
      :value="minutes ?? ''"
      class="min-w-0 flex-1 rounded-sm border px-3 py-2.5 tabular-nums"
      :style="selectStyle(minutes)"
      aria-label="總沖煮時間的分"
      @change="onMinutes"
    >
      <option value="">分</option>
      <option v-for="minute in minuteOptions" :key="minute" :value="minute">{{ minute }} 分</option>
    </select>

    <select
      :value="seconds ?? ''"
      class="min-w-0 flex-1 rounded-sm border px-3 py-2.5 tabular-nums"
      :style="selectStyle(seconds)"
      aria-label="總沖煮時間的秒"
      @change="onSeconds"
    >
      <option value="">秒</option>
      <option v-for="second in secondOptions" :key="second" :value="second">{{ second }} 秒</option>
    </select>

    <button
      v-if="modelValue !== null"
      type="button"
      class="shrink-0 px-2 text-sm"
      :style="{ color: 'var(--text-muted)', minHeight: '44px', minWidth: '44px' }"
      @click="clear"
    >
      清除
    </button>
  </div>
</template>
