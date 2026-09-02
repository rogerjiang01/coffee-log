<script setup lang="ts">
// 研磨刻度（《01-資料庫規格》§3.2 的四欄制）。
//
// 驗證邏輯在 utils/equipment.ts，階段 4 已完成並測過。
// **所有結果都是提示，不阻擋儲存**——使用者可能改裝、可能記錯、
// 可能用型錄未涵蓋的方式讀數，擋住輸入的代價遠高於容忍異常值。

const props = defineProps<{
  modelValue: number | null
  spec: GrindScaleSpec
  hasCatalog: boolean
}>()

const emit = defineEmits<{ 'update:modelValue': [number | null] }>()

const hints = computed(() => grindScaleHints(props.modelValue, props.spec))
const range = computed(() => grindScaleRangeLabel(props.spec))
const suggestion = computed(() => grindScaleSuggestionLabel(props.spec))
const freeform = computed(() => isFreeformScale(props.spec))
</script>

<template>
  <div>
    <label class="block text-sm" for="grind-setting">研磨刻度</label>
    <NumberField
      id="grind-setting"
      :model-value="modelValue"
      @update:model-value="emit('update:modelValue', $event)"
    />

    <!-- 型錄沒有資料、或面板本來就沒刻度時，自由輸入不做任何範圍提示 -->
    <p v-if="!hasCatalog" class="mt-1 text-xs text-muted">自訂器材沒有刻度資料，填什麼都可以</p>
    <p v-else-if="freeform" class="mt-1 text-xs text-muted">這台面板沒有刻度標示，填什麼都可以</p>
    <p v-else class="mt-1 text-xs tabular-nums text-muted">
      <span v-if="range">刻度 {{ range }}</span>
      <span v-if="spec.increment !== null" class="ml-3">最小間隔 {{ spec.increment }}</span>
      <span v-else class="ml-3">連續無段</span>
      <span v-if="suggestion" class="ml-3">{{ suggestion }}</span>
    </p>
    <p v-if="spec.note" class="mt-1 text-xs text-muted">{{ spec.note }}</p>

    <!-- 提示用 --text-muted 而不是 --danger：這不是錯誤，儲存不會被擋 -->
    <p v-for="hint in hints" :key="hint" class="mt-1 text-xs text-muted">{{ hint }}</p>
  </div>
</template>
