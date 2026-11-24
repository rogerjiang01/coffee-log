<script setup lang="ts">
// 分段注水的編輯子頁（《02》§5、《03》§4.4，Figma 的「沖煮詳細頁」）。
//
// 全螢幕浮層，和器材選擇器同一套機制（原生 <dialog> 的 showModal、useOverlayHistory）：
// **Android 的返回鍵與 iOS 的返回手勢只關掉這一層，不會離開表單。**
// 改動即時寫回表單（v-model），沒有另外的儲存鈕；表單的狀態與暫存因此不必跨頁搬。
// 右上角的「完成」（DoneButton，2026-11-17）和左上的 ‹ 做一樣的事：關掉子頁、改動留在表單上，
// 要等表單的「儲存」才寫進資料庫。加它是因為對使用者來說返回不像「完成」。名稱是「完成」不是「儲存」。
//
// 介面輸入的是累積水量與停水時長，兩個都原樣存進資料庫（沒有換算層）。
// 寫入由 utils/brewSteps.ts 的 toStepRows 負責，這個元件只管介面。
//
// 由上到下：
//   標題列      ‹ 返回、「分段注水」、右上角「完成」
//   沖煮手法    下拉。選了會依粉重帶入分段（由表單處理）
//   記錄停水時長  開關，自己一張卡片（膠囊形）。切換的回饋與錯誤在卡片下方
//   每一段      卡片上方一列：段名、增量水量、垃圾桶（悶蒸不能刪）；卡片裡是累積水量、停水時長、備註
//   新增一段    下面的小字是總水量與粉水比
//
// 悶蒸沒有單獨的區塊：它與其他段落在同一份清單裡，差別只有標題叫「悶蒸」、不能刪除，
// 全部由 step_type = 'bloom' 決定。沒有悶蒸的分段（四六法）第一段是一般段落，從「第 1 段」數起。
//
// **停水時長＝注完之後到下一注之前的時間**，不含注水動作本身。
// **最後一段沒有這一列**：最後一注之後沒有下一注，剩下的只是等它滴完，那段時間由沖煮時間記錄。
//
// **「記錄停水時長」是開關**（2026-11-17；原本是標題列右側的文字連結，移走是為了不和「完成」擠在一起）。
// 它是全域偏好，會影響之後所有紀錄，切換時立刻寫進 profiles（不等表單儲存）；
// 切換之後沒有回饋（2026-11-17 拿掉開啟後的那一句）：開關的位置與出現、消失的那一列已經說明了。
// 卡片下方只有沒存成功時的錯誤。偏好由表單持有並寫入，這裡只發事件。
// 關閉只是不顯示，不改資料：holdSeconds 照樣留在 modelValue 裡，儲存時照樣寫進 hold_seconds。
//
// 攪拌標記已經移除（2026-11-16）：需要的話寫在備註。

const props = defineProps<{
  open: boolean
  modelValue: StepInput[]
  dose: number | null
  methodId: string | null
  methods: { id: string, name: string }[]
  /** 手法帶入時的提示（邊界保護），不擋儲存 */
  methodNotice?: string
  /** 顯示停水時長欄位。來自使用者偏好 profiles.record_step_times */
  showTimes: boolean
  /** 偏好還沒讀到、或正在寫入：切換入口先不可按 */
  timesPending?: boolean
  /** 偏好沒存成功時的訊息 */
  timesError?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [StepInput[]]
  'update:methodId': [string | null]
  /** 切換「記錄停水時長」。偏好由父層持有，這裡不自己去讀寫 */
  'toggleTimes': []
  'close': []
}>()

const dialog = ref<HTMLDialogElement | null>(null)

// 返回鍵與返回手勢：只關這一層（《03》§3）
useOverlayHistory(() => props.open, () => emit('close'))

watch(() => props.open, (open) => {
  // showModal() 要等 <dialog> 真的進到 DOM 才叫得動
  nextTick(() => {
    const el = dialog.value
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  })
}, { immediate: true })

// 手法下拉的膠囊文字（SelectField）：沒選時是 null，膠囊寫「選填」
const methodName = computed(() => props.methods.find(m => m.id === props.methodId)?.name ?? null)

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
</script>

<template>
  <dialog
    ref="dialog"
    class="sheet"
    aria-label="分段注水"
    @cancel.prevent="emit('close')"
  >
    <div class="flex flex-col" :style="{ background: 'var(--bg)' }">
      <header
        class="flex shrink-0 items-center gap-2 border-b px-3 py-2"
        :style="{ borderColor: 'var(--border)' }"
      >
        <button
          type="button"
          :style="{ minHeight: 'var(--touch-min)', minWidth: 'var(--touch-min)' }"
          aria-label="返回"
          @click="emit('close')"
        >
          <svg
            width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" class="mx-auto"
            fill="none" stroke="currentColor" stroke-width="2.18" stroke-linecap="round" stroke-linejoin="round"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>

        <h2 class="flex-1 truncate text-heading-m font-medium">分段注水</h2>

        <!-- 完成：和 ‹ 一樣只關掉子頁，不寫資料庫（見檔頭） -->
        <DoneButton @click="emit('close')" />
      </header>

      <div class="min-h-0 flex-1 overflow-y-auto">
        <div class="mx-auto flex flex-col pt-6 pb-16" :style="{ maxWidth: 'var(--content-max)', gap: 'var(--gap-section)', paddingInline: 'var(--form-gutter)' }">
          <!-- 沖煮手法與記錄停水時長是同一組（這一杯怎麼記），卡片之間 --gap-group -->
          <div class="flex flex-col" :style="{ gap: 'var(--gap-group)' }">
          <!-- 下拉（膠囊）：65px 的列，卡片圓角 32.5px（tall） -->
          <FormCard pill tall>
            <FormRow label="沖煮手法" for="brew-method" tall>
              <SelectField :text="methodName ?? '選填'" :empty="!methodName">
                <select
                  id="brew-method"
                  :value="methodId"
                  @change="emit('update:methodId', ($event.target as HTMLSelectElement).value || null)"
                >
                  <option value="">選填</option>
                  <option v-for="method in methods" :key="method.id" :value="method.id">{{ method.name }}</option>
                </select>
              </SelectField>
            </FormRow>
            <template v-if="methods.length">
              <FormNote>選擇沖煮手法會依粉重帶入分段</FormNote>
              <!-- 內建手法的分段模板數值尚未經實機核實（見 CLAUDE.md 階段備註）。
                   在核實之前先講清楚它是參考值，避免使用者當成標準答案照做。 -->
              <FormNote>內建沖煮手法為參考框架，實際水量請依自己的器材與豆子調整</FormNote>
            </template>
            <!-- 不擋儲存，所以是 --notice 不是 --danger（《03》§4.1） -->
            <FormNote v-if="methodNotice" tone="notice">{{ methodNotice }}</FormNote>
          </FormCard>

          <!-- 記錄停水時長：開關一張卡片（膠囊形）。切換的回饋與錯誤照規則放在卡片下方 -->
          <FormCard pill>
            <FormRow>
              <ToggleSwitch
                :model-value="showTimes"
                label="記錄停水時長"
                row
                :busy="timesPending"
                @update:model-value="emit('toggleTimes')"
              />
            </FormRow>
            <FormNote v-if="timesError" tone="error">{{ timesError }}</FormNote>
          </FormCard>
          </div>

          <ul class="flex flex-col" :style="{ gap: 'var(--gap-group)' }">
            <li v-for="(step, index) in modelValue" :key="index">
              <!-- 卡片上方的一列：段名、這一段的增量水量、垃圾桶 -->
              <div class="card-pad-x mb-2 flex min-h-11 items-center gap-3">
                <p class="flex-1 text-heading-m font-medium text-muted">{{ stepLabel(modelValue, index) }}</p>
                <!-- 增量水量：幫使用者確認自己填對了 -->
                <span
                  v-if="increments[index] !== null"
                  class="text-heading-m tabular-nums"
                  :style="{ color: 'var(--accent-text)' }"
                >+ {{ increments[index] }} g</span>
                <!-- 移除這一段：垃圾桶（Lucide 的 trash-2，《03》§3）。顏色是 --icon-muted（3.47:1） -->
                <button
                  v-if="step.stepType !== 'bloom'"
                  type="button"
                  class="-mr-3 shrink-0"
                  :style="{ color: 'var(--icon-muted)', minHeight: 'var(--touch-min)', minWidth: 'var(--touch-min)' }"
                  :aria-label="`刪除${stepLabel(modelValue, index)}`"
                  @click="removeStep(index)"
                >
                  <svg
                    width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" class="mx-auto"
                    fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"
                  >
                    <path d="M10 11v6" />
                    <path d="M14 11v6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                    <path d="M3 6h18" />
                    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
                <!-- 悶蒸不能刪：留一格同樣寬的空位，增量水量才會和其他段對齊 -->
                <span v-else class="w-8 shrink-0" aria-hidden="true" />
              </div>

              <FormCard>
                <FormRow label="累積水量" :for="`step-water-${index}`">
                  <NumberField
                    :id="`step-water-${index}`"
                    :model-value="step.cumulativeWater"
                    unit="g"
                    @update:model-value="patch(index, { cumulativeWater: $event })"
                  />
                </FormRow>
                <!--
                  累積水量遞減的提示。**刻意維持提示、不阻擋儲存**，之後也不要改成擋：
                  我們無權判定使用者填錯——他可能在記一個我們沒想過的沖法，也可能想先存起來之後再改。
                  文案講該填什麼，不講「你填錯了」。顏色是 --notice（《03》§4.1）。
                -->
                <FormNote v-if="orderHints[index]" tone="notice">{{ orderHints[index] }}</FormNote>

                <!-- 最後一段不顯示：最後一注之後沒有下一注，沒有「停水」這件事 -->
                <FormRow v-if="showTimes && index < modelValue.length - 1" label="停水時長" :for="`step-hold-${index}`">
                  <NumberField
                    :id="`step-hold-${index}`"
                    :model-value="step.holdSeconds"
                    unit="秒"
                    integer
                    @update:model-value="patch(index, { holdSeconds: $event })"
                  />
                </FormRow>

                <FormRow label="備註" :for="`step-note-${index}`">
                  <SheetText
                    :id="`step-note-${index}`"
                    :model-value="step.note"
                    placeholder="選填"
                    @update:model-value="patch(index, { note: $event ?? '' })"
                  />
                </FormRow>
              </FormCard>
            </li>
          </ul>

          <div>
            <AppButton variant="outline" block @click="addStep">
              新增一段
            </AppButton>
            <!-- 總水量與粉水比都是衍生值，不設輸入欄位、不存資料庫 -->
            <p v-if="water !== null" class="form-note card-pad-x mt-1.5">
              <span>總水量 {{ water }} g</span><span v-if="ratio">粉水比 {{ ratio }}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  </dialog>
</template>
