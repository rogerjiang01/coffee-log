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

const notice = computed(() => grindScaleNotice(props.modelValue, props.spec))
const rangeNotice = computed(() => (notice.value?.kind === 'range' ? notice.value.text : null))
const incrementNotice = computed(() => (notice.value?.kind === 'increment' ? notice.value.text : null))
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

    <!-- 型錄沒有資料、或面板本來就沒刻度時完全不提示，
         連「這台沒有刻度」都不說：畫面上沒有提示本身就是那個資訊 -->
    <p v-if="hasCatalog && !freeform" class="mt-1 text-xs tabular-nums text-muted">
      <span v-if="range">刻度 {{ range }}</span>
      <span v-if="!unset(spec.increment)" class="ml-3">最小間隔 {{ spec.increment }}</span>
      <span v-else class="ml-3">連續無段</span>
      <span v-if="suggestion" class="ml-3">{{ suggestion }}</span>
      <!--
        超出範圍的提示接在參考資訊後面，同一行。分開一行的話它長得跟
        參考資訊一樣，而參考資訊是一直都在的東西，使用者看久了會自動略過。

        whitespace-nowrap：中文預設可以在任兩個字之間換行，一行放不下時
        會變成「超出磨豆機刻」＋「度範圍」。整段一起換到下一行才讀得出來。

        顏色用 --notice 不用 --danger：這個值存得起來（《03》§4.1）。
      -->
      <span
        v-if="rangeNotice"
        class="ml-3 whitespace-nowrap"
        :style="{ color: 'var(--notice)' }"
      >{{ rangeNotice }}</span>
    </p>
    <p v-if="spec.note" class="mt-1 text-xs text-muted">{{ spec.note }}</p>

    <!-- 間隔不符維持原樣：獨立一行、--text-muted。
         它講的是「這台停不到那個位置」，不像超出範圍那樣可能是看錯行 -->
    <p v-if="incrementNotice" class="mt-1 text-xs text-muted">{{ incrementNotice }}</p>
  </div>
</template>
