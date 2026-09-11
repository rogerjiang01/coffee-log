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
//
// **「停留」＝到下一段注水前的時間**，也就是給水時間加上停水時間。
// 訪談資深使用者確認兩者是兩件事：給水速率跟手沖壺有關，而且有行動誤差
// （眼睛看到 8 秒、身體開始動作要 2 秒），無法預先決定；停水時間可以預期，
// 也是真正會被刻意調整的參數。不拆成兩個欄位：輸入成本翻倍，而給水時間
// 本身沒有記錄價值——同一把壺同一個人的給水速率相對固定，所以間隔的變化
// 主要就是停水的變化。標籤仍叫「停留」，那是咖啡圈的通用說法；
// 定義靠第一段下方那一行輔助說明。
// 最後一段沒有下一注，該格留空即可，總沖煮時間會接手。
//
// **時間欄位由使用者偏好決定要不要顯示**（設定頁「記錄分段時間」，預設關閉）。
// 關閉只是不顯示，不改資料：holdSeconds 照樣留在 modelValue 裡，儲存時照樣
// 換算成 time_offset。編輯一筆已有時間的紀錄、手法模板帶入的時間，
// 都不會因為欄位藏起來而被清空——這個元件從不寫 holdSeconds，除非使用者輸入。

const props = defineProps<{
  modelValue: StepInput[]
  dose: number | null
  /** 顯示停留秒數欄位。來自使用者偏好 profiles.record_step_times */
  showTimes: boolean
}>()

const emit = defineEmits<{ 'update:modelValue': [StepInput[]] }>()

const increments = computed(() => incrementalWater(props.modelValue))
const orderHints = computed(() => waterOrderHints(props.modelValue))
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
            {{ step.stepType === 'bloom' ? '悶蒸' : `第 ${index} 段` }}
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
                ? { color: 'var(--on-accent-wash)', background: 'var(--accent-wash)', minHeight: 'var(--touch-min)', minWidth: 'var(--touch-min)' }
                : { color: 'var(--text-muted)', minHeight: 'var(--touch-min)', minWidth: 'var(--touch-min)' }"
              :aria-pressed="step.stepType === 'stir'"
              :aria-label="`把第 ${index} 段標成攪拌`"
              @click="setStir(index, step.stepType !== 'stir')"
            >
              <StirIcon />
            </button>
            <button
              v-if="step.stepType !== 'bloom'"
              type="button"
              class="shrink-0"
              :style="{ color: 'var(--text-muted)', minHeight: 'var(--touch-min)', minWidth: 'var(--touch-min)' }"
              :aria-label="`刪除第 ${index} 段`"
              @click="removeStep(index)"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" class="mx-auto">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
              </svg>
            </button>
          </div>
        </div>

        <!-- 兩欄格線讓兩個輸入框與標籤上下對齊。時間欄位關閉時仍保留兩欄，
             水量輸入框維持同樣寬度，不會因為開關而變成一整條 -->
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
          <div v-if="showTimes">
            <label class="block text-xs text-muted" :for="`step-hold-${index}`">停留</label>
            <NumberField
              :id="`step-hold-${index}`"
              :model-value="step.holdSeconds"
              unit="秒"
              integer
              class="mt-1"
              @update:model-value="patch(index, { holdSeconds: $event })"
            />
            <!-- 定義只寫在第一段：每一段的意思都一樣，逐列重複同一句話是雜訊，
                 在手機上每列還多佔一行。悶蒸永遠是第一段且不可刪，說明不會消失 -->
            <p v-if="index === 0" class="mt-1 text-xs text-muted">到下一段注水前的時間</p>
          </div>
        </div>

        <!-- 累積水量遞減的提示。只提示不阻擋儲存，用 --text-muted 而非
             --danger：這不是錯誤，是「看起來不太對」。 -->
        <p v-if="orderHints[index]" class="mt-2 text-xs text-muted">
          {{ orderHints[index] }}
        </p>

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
      :style="{ borderColor: 'var(--border)', color: 'var(--accent)', minHeight: 'var(--touch-min)' }"
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
