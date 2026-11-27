<script setup lang="ts">
// 紀錄的唯讀內容：器材、沖煮、品飲三段（紀錄詳情與分享頁共用；《03》§4.22）。
//
// **紀錄詳情＝記錄表單的唯讀版**（2026-11-25）：外觀沿用表單的 FormSection（Heading L 的標題）、FormCard 與 Sheet Row，
// 但不能看起來可以點——沒有箭頭、hover、pointer、按下狀態。**同一段只放一張卡**。
// 兩頁用這一個元件，順序與樣式只有一份；分享頁多的「豆子」段、詳情頁多的比較區由各自的頁面放在前後。
//
// 根是三個 section（fragment）：呼叫端的容器用 --gap-section 排段落之間的間距，和 BrewForm 一樣。
//
// 列的規則：
// - **有填才有該列**；一張卡裡每一列都沒填時，連卡片和段落標題一起不顯示
// - 單位直接接在數值後面（「15 g」「92 °C」），所有值對齊卡片右緣
// - 有分段時，沖煮卡片的最後是分段：標題列是沖煮手法名稱（沒有手法時寫「分段注水」），每一段有增量水量。
//   沒有分段但有手法時，手法是一般列「沖煮手法」
// - 強度：四項有一項有值就四項全部顯示，沒填的寫「—」（IntensityDisplay）
// - 風味：唯讀標籤（ChoiceChip 的 readonly），靠右排、放不下換行；這一列是 65px（裡面有膠囊）
// - 心得：值靠左、保留換行

const props = defineProps<{
  /** 器材的顯示名稱（型錄是「品牌 · 型號 版本」，自建是自建名稱）。沒有就是 null */
  grinder: string | null
  grindSetting: number | null
  dripper: string | null
  kettle: string | null
  /** 分享頁的讀取函式沒有回傳濾紙與分享壺：不傳就沒有這兩列 */
  filter?: string | null
  server?: string | null
  dose: number | null
  waterTemp: number | null
  totalTime: number | null
  methodName: string | null
  /** 已經併掉攪拌段的分段（withoutStir） */
  steps: StepInput[]
  intensity: Intensity | null
  flavorTags: string[]
  notes: string | null
}>()

const water = computed(() => totalWater(props.steps))
const ratio = computed(() => brewRatioLabel(water.value, props.dose))
const hasSteps = computed(() => props.steps.some(step => step.cumulativeWater !== null))

type Row = { label: string, value: string | null }
const filled = (rows: Row[]) => rows.filter((row): row is { label: string, value: string } => !!row.value)

const equipmentRows = computed(() => filled([
  { label: '磨豆機', value: props.grinder },
  { label: '研磨刻度', value: props.grindSetting === null ? null : String(props.grindSetting) },
  { label: '濾杯', value: props.dripper },
  { label: '手沖壺', value: props.kettle },
  { label: '濾紙', value: props.filter ?? null },
  { label: '分享壺', value: props.server ?? null },
]))

const brewRows = computed(() => filled([
  { label: '粉重', value: props.dose === null ? null : `${props.dose} g` },
  { label: '總水量', value: water.value === null ? null : `${water.value} g` },
  { label: '粉水比', value: ratio.value },
  { label: '水溫', value: props.waterTemp === null ? null : `${props.waterTemp} °C` },
  { label: '沖煮時間', value: props.totalTime === null ? null : secondsToClock(props.totalTime) },
  // 有分段時手法名稱是分段的標題，不另外一列
  { label: '沖煮手法', value: hasSteps.value ? null : props.methodName },
]))

// 資料不補 0：沒填就是沒有那個 key（IntensityDisplay）
const hasIntensity = computed(() =>
  INTENSITY_DIMENSIONS.some(({ key }) => typeof props.intensity?.[key] === 'number'))
const notes = computed(() => props.notes?.trim() ? props.notes : null)
const hasTasting = computed(() => hasIntensity.value || props.flavorTags.length > 0 || notes.value !== null)
</script>

<template>
  <FormSection v-if="equipmentRows.length" title="器材">
    <FormCard>
      <dl>
        <ReadonlyRow v-for="row in equipmentRows" :key="row.label" :label="row.label">{{ row.value }}</ReadonlyRow>
      </dl>
    </FormCard>
  </FormSection>

  <FormSection v-if="brewRows.length || hasSteps" title="沖煮">
    <FormCard>
      <dl>
        <ReadonlyRow v-for="row in brewRows" :key="row.label" :label="row.label">{{ row.value }}</ReadonlyRow>
        <!-- 和記錄表單的分段摘要同一種寫法（PourStepsSummary 的 readonly：手法名稱的標題列，加上 PourStepList） -->
        <PourStepsSummary v-if="hasSteps" :steps="steps" :method-name="methodName" readonly />
      </dl>
    </FormCard>
  </FormSection>

  <FormSection v-if="hasTasting" title="品飲">
    <FormCard>
      <dl>
        <IntensityDisplay v-if="hasIntensity && intensity" :intensity="intensity" />
        <ReadonlyRow v-if="flavorTags.length" label="風味" tall>
          <ul class="flex min-w-0 flex-1 flex-wrap justify-end gap-2">
            <li v-for="tag in flavorTags" :key="tag">
              <ChoiceChip readonly>{{ tag }}</ChoiceChip>
            </li>
          </ul>
        </ReadonlyRow>
        <ReadonlyRow v-if="notes" label="心得" start>{{ notes }}</ReadonlyRow>
      </dl>
    </FormCard>
  </FormSection>
</template>
