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
  rating: props.initial?.rating ?? null,
  is_favorite: props.initial?.is_favorite ?? false,
  tasting_notes: props.initial?.tasting_notes ?? '',
  intensity: props.initial?.intensity ?? {},
})

const steps = ref<StepInput[]>(props.initialSteps ?? initialSteps())

// 全頁器材選擇器：整個流程留在這一頁，沖煮表單已填的內容完全不動
const pickerType = ref<EquipmentType | null>(null)
const equipmentFields: { type: EquipmentType; label: string; key: keyof BrewFormValues }[] = [
  { type: 'grinder', label: '磨豆機', key: 'grinder_id' },
  { type: 'dripper', label: '濾杯', key: 'dripper_id' },
  { type: 'kettle', label: '手沖壺', key: 'kettle_id' },
  { type: 'filter', label: '濾紙', key: 'filter_id' },
  { type: 'server', label: '分享壺', key: 'server_id' },
]

function equipmentName(id: string | null) {
  if (!id) return null
  const item = equipment.value.find(entry => entry.id === id)
  return item ? equipmentOptionName(item) : null
}

const pickerValue = computed<string | null>({
  get: () => {
    const field = equipmentFields.find(entry => entry.type === pickerType.value)
    return field ? (values[field.key] as string | null) : null
  },
  set: (next) => {
    const field = equipmentFields.find(entry => entry.type === pickerType.value)
    if (field) (values[field.key] as string | null) = next
  },
})
const flavorTagIds = ref<string[]>(props.initialFlavorTagIds ?? [])
const doseError = ref('')
const summaryError = ref('')

// 器材：新增時各類型的預設器材自動帶入
const equipment = ref<EquipmentOption[]>([])
const methods = ref<{ id: string; name: string }[]>([])

async function loadEquipment() {
  const { data } = await supabase
    .from('user_equipment')
    .select('id, type, custom_name, is_default, catalog_id, equipment_catalog ( brand, model, variant, grind_scale_min, grind_scale_max, grind_scale_increment, grind_scale_suggested_min, grind_scale_suggested_max, grind_scale_note )')
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
  equipment.value = (data ?? []) as unknown as EquipmentOption[]
}

onMounted(async () => {
  const [, methodResult] = await Promise.all([
    loadEquipment(),
    supabase.from('brew_methods').select('id, name, default_ratio, step_template').order('sort_order').order('name'),
  ])
  const rows = (methodResult.data ?? []) as unknown as {
    id: string; name: string; default_ratio: number | null; step_template: MethodTemplate | null
  }[]
  methods.value = rows.map(row => ({ id: row.id, name: row.name }))
  methodTemplates.value = new Map(
    rows.map(row => [row.id, { template: row.step_template, ratio: row.default_ratio }]),
  )

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

// 手法選定後依粉重換算並填入分段（§3.7、§5）。
// 手法只是模板來源，帶入後使用者可自由修改，brew_method_id 不變，
// 儲存時也不檢查實際分段是否符合模板。
const methodTemplates = ref<Map<string, { template: MethodTemplate | null; ratio: number | null }>>(new Map())

function applyMethod() {
  const id = values.brew_method_id
  if (!id) return
  const method = methodTemplates.value.get(id)
  if (!method) return
  const filled = stepsFromTemplate(method.template, values.dose, method.ratio)
  if (filled) steps.value = filled
}

// 選了手法就套用；粉重還沒填時，等粉重填好再套用
watch(() => values.brew_method_id, applyMethod)
watch(() => values.dose, () => {
  if (values.brew_method_id && steps.value.every(step => step.cumulativeWater === null)) applyMethod()
})

// 養豆天數＝沖煮時間 − 烘焙日期。衍生值，不存資料庫；
// 豆子沒有烘焙日期時不顯示，不阻擋也不報錯。
const selectedBeanRoastDate = ref<string | null>(null)
const restedDays = computed(() =>
  restDays(selectedBeanRoastDate.value, new Date(values.brewed_at || Date.now())),
)

// 粉水比即時顯示。衍生值，不可編輯、不存資料庫。
const water = computed(() => totalWater(steps.value))
const ratio = computed(() => brewRatioLabel(water.value, values.dose))

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
  minHeight: '44px',
}
</script>

<template>
  <form novalidate class="space-y-6" @submit.prevent="submit">
    <!-- 時間戳最前面：事後補記時可能要先改日期，越早改完，
         後面的填寫都在正確的時間脈絡下。 -->
    <FormCard title="這一杯">
      <FormRow>
        <label class="block text-sm" for="brew-at">沖煮時間</label>
        <!-- datetime-local 的原生內容有自己的最小寬度，w-full 擋不住它撐開容器 -->
        <div class="mt-1 overflow-hidden">
          <input
            id="brew-at"
            v-model="values.brewed_at"
            :data-filled="!!values.brewed_at"
            type="datetime-local"
            class="block w-full min-w-0 max-w-full field py-2.5"
            :style="inputStyle"
          >
        </div>
      </FormRow>
      <FormRow>
        <BeanSelect
          v-model="values.bean_id"
          @selected="selectedBeanRoastDate = $event?.roast_date ?? null"
        />
        <p v-if="restedDays !== null" class="mt-1 text-xs tabular-nums text-muted">
          養豆 {{ restedDays }} 天
        </p>
      </FormRow>
    </FormCard>

    <!-- 研磨刻度緊接磨豆機：刻度的驗證依賴磨豆機型錄，
         兩者分開會讓刻度失去上下文。依賴關係優先於變動頻率。 -->
    <FormCard title="器材">
      <FormRow>
        <EquipmentTrigger
          label="磨豆機"
          :name="equipmentName(values.grinder_id)"
          @open="pickerType = 'grinder'"
        />
      </FormRow>
      <FormRow>
        <GrindSettingInput
          v-model="values.grind_setting"
          :spec="grindSpec"
          :has-catalog="!!selectedGrinder?.catalog_id"
        />
      </FormRow>
      <FormRow>
        <EquipmentTrigger
          label="濾杯"
          :name="equipmentName(values.dripper_id)"
          @open="pickerType = 'dripper'"
        />
      </FormRow>
      <FormRow>
        <EquipmentTrigger
          label="手沖壺"
          :name="equipmentName(values.kettle_id)"
          @open="pickerType = 'kettle'"
        />
      </FormRow>
      <!-- 收合區是這張卡片內部的最後一列，語意明確是「這組裡的次要項目」 -->
      <FormRow divider>
        <CollapsibleSection flat title="濾紙與分享壺" storage-key="brewForm.equipment.expanded">
          <EquipmentTrigger
            label="濾紙"
            :name="equipmentName(values.filter_id)"
            @open="pickerType = 'filter'"
          />
          <div class="mt-5">
            <EquipmentTrigger
              label="分享壺"
              :name="equipmentName(values.server_id)"
              @open="pickerType = 'server'"
            />
          </div>
        </CollapsibleSection>
      </FormRow>
    </FormCard>

    <!-- 手法在粉重與水溫之後、分段之前：手法選定後會依粉重換算並填入分段，
         兩者相隔太遠使用者看不到這件事發生。
         總沖煮時間在分段最下方：最後一段的停留秒數是由 total_time
         減去最後的 time_offset 反推的，資料上與分段直接相關。 -->
    <FormCard title="沖煮">
      <FormRow>
        <label class="block text-sm" for="brew-dose">
          粉重
          <span :style="{ color: 'var(--danger)' }" aria-hidden="true">*</span>
          <span class="sr-only">必填</span>
        </label>
        <NumberField id="brew-dose" v-model="values.dose" unit="g" class="mt-1" />
        <p v-if="ratio" class="mt-1 text-xs tabular-nums text-muted">粉水比 {{ ratio }}</p>
        <p v-if="doseError" class="mt-2 text-sm" :style="{ color: 'var(--danger)' }">{{ doseError }}</p>
      </FormRow>
      <FormRow>
        <label class="block text-sm" for="brew-temp">水溫</label>
        <NumberField id="brew-temp" v-model="values.water_temp" unit="°C" integer class="mt-1" />
      </FormRow>
      <FormRow>
        <label class="block text-sm" for="brew-method">沖煮手法</label>
        <SelectField>
          <select
            id="brew-method"
            v-model="values.brew_method_id"
            :data-filled="values.brew_method_id !== null"
            class="mt-1 block w-full field py-2.5"
            :style="{ ...inputStyle, color: values.brew_method_id ? 'var(--text)' : 'var(--text-muted)' }"
          >
            <option :value="null">選填</option>
            <option v-for="method in methods" :key="method.id" :value="method.id">{{ method.name }}</option>
          </select>
        </SelectField>
        <p v-if="!methods.length" class="mt-1 text-xs text-muted">手法的分段模板還沒建立</p>
        <p v-else class="mt-1 text-xs text-muted">選了手法會依粉重把分段填進下面</p>
      </FormRow>
      <FormRow divider>
        <PourStepsEditor v-model="steps" :dose="values.dose" />
      </FormRow>
      <FormRow>
        <label class="block text-sm" for="brew-total-time">總沖煮時間</label>
        <DurationPicker id="brew-total-time" v-model="values.total_time" class="mt-1" />
      </FormRow>
    </FormCard>

    <FormCard title="喝起來">
      <FormRow divider>
        <IntensityPicker v-model="values.intensity" />
      </FormRow>
      <FormRow divider>
        <CollapsibleSection flat title="風味標籤" storage-key="brewForm.flavor.expanded">
          <FlavorTagPicker v-model="flavorTagIds" />
        </CollapsibleSection>
      </FormRow>
      <FormRow>
        <label class="block text-sm" for="brew-notes">心得筆記</label>
        <textarea
          id="brew-notes"
          v-model="values.tasting_notes"
          :data-filled="!!values.tasting_notes"
          rows="3"
          class="mt-1 block w-full field py-2.5"
        />
      </FormRow>
      <FormRow>
        <StarRating v-model="values.rating" />
      </FormRow>
    </FormCard>

    <!-- 收藏在卡片外：它不是品飲判斷，是「還想不想再沖」的實用決定，
         跟儲存這個動作在同一個心理時刻。 -->
    <div>
      <button
        type="button"
        role="switch"
        :aria-checked="values.is_favorite"
        class="flex w-full items-center justify-between rounded-sm border px-4 py-3"
        :style="{ borderColor: 'var(--border)', background: 'var(--surface)', minHeight: '44px' }"
        @click="values.is_favorite = !values.is_favorite"
      >
        <span>
          收藏
          <span class="ml-2 text-sm text-muted">還想再沖一次</span>
        </span>
        <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 20s-7-4.5-7-9.5A3.5 3.5 0 0112 8a3.5 3.5 0 017 2.5C19 15.5 12 20 12 20z"
            :fill="values.is_favorite ? 'var(--favorite)' : 'transparent'"
            :stroke="values.is_favorite ? 'var(--favorite)' : 'var(--border)'"
            stroke-width="1.5"
            stroke-linejoin="round"
          />
        </svg>
      </button>

      <button
        type="submit"
        :disabled="busy"
        class="mt-3 w-full rounded-sm px-4 py-3 font-medium disabled:opacity-60"
        :style="{ background: 'var(--accent)', color: 'var(--on-accent)', minHeight: '44px' }"
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
    </div>

    <EquipmentPicker
      v-if="pickerType"
      v-model="pickerValue"
      :open="!!pickerType"
      :type="pickerType"
      @close="pickerType = null"
      @created="loadEquipment"
    />
  </form>
</template>
