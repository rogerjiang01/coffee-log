<script setup lang="ts">
// 分段注水編輯器（《03-介面規範》§4.4、《02-功能規格》§5 區塊三）。
//
// 介面輸入的是「注到幾克」與「停幾秒」；換算成 time_offset 是存檔時的事，
// 由 utils/brewSteps.ts 負責，這個元件只管介面。
//
// 悶蒸單獨呈現在最上方，但資料層仍是 step_index = 1、step_type = 'bloom'
// 的一般段落，沒有獨立欄位。
//
// 悶蒸與其他段落用同一套卡片外觀，靠標題與間距區隔，不靠不同的底色——
// 兩種卡片樣式並存會讓同一份清單看起來像兩種東西。

const props = defineProps<{
  modelValue: StepInput[]
  dose: number | null
}>()

const emit = defineEmits<{ 'update:modelValue': [StepInput[]] }>()

const increments = computed(() => incrementalWater(props.modelValue))
const water = computed(() => totalWater(props.modelValue))
const ratio = computed(() => brewRatioLabel(water.value, props.dose))

function patch(index: number, changes: Partial<StepInput>) {
  emit('update:modelValue', props.modelValue.map((step, i) => (i === index ? { ...step, ...changes } : step)))
}

function addStep() {
  emit('update:modelValue', [...props.modelValue, emptyStep('pour')])
}

function removeStep(index: number) {
  emit('update:modelValue', props.modelValue.filter((_, i) => i !== index))
}

function setStir(index: number, stir: boolean) {
  patch(index, { stepType: stir ? 'stir' : 'pour' })
}

</script>

<template>
  <section>
    <p class="text-sm">分段注水</p>

    <ul class="mt-2">
      <li
        v-for="(step, index) in modelValue"
        :key="index"
        class="step-row py-3"
      >
        <div class="flex items-center justify-between gap-3">
          <p class="text-sm font-medium">
            {{ step.stepType === 'bloom' ? '悶蒸' : `第 ${index} 段` }}<template v-if="step.stepType === 'stir'">・攪拌</template>
          </p>

          <div class="flex items-center gap-1">
            <!-- 段落之間顯示算出來的增量水量，幫使用者確認自己填對了 -->
            <span
              v-if="index > 0 && increments[index] !== null"
              class="mr-1 text-xs tabular-nums"
              :style="{ color: 'var(--text-muted)' }"
            >
              +{{ increments[index] }}g
            </span>

            <!-- 攪拌是結構化標記（未來要做時間軸視覺化、或算總水量時排除
                 攪拌步驟都需要它機器可讀），但不值得佔一整列。
                 收成標題列右側的圖示切換鈕。 -->
            <button
              v-if="step.stepType !== 'bloom'"
              type="button"
              class="flex shrink-0 items-center justify-center rounded-sm"
              :style="step.stepType === 'stir'
                ? { color: 'var(--on-accent-wash)', background: 'var(--accent-wash)', minHeight: '44px', minWidth: '44px' }
                : { color: 'var(--text-muted)', minHeight: '44px', minWidth: '44px' }"
              :aria-pressed="step.stepType === 'stir'"
              :aria-label="`把第 ${index} 段標成攪拌`"
              @click="setStir(index, step.stepType !== 'stir')"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"
                   fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
                <path d="M12 3a6 6 0 016 6c0 3.5-3 5-6 5s-6-1.5-6-5" />
                <path d="M12 14v7" />
                <path d="M9 21h6" />
              </svg>
            </button>
            <button
              v-if="step.stepType !== 'bloom'"
              type="button"
              class="shrink-0"
              :style="{ color: 'var(--text-muted)', minHeight: '44px', minWidth: '44px' }"
              :aria-label="`刪除第 ${index} 段`"
              @click="removeStep(index)"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" class="mx-auto">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
              </svg>
            </button>
          </div>
        </div>

        <!-- 兩欄格線讓兩個輸入框與標籤上下對齊 -->
        <div class="mt-2 grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs text-muted" :for="`step-water-${index}`">注到</label>
            <NumberField
              :id="`step-water-${index}`"
              :model-value="step.cumulativeWater"
              unit="g"
              class="mt-1"
              @update:model-value="patch(index, { cumulativeWater: $event })"
            />
          </div>
          <div>
            <label class="block text-xs text-muted" :for="`step-hold-${index}`">停留</label>
            <NumberField
              :id="`step-hold-${index}`"
              :model-value="step.holdSeconds"
              unit="秒"
              integer
              class="mt-1"
              @update:model-value="patch(index, { holdSeconds: $event })"
            />
          </div>
        </div>

        <!-- 段落備註。單行輸入，沒填時只有一條底線的高度，不佔額外空間。
             與攪拌標記是兩個不同需求：那個是結構化標記，這個是自由文字。 -->
        <input
          :value="step.note"
          :data-filled="!!step.note"
          type="text"
          class="mt-2 block w-full field field--note py-1.5 text-sm"
          placeholder="這段的備註"
          :aria-label="`第 ${index} 段的備註`"
          @input="patch(index, { note: ($event.target as HTMLInputElement).value })"
        >
      </li>
    </ul>

    <button
      type="button"
      class="mt-3 w-full rounded-sm border px-4 py-3"
      :style="{ borderColor: 'var(--border)', color: 'var(--accent)', minHeight: '44px' }"
      @click="addStep"
    >
      新增一段
    </button>

    <!-- 總水量與粉水比都是衍生值，不設輸入欄位、不存資料庫 -->
    <p v-if="water !== null" class="mt-2 text-sm tabular-nums" :style="{ color: 'var(--text-muted)' }">
      總水量 {{ water }}g<span v-if="ratio" class="ml-3">粉水比 {{ ratio }}</span>
    </p>
  </section>
</template>

<style scoped>
/* 分段之間用分隔線，不用巢狀卡片——外層已經是分組卡片了 */
.step-row + .step-row {
  border-top: 1px solid var(--border);
}
</style>
