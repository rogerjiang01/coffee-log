<script setup lang="ts">
// 總沖煮時間：[分] : [秒] 兩個窄輸入框，數字鍵盤。
//
// 不用輪盤或下拉——那是為「尋找」設計的。使用者是事後補記已知的數字
// （他知道是 2:30），對輸入已知值反而更慢。
//
// **底層儲存格式不變，仍是 total_time 總秒數。**

const props = defineProps<{
  modelValue: number | null
  id?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [number | null] }>()

const minutes = ref('')
const seconds = ref('')

// 外部值變動時同步回兩個輸入框，但不要在使用者正在打字時覆蓋他
watch(() => props.modelValue, (value) => {
  const composed = compose(minutes.value, seconds.value)
  if (composed === value) return
  minutes.value = value === null ? '' : String(Math.floor(value / 60))
  seconds.value = value === null ? '' : String(value % 60).padStart(2, '0')
}, { immediate: true })

function compose(m: string, s: string): number | null {
  if (m === '' && s === '') return null
  return (Number(m) || 0) * 60 + (Number(s) || 0)
}

function onMinutes(event: Event) {
  minutes.value = (event.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 2)
  emit('update:modelValue', compose(minutes.value, seconds.value))
}

function onSeconds(event: Event) {
  const raw = (event.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 2)
  // 超過 59 秒沒有意義，但不擋輸入，只在失焦時收斂
  seconds.value = raw
  emit('update:modelValue', compose(minutes.value, seconds.value))
}

function onSecondsBlur() {
  if (seconds.value === '') return
  const value = Math.min(59, Number(seconds.value))
  seconds.value = String(value).padStart(2, '0')
  emit('update:modelValue', compose(minutes.value, seconds.value))
}

const boxStyle = {
  minHeight: '44px',
}
</script>

<template>
  <div class="flex items-center gap-1">
    <input
      :id="id"
      :value="minutes"
      :data-filled="minutes !== ''"
      type="text"
      inputmode="numeric"
      placeholder="0"
      aria-label="分"
      class="w-16 shrink-0 field py-2.5 text-center tabular-nums"
      :style="boxStyle"
      @input="onMinutes"
    >
    <span aria-hidden="true" :style="{ color: 'var(--text-muted)' }">:</span>
    <input
      :value="seconds"
      :data-filled="seconds !== ''"
      type="text"
      inputmode="numeric"
      placeholder="00"
      aria-label="秒"
      class="w-16 shrink-0 field py-2.5 text-center tabular-nums"
      :style="boxStyle"
      @input="onSeconds"
      @blur="onSecondsBlur"
    >
    <span class="ml-2 text-xs" :style="{ color: 'var(--text-muted)' }">分:秒</span>
  </div>
</template>
