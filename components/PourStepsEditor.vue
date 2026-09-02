<script setup lang="ts">
// 分段注水編輯器（《03-介面規範》§4.4、《02-功能規格》§5 區塊三）。
//
// 這一區是本產品與競品最主要的差異，做得比其他區塊更用心。
//
// 介面輸入的是「注到幾克」與「停幾秒」；換算成 time_offset 是存檔時的事，
// 由 utils/brewSteps.ts 負責，這個元件只管介面。
//
// 悶蒸單獨呈現在最上方，但資料層仍是 step_index = 1、step_type = 'bloom'
// 的一般段落，沒有獨立欄位。

const props = defineProps<{
  modelValue: StepInput[]
  dose: number | null
}>()

const emit = defineEmits<{ 'update:modelValue': [StepInput[]] }>()

const bloom = computed(() => props.modelValue[0] ?? emptyStep('bloom'))
const rest = computed(() => props.modelValue.slice(1))

const increments = computed(() => incrementalWater(props.modelValue))
const water = computed(() => totalWater(props.modelValue))
const ratio = computed(() => brewRatioLabel(water.value, props.dose))

function patch(index: number, changes: Partial<StepInput>) {
  const next = props.modelValue.map((step, i) => (i === index ? { ...step, ...changes } : step))
  emit('update:modelValue', next)
}

function addStep() {
  emit('update:modelValue', [...props.modelValue, emptyStep('pour')])
}

function removeStep(index: number) {
  emit('update:modelValue', props.modelValue.filter((_, i) => i !== index))
}

// 第一版只提供切換為「攪拌」，段落型態屬 L2
function toggleStir(index: number) {
  const current = props.modelValue[index]
  if (!current) return
  patch(index, { stepType: current.stepType === 'stir' ? 'pour' : 'stir' })
}
</script>

<template>
  <section>
    <h2 class="font-serif text-lg font-bold">分段注水</h2>

    <!-- 悶蒸與其他段落在視覺上明確分開 -->
    <div
      class="mt-3 rounded-md px-4 py-3"
      :style="{ background: 'var(--accent-wash)' }"
    >
      <p class="text-sm font-medium">悶蒸</p>
      <div class="mt-2 flex items-center gap-2">
        <span class="shrink-0 text-sm">注到</span>
        <NumberField
          :model-value="bloom.cumulativeWater"
          unit="g"
          aria-label="悶蒸注到幾克"
          @update:model-value="patch(0, { cumulativeWater: $event })"
        />
        <span class="shrink-0 text-sm">停</span>
        <NumberField
          :model-value="bloom.holdSeconds"
          unit="秒"
          integer
          aria-label="悶蒸停留秒數"
          @update:model-value="patch(0, { holdSeconds: $event })"
        />
      </div>
    </div>

    <ul class="mt-3">
      <li
        v-for="(step, offset) in rest"
        :key="offset"
        class="border-t py-3"
        :style="{ borderColor: 'var(--border)' }"
      >
        <!-- 段落之間顯示算出來的增量水量，幫使用者確認自己填對了 -->
        <p
          v-if="increments[offset + 1] !== null"
          class="text-xs tabular-nums"
          :style="{ color: 'var(--text-muted)' }"
        >
          +{{ increments[offset + 1] }}g
        </p>

        <div class="mt-1 flex items-center gap-2">
          <span class="shrink-0 text-sm">注到</span>
          <NumberField
            :model-value="step.cumulativeWater"
            unit="g"
            :aria-label="`第 ${offset + 2} 段注到幾克`"
            @update:model-value="patch(offset + 1, { cumulativeWater: $event })"
          />
          <span class="shrink-0 text-sm">停</span>
          <NumberField
            :model-value="step.holdSeconds"
            unit="秒"
            integer
            :aria-label="`第 ${offset + 2} 段停留秒數`"
            @update:model-value="patch(offset + 1, { holdSeconds: $event })"
          />
          <button
            type="button"
            class="shrink-0 rounded-sm px-2"
            :style="{ color: 'var(--text-muted)', minHeight: '44px', minWidth: '44px' }"
            :aria-label="`刪除第 ${offset + 2} 段`"
            @click="removeStep(offset + 1)"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" class="mx-auto">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            </svg>
          </button>
        </div>

        <button
          type="button"
          class="mt-1 text-xs"
          :style="{ color: step.stepType === 'stir' ? 'var(--accent)' : 'var(--text-muted)' }"
          :aria-pressed="step.stepType === 'stir'"
          @click="toggleStir(offset + 1)"
        >
          {{ step.stepType === 'stir' ? '這段是攪拌' : '標成攪拌' }}
        </button>
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
