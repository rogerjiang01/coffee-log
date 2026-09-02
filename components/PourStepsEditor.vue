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

const cardStyle = { borderColor: 'var(--border)', background: 'var(--surface)' }
</script>

<template>
  <section>
    <h2 class="font-serif text-lg font-bold">分段注水</h2>

    <ul class="mt-3 space-y-3">
      <li
        v-for="(step, index) in modelValue"
        :key="index"
        class="rounded-md border p-4"
        :class="index === 1 ? 'mt-5' : ''"
        :style="cardStyle"
      >
        <div class="flex items-baseline justify-between gap-3">
          <p class="text-sm font-medium">
            {{ step.stepType === 'bloom' ? '悶蒸' : `第 ${index} 段` }}
          </p>

          <div class="flex items-baseline gap-3">
            <!-- 段落之間顯示算出來的增量水量，幫使用者確認自己填對了 -->
            <span
              v-if="index > 0 && increments[index] !== null"
              class="text-xs tabular-nums"
              :style="{ color: 'var(--text-muted)' }"
            >
              +{{ increments[index] }}g
            </span>
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

        <!-- 段落型態屬 L2，第一版只提供切換為「攪拌」 -->
        <label
          v-if="step.stepType !== 'bloom'"
          class="mt-3 flex items-center gap-2 text-sm"
          :style="{ minHeight: '44px' }"
        >
          <input
            type="checkbox"
            class="size-5"
            :style="{ accentColor: 'var(--accent)' }"
            :checked="step.stepType === 'stir'"
            @change="setStir(index, ($event.target as HTMLInputElement).checked)"
          >
          <span>這段是攪拌，不是注水</span>
        </label>
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
    <p v-if="water !== null" class="mt-3 text-sm tabular-nums" :style="{ color: 'var(--text-muted)' }">
      總水量 {{ water }}g<span v-if="ratio" class="ml-3">粉水比 {{ ratio }}</span>
    </p>
  </section>
</template>
