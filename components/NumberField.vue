<script setup lang="ts">
// 數值輸入（《03-介面規範》§4.1）。放在表單列的右側：數字靠右、沒有框，單位接在後面。
//
// 用 type="text" + inputmode="decimal" 而不是 type="number"：
// 規範要求移除上下箭頭（手機上是誤觸來源），而 type=number 的箭頭
// 各家瀏覽器要用不同的偽元素才藏得掉，直接不用它更乾淨。
//
// 單位顯示在數字右側，不用 placeholder 表達單位。顏色是 --text-muted：
// 單位帶有必要資訊，要 4.5:1（Figma 綁的 --text-placeholder 只有 2.45:1）。

const props = withDefaults(defineProps<{
  modelValue: number | null
  unit?: string
  integer?: boolean
  placeholder?: string
  ariaLabel?: string
  id?: string
}>(), { integer: false })

const emit = defineEmits<{ 'update:modelValue': [number | null] }>()

// 保留使用者正在打的原字串，否則打「12.」會被立刻正規化掉
const draft = ref(props.modelValue === null ? '' : String(props.modelValue))

watch(() => props.modelValue, (value) => {
  const asNumber = draft.value === '' ? null : Number(draft.value)
  if (value !== asNumber) draft.value = value === null ? '' : String(value)
})

function onInput(event: Event) {
  const raw = (event.target as HTMLInputElement).value
  const cleaned = props.integer ? raw.replace(/[^\d-]/g, '') : raw.replace(/[^\d.-]/g, '')
  draft.value = cleaned

  if (cleaned === '' || cleaned === '-' || cleaned === '.') {
    emit('update:modelValue', null)
    return
  }
  const parsed = Number(cleaned)
  emit('update:modelValue', Number.isNaN(parsed) ? null : parsed)
}
</script>

<template>
  <div class="flex min-w-0 flex-1 items-center justify-end gap-1">
    <input
      :id="id"
      :value="draft"
      type="text"
      inputmode="decimal"
      :placeholder="placeholder"
      :aria-label="ariaLabel"
      class="sheet-input tabular-nums"
      @input="onInput"
    >
    <span v-if="unit" class="sheet-unit">{{ unit }}</span>
  </div>
</template>
