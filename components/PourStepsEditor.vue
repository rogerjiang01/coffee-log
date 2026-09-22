<script setup lang="ts">
// 分段注水編輯器（《03-介面規範》§4.4、《02-功能規格》§5 區塊三）。
//
// 介面輸入的是「注到幾克」與「停幾秒」，兩個都原樣存進資料庫（沒有換算層）。
// 寫入由 utils/brewSteps.ts 的 toStepRows 負責，這個元件只管介面。
//
// 悶蒸沒有單獨的區塊：它與其他段落在同一份清單裡，差別只有三處，
// 全部由 step_type = 'bloom' 決定——標題叫「悶蒸」、不能刪除、不能標攪拌。
// 資料層它就是 step_index = 1 的一般段落，沒有獨立欄位。
// 沒有悶蒸的分段（四六法）第一段是一般段落，可刪、可標攪拌，從「第 1 段」數起。
//
// 悶蒸與其他段落用同一套卡片外觀，靠標題與間距區隔，不靠不同的底色——
// 兩種卡片樣式並存會讓同一份清單看起來像兩種東西。
//
// **「停留」＝注完之後到下一注之前的停水時間**，不含注水動作本身。
// 舊定義是「這段開始注水到下一段開始注水」的全部時間，兩位實機測試者都
// 填不出來——那要求他記得注水花了幾秒，而給水速率依器材與手法而異、
// 還有行動誤差，他無法預期。停水時間則可以預期，也是他真正在調整的東西。
// 標籤仍叫「停留」，那是咖啡圈的通用說法；意思靠第一段下方那一行說明。
//
// **最後一段不顯示這一格。** 最後一注之後沒有下一注，「停水」這件事不存在；
// 剩下的只是等它滴完，那段時間由沖煮時間記錄。舊版在那裡顯示
// 「total_time 減掉最後一段時間點」的反推值，測試者看到「停 106 秒」
// 當場說「這邏輯錯了」。
//
// **切換入口放在標題列右側，用文字連結不用 toggle。**
// 表單裡已經有 toggle 的先例（豆子的「已喝完」），那是「這筆資料的一個欄位」。
// 分段區再出現一個 toggle，使用者會解讀成「這筆紀錄要不要記時間」——
// 但它是全域偏好，會影響之後所有紀錄。同一個控制項在同一個表單裡代表
// 兩種性質就是語意混淆。而且依《03》§4.0，這個開關一旦決定幾乎不會再動，
// 不該佔常駐控制項的視覺重量。
//
// 文字連結的缺陷是它看起來像一次性動作、實際會被記住，所以開啟之後在分段區
// 下方回饋一行「之後的紀錄都會有時間欄位」。與器材「常用」同構：
// 副作用在動作之後回饋，不在動作之前警告。
//
// 偏好本身由父層（BrewForm）持有並寫入，這裡只發事件——兩個地方各自
// useRecordStepTimes 會變成兩份狀態，寫入之後就對不起來了。
//
// **時間欄位由使用者偏好決定要不要顯示**（標題列的切換入口，預設關閉）。
// 關閉只是不顯示，不改資料：holdSeconds 照樣留在 modelValue 裡，儲存時照樣
// 原樣寫進 hold_seconds。編輯一筆已有時間的紀錄、手法模板帶入的時間，
// 都不會因為欄位藏起來而被清空——這個元件從不寫 holdSeconds，除非使用者輸入。

const props = defineProps<{
  modelValue: StepInput[]
  dose: number | null
  /** 顯示停水時間欄位。來自使用者偏好 profiles.record_step_times */
  showTimes: boolean
  /** 偏好還沒讀到、或正在寫入：切換入口先不可按 */
  timesPending?: boolean
  /** 剛切換成開啟時的回饋，說明它會影響之後的紀錄 */
  timesNotice?: string
  /** 偏好沒存成功時的訊息 */
  timesError?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [StepInput[]]
  /** 切換「記錄停水時間」。偏好由父層持有，這裡不自己去讀寫 */
  'toggleTimes': []
}>()

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
    <!-- 切換入口在標題列右側，而且是唯一入口：想記時間的那一刻就在填表當下。
         文字連結不用 toggle，理由見檔頭。 -->
    <div class="flex items-center justify-between gap-3">
      <p class="text-sm">分段注水</p>
      <button
        type="button"
        :disabled="timesPending"
        class="shrink-0 px-1 text-sm underline disabled:opacity-60"
        :style="{ color: 'var(--accent)', minHeight: 'var(--touch-min)' }"
        @click="emit('toggleTimes')"
      >
        {{ showTimes ? '不記停水時間' : '記錄停水時間' }}
      </button>
    </div>

    <ul class="mt-2">
      <li
        v-for="(step, index) in modelValue"
        :key="index"
        class="step-row py-3"
      >
        <div class="flex items-center justify-between gap-3">
          <p class="text-sm font-medium">
            {{ stepLabel(modelValue, index) }}
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
              :aria-label="`把${stepLabel(modelValue, index)}標成攪拌`"
              @click="setStir(index, step.stepType !== 'stir')"
            >
              <StirIcon />
            </button>
            <button
              v-if="step.stepType !== 'bloom'"
              type="button"
              class="shrink-0"
              :style="{ color: 'var(--text-muted)', minHeight: 'var(--touch-min)', minWidth: 'var(--touch-min)' }"
              :aria-label="`刪除${stepLabel(modelValue, index)}`"
              @click="removeStep(index)"
            >
              <svg
                width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" class="mx-auto"
                fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
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
          <!-- 最後一段不顯示：最後一注之後沒有下一注，沒有「停水」這件事 -->
          <div v-if="showTimes && index < modelValue.length - 1">
            <label class="block text-xs text-muted" :for="`step-hold-${index}`">停留</label>
            <NumberField
              :id="`step-hold-${index}`"
              :model-value="step.holdSeconds"
              unit="秒"
              integer
              class="mt-1"
              @update:model-value="patch(index, { holdSeconds: $event })"
            />
            <!-- 說明只寫在第一段：每一段的意思都一樣，逐列重複同一句話是雜訊，
                 在手機上每列還多佔一行。跟著 index 走不跟著段落走：第一段被刪掉（四六法的第一段可刪），
                 說明移到新的第一段，不會消失 -->
            <p v-if="index === 0" class="mt-1 text-xs text-muted">停水時間</p>
          </div>
        </div>

        <!--
          累積水量遞減的提示。**刻意維持提示、不阻擋儲存**，之後也不要改成擋：
          我們無權判定使用者填錯——他可能在記一個我們沒想過的沖法，
          也可能想先存起來之後再改。「所有驗證只提示不阻擋」這條沒有例外。

          文案講該填什麼，不講「你填錯了」：最常見的原因是把這一注的水量
          當成累積水量填進來，而磅秤上顯示的就是累積值。

          顏色是 --notice：針對這次填的值出現、但存得起來（《03》§4.1）。
        -->
        <p v-if="orderHints[index]" class="mt-2 text-xs" :style="{ color: 'var(--notice)' }">
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
          :aria-label="`${stepLabel(modelValue, index)}的備註`"
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

    <!-- 切換之後的回饋：這個連結看起來像一次性動作，實際會被記住 -->
    <p v-if="timesNotice" role="status" class="mt-2 text-sm text-muted">{{ timesNotice }}</p>
    <p v-if="timesError" role="alert" class="mt-2 text-sm" :style="{ color: 'var(--danger)' }">{{ timesError }}</p>
  </section>
</template>

<style scoped>
/* 分段之間用分隔線，不用巢狀卡片——外層已經是分組卡片了 */
.step-row + .step-row {
  border-top: 1px solid var(--border);
}
</style>
