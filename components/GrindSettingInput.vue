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

// 超出範圍與間隔不符同位置、同顏色，一次只有一則：兩者皆不符時
// grindScaleNotice 只回範圍那一則（《02》§5）
const notice = computed(() => grindScaleNotice(props.modelValue, props.spec)?.text ?? null)
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
    <!--
      flex-wrap ＋ gap-x-3 取代每段的 ml-3：column-gap 只在同一行的兩段之間生效，
      換到下一行的那段會貼齊左緣。ml-3 會跟著換行，只有提示縮排 12px，
      下面的型錄備註卻貼齊左緣，看起來像排版出錯。
    -->
    <p v-if="hasCatalog && !freeform" class="mt-1 flex flex-wrap gap-x-3 text-xs tabular-nums text-muted">
      <span v-if="range">刻度 {{ range }}</span>
      <span v-if="!unset(spec.increment)">最小間隔 {{ spec.increment }}</span>
      <span v-else>連續無段</span>
      <span v-if="suggestion">{{ suggestion }}</span>
      <!--
        超出範圍、不符最小間隔都接在參考資訊後面，同一行。分開一行的話它長得跟
        參考資訊一樣，而參考資訊是一直都在的東西，使用者看久了會自動略過。

        whitespace-nowrap：中文預設可以在任兩個字之間換行，一行放不下時
        會變成「超出磨豆機刻」＋「度範圍」。整段一起換到下一行才讀得出來。

        顏色用 --notice 不用 --danger：這個值存得起來（《03》§4.1）。
      -->
      <span
        v-if="notice"
        class="whitespace-nowrap"
        :style="{ color: 'var(--notice)' }"
      >{{ notice }}</span>
    </p>
    <p v-if="spec.note" class="mt-1 text-xs text-muted">{{ spec.note }}</p>
  </div>
</template>
