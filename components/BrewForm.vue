<script setup lang="ts">
// 沖煮紀錄表單，/brews/new 與 /brews/[id]/edit 共用（《02-功能規格》§5）。
//
// 唯一必填是 dose。其他欄位一律可空，不加必填驗證。
//
// L1／L2 的判斷原則不是重要與否，而是變動頻率：重要但幾乎不變的欄位
// （濾紙、分享壺）交給預設值處理，不佔版面。

const props = defineProps<{
  initial?: Partial<BrewFormValues>
  initialSteps?: StepInput[]
  initialFlavorTagIds?: string[]
  submitLabel: string
  busy?: boolean
  error?: string
}>()

const emit = defineEmits<{
  submit: [payload: {
    values: BrewFormValues
    steps: StepInput[]
    flavorTagIds: string[]
    formDurationSeconds: number
  }]
}>()

const supabase = useSupabaseClient()

// 產品指標（§9）：表單開啟到成功送出的秒數，使用者不可見
const openedAt = Date.now()

const values = reactive<BrewFormValues>({
  bean_id: props.initial?.bean_id ?? null,
  brew_method_id: props.initial?.brew_method_id ?? null,
  dose: props.initial?.dose ?? null,
  water_temp: props.initial?.water_temp ?? null,
  grinder_id: props.initial?.grinder_id ?? null,
  grind_setting: props.initial?.grind_setting ?? null,
  dripper_id: props.initial?.dripper_id ?? null,
  kettle_id: props.initial?.kettle_id ?? null,
  filter_id: props.initial?.filter_id ?? null,
  server_id: props.initial?.server_id ?? null,
  total_time: props.initial?.total_time ?? null,
  brewed_at: props.initial?.brewed_at ?? toLocalInput(new Date()),
  is_favorite: props.initial?.is_favorite ?? false,
  tasting_notes: props.initial?.tasting_notes ?? '',
  intensity: props.initial?.intensity ?? {},
})

const steps = ref<StepInput[]>(props.initialSteps ?? initialSteps())
const flavorTagIds = ref<string[]>(props.initialFlavorTagIds ?? [])
const totalTimeText = ref(secondsToClock(props.initial?.total_time ?? null))

const doseError = ref('')
const summaryError = ref('')

// 器材：新增時各類型的預設器材自動帶入
const equipment = ref<EquipmentOption[]>([])
const methods = ref<{ id: string; name: string }[]>([])

onMounted(async () => {
  const [equipmentResult, methodResult] = await Promise.all([
    supabase
      .from('user_equipment')
      .select('id, type, custom_name, is_default, catalog_id, equipment_catalog ( brand, model, variant, grind_scale_min, grind_scale_max, grind_scale_increment, grind_scale_suggested_min, grind_scale_suggested_max, grind_scale_note )')
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true })
      .order('id', { ascending: true }),
    supabase.from('brew_methods').select('id, name').order('sort_order').order('name'),
  ])
  equipment.value = (equipmentResult.data ?? []) as unknown as EquipmentOption[]
  methods.value = (methodResult.data ?? []) as unknown as { id: string; name: string }[]

  // 只在新增（沒有初始值）時帶入預設，編輯既有紀錄不覆蓋使用者當初的選擇
  if (!props.initial) {
    for (const item of equipment.value) {
      if (!item.is_default) continue
      if (item.type === 'grinder' && !values.grinder_id) values.grinder_id = item.id
      if (item.type === 'dripper' && !values.dripper_id) values.dripper_id = item.id
      if (item.type === 'kettle' && !values.kettle_id) values.kettle_id = item.id
      if (item.type === 'filter' && !values.filter_id) values.filter_id = item.id
      if (item.type === 'server' && !values.server_id) values.server_id = item.id
    }
  }
})

const selectedGrinder = computed(() =>
  equipment.value.find(item => item.id === values.grinder_id) ?? null,
)
const grindSpec = computed<GrindScaleSpec>(() => {
  const c = selectedGrinder.value?.equipment_catalog
  if (!c) return emptyGrindScale
  return {
    min: c.grind_scale_min,
    max: c.grind_scale_max,
    increment: c.grind_scale_increment,
    suggestedMin: c.grind_scale_suggested_min,
    suggestedMax: c.grind_scale_suggested_max,
    note: c.grind_scale_note,
  }
})

// 粉水比即時顯示。衍生值，不可編輯、不存資料庫。
const water = computed(() => totalWater(steps.value))
const ratio = computed(() => brewRatioLabel(water.value, values.dose))

watch(totalTimeText, (value) => {
  values.total_time = clockToSeconds(value)
})

function submit() {
  doseError.value = values.dose === null ? '粉重要填，其他都可以之後再說' : ''
  if (doseError.value) {
    summaryError.value = '還沒存起來：上面的粉重還沒填。'
    return
  }
  summaryError.value = ''
  emit('submit', {
    values: { ...values },
    steps: steps.value,
    flavorTagIds: flavorTagIds.value,
    formDurationSeconds: Math.max(0, Math.round((Date.now() - openedAt) / 1000)),
  })
}

const inputStyle = {
  borderColor: 'var(--border)',
  background: 'var(--surface)',
  minHeight: '44px',
}
</script>

<template>
  <form novalidate @submit.prevent="submit">
    <!-- 區塊一：豆子與手法 -->
    <BeanSelect v-model="values.bean_id" />

    <div class="mt-5">
      <label class="block text-sm" for="brew-method">沖煮手法</label>
      <select
        id="brew-method"
        v-model="values.brew_method_id"
        class="mt-1 block w-full rounded-sm border px-3 py-2.5"
        :style="{ ...inputStyle, color: values.brew_method_id ? 'var(--text)' : 'var(--text-muted)' }"
      >
        <option :value="null">選填</option>
        <option v-for="method in methods" :key="method.id" :value="method.id">{{ method.name }}</option>
      </select>
      <p v-if="!methods.length" class="mt-1 text-xs text-muted">手法的分段模板還沒建立</p>
    </div>

    <!-- 區塊二：核心參數 -->
    <div class="mt-5">
      <label class="block text-sm" for="brew-dose">
        粉重
        <span :style="{ color: 'var(--danger)' }" aria-hidden="true">*</span>
        <span class="sr-only">必填</span>
      </label>
      <NumberField id="brew-dose" v-model="values.dose" unit="g" />
      <p v-if="ratio" class="mt-1 text-xs tabular-nums text-muted">粉水比 {{ ratio }}</p>
      <p v-if="doseError" class="mt-2 text-sm" :style="{ color: 'var(--danger)' }">{{ doseError }}</p>
    </div>

    <div class="mt-5">
      <label class="block text-sm" for="brew-temp">水溫</label>
      <NumberField id="brew-temp" v-model="values.water_temp" unit="°C" integer />
    </div>

    <div class="mt-5">
      <EquipmentSelect v-model="values.grinder_id" label="磨豆機" type="grinder" :options="equipment" />
    </div>

    <div class="mt-5">
      <GrindSettingInput
        v-model="values.grind_setting"
        :spec="grindSpec"
        :has-catalog="!!selectedGrinder?.catalog_id"
      />
    </div>

    <div class="mt-5">
      <EquipmentSelect v-model="values.dripper_id" label="濾杯" type="dripper" :options="equipment" />
    </div>

    <div class="mt-5">
      <EquipmentSelect v-model="values.kettle_id" label="手沖壺" type="kettle" :options="equipment" />
    </div>

    <div class="mt-5">
      <label class="block text-sm" for="brew-total-time">總沖煮時間</label>
      <input
        id="brew-total-time"
        v-model="totalTimeText"
        type="text"
        inputmode="numeric"
        placeholder="2:30"
        class="mt-1 block w-full rounded-sm border px-3 py-2.5 tabular-nums"
        :style="inputStyle"
      >
      <p class="mt-1 text-xs text-muted">分:秒，以下壺滴完為準</p>
    </div>

    <div class="mt-5">
      <label class="block text-sm" for="brew-at">沖煮時間</label>
      <input
        id="brew-at"
        v-model="values.brewed_at"
        type="datetime-local"
        class="mt-1 block w-full rounded-sm border px-3 py-2.5"
        :style="inputStyle"
      >
    </div>

    <CollapsibleSection title="其他器材" storage-key="brewForm.equipment.expanded">
      <EquipmentSelect v-model="values.filter_id" label="濾紙" type="filter" :options="equipment" />
      <div class="mt-5">
        <EquipmentSelect v-model="values.server_id" label="分享壺" type="server" :options="equipment" />
      </div>
    </CollapsibleSection>

    <!-- 區塊三：分段注水 -->
    <div class="mt-8">
      <PourStepsEditor v-model="steps" :dose="values.dose" />
    </div>

    <!-- 區塊四：品飲 -->
    <div class="mt-8">
      <ToggleSwitch v-model="values.is_favorite" label="這杯好喝" />
    </div>

    <div class="mt-6">
      <IntensityPicker v-model="values.intensity" />
    </div>

    <div class="mt-6">
      <label class="block text-sm" for="brew-notes">心得筆記</label>
      <textarea
        id="brew-notes"
        v-model="values.tasting_notes"
        rows="3"
        class="mt-1 block w-full rounded-sm border px-3 py-2.5"
        :style="{ borderColor: 'var(--border)', background: 'var(--surface)' }"
      />
    </div>

    <CollapsibleSection title="風味標籤" storage-key="brewForm.flavor.expanded">
      <FlavorTagPicker v-model="flavorTagIds" />
    </CollapsibleSection>

    <button
      type="submit"
      :disabled="busy"
      class="mt-8 w-full rounded-sm px-4 py-3 font-medium disabled:opacity-60"
      :style="{ background: 'var(--accent)', color: '#FFFFFF', minHeight: '44px' }"
    >
      {{ busy ? '儲存中' : submitLabel }}
    </button>

    <p
      v-if="error || summaryError"
      role="alert"
      class="mt-3 rounded-sm border px-3 py-3 text-sm"
      :style="{ color: 'var(--danger)', borderColor: 'var(--danger)' }"
    >
      {{ error || summaryError }}
    </p>
  </form>
</template>
