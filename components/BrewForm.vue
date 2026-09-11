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
  /** 自動暫存的 key。沒給就不做暫存。 */
  draftKey?: string
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
const cache = useQueryCache()

// 產品指標（§9）：表單開啟到成功送出的秒數，使用者不可見
const openedAt = Date.now()

function initialValues(): BrewFormValues {
  return {
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
  }
}

const values = reactive<BrewFormValues>(initialValues())

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
const beanError = ref('')
const doseError = ref('')
const summaryError = ref('')

// 器材：新增時各類型的常用器材自動帶入
const equipment = ref<EquipmentOption[]>([])
const methods = ref<{ id: string; name: string }[]>([])

async function fetchEquipment() {
  const { data, error } = await supabase
    .from('user_equipment')
    .select('id, type, custom_name, is_default, catalog_id, equipment_catalog ( brand, model, variant, grind_scale_min, grind_scale_max, grind_scale_increment, grind_scale_suggested_min, grind_scale_suggested_max, grind_scale_note )')
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
  if (error) throw toError(error)
  return (data ?? []) as unknown as EquipmentOption[]
}

async function loadEquipment() {
  await cache.swr(cacheKeys.equipmentAll(), fetchEquipment, {
    apply: (rows) => { equipment.value = rows },
  }).settled
}

// 查表載入失敗時要講出來。原本是無聲失敗——下拉變成空的，
// 使用者只會覺得「怎麼沒有選項」，不知道是網路斷了。
const lookupError = ref('')

onMounted(async () => {
  try {
    await loadLookups()
  }
  catch (e) {
    lookupError.value = `器材與手法讀不到：${errorText(e)}`
  }
})

type MethodRow = {
  id: string, name: string, default_ratio: number | null, step_template: MethodTemplate | null
}

async function fetchMethods() {
  const { data, error } = await supabase
    .from('brew_methods')
    .select('id, name, default_ratio, step_template')
    .order('sort_order').order('name')
  if (error) throw toError(error)
  return (data ?? []) as unknown as MethodRow[]
}

function applyMethods(rows: MethodRow[]) {
  methods.value = rows.map(row => ({ id: row.id, name: row.name }))
  methodTemplates.value = new Map(
    rows.map(row => [row.id, { template: row.step_template, ratio: row.default_ratio }]),
  )
}

async function loadLookups() {
  await Promise.all([
    loadEquipment(),
    cache.swr(cacheKeys.lookup('brew_methods'), fetchMethods, { apply: applyMethods }).settled,
  ])

  // 只在新增（沒有初始值）時帶入常用器材，編輯既有紀錄不覆蓋使用者當初的選擇
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
}

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

const methodNotice = ref('')

function templateResult() {
  const id = values.brew_method_id
  if (!id) return null
  const method = methodTemplates.value.get(id)
  if (!method) return null
  return stepsFromTemplate(method.template, values.dose, method.ratio)
}

function applyTemplate() {
  const result = templateResult()
  if (!result) return
  steps.value = result.steps
  methodNotice.value = result.notice ?? ''
}

// 選了手法就整組帶入；粉重還沒填時 templateResult 回 null，等粉重填好再套用
watch(() => values.brew_method_id, applyTemplate)

// 粉重變動時整組重算——總水量由粉重決定，不重算等於留著舊粉重的分段。
// 這會蓋掉使用者手動改過的值，是刻意的取捨：規則要能被預測。
// 理由與被撤掉的逐段機制寫在 shouldRegenerateSteps 的註解裡。
watch(() => values.dose, () => {
  if (!values.brew_method_id) return
  const result = templateResult()
  if (!result) return
  if (!shouldRegenerateSteps(steps.value, result.steps.length)) return
  steps.value = result.steps
  methodNotice.value = result.notice ?? ''
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
  // bean_id 在資料庫是 not null——一筆沖煮紀錄不掛在任何豆子上沒有意義。
  // 前端要先擋下來，不能讓它跑到資料庫才失敗。
  beanError.value = values.bean_id === null ? '豆子尚未填寫' : ''
  doseError.value = values.dose === null ? '粉重尚未填寫' : ''

  const missing = [beanError.value && '豆子', doseError.value && '粉重'].filter(Boolean)
  if (missing.length) {
    summaryError.value = `沒有儲存：${missing.join('與')}尚未填寫`
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

// ── 自動暫存（§6）────────────────────────────────────────
// 暫存整份表單狀態，包含分段與風味標籤。沖煮表單本身沒有照片欄位
//（沖煮照片是 L2，第一版不露出）；就地新增的豆子由 BeanSelect 自己暫存
//（draft:bean:inline，豆名進 localStorage、照片進 IndexedDB）。

interface BrewDraft {
  values: BrewFormValues
  steps: StepInput[]
  flavorTagIds: string[]
}

// 這些欄位存的是別筆資料的 id，還原前要確認對象還在
const REFERENCE_FIELDS = [
  'bean_id', 'brew_method_id', 'grinder_id', 'dripper_id', 'kettle_id', 'filter_id', 'server_id',
]

const draftNote = ref('')

async function sanitizeDraft(incoming: BrewDraft): Promise<BrewDraft> {
  const tagIds = incoming.flavorTagIds ?? []
  const equipmentIds = [
    incoming.values.grinder_id, incoming.values.dripper_id, incoming.values.kettle_id,
    incoming.values.filter_id, incoming.values.server_id,
  ].filter((id): id is string => !!id)

  const [beanRes, methodRes, equipmentRes, tagRes] = await Promise.all([
    incoming.values.bean_id
      ? supabase.from('beans').select('id').in('id', [incoming.values.bean_id])
      : Promise.resolve({ data: [] }),
    incoming.values.brew_method_id
      ? supabase.from('brew_methods').select('id').in('id', [incoming.values.brew_method_id])
      : Promise.resolve({ data: [] }),
    equipmentIds.length
      ? supabase.from('user_equipment').select('id').in('id', equipmentIds)
      : Promise.resolve({ data: [] }),
    tagIds.length
      ? supabase.from('flavor_tags').select('id').in('id', tagIds)
      : Promise.resolve({ data: [] }),
  ])

  const alive = new Set<string>()
  for (const result of [beanRes, methodRes, equipmentRes, tagRes]) {
    for (const row of (result.data ?? []) as unknown as { id: string }[]) alive.add(row.id)
  }

  const pruned = pruneMissingIds(
    incoming.values as unknown as Record<string, unknown>,
    REFERENCE_FIELDS,
    id => alive.has(id),
  )
  const keptTags = tagIds.filter(id => alive.has(id))

  // 指向已刪除資料的欄位留空而不是整個表單壞掉，並讓使用者知道
  if (pruned.dropped.length || keptTags.length !== tagIds.length) {
    draftNote.value = droppedFieldsMessage(pruned.dropped)
  }

  return {
    values: pruned.data as unknown as BrewFormValues,
    steps: incoming.steps ?? [],
    flavorTagIds: keptTags,
  }
}

const draft = props.draftKey
  ? useFormDraft<BrewDraft>(props.draftKey, {
      read: () => ({ values: { ...values }, steps: steps.value, flavorTagIds: flavorTagIds.value }),
      restore: (data) => {
        Object.assign(values, data.values)
        if (data.steps?.length) steps.value = data.steps
        flavorTagIds.value = data.flavorTagIds ?? []
      },
      reset: () => {
        Object.assign(values, initialValues())
        steps.value = props.initialSteps ?? initialSteps()
        flavorTagIds.value = props.initialFlavorTagIds ?? []
        draftNote.value = ''
      },
      sanitize: sanitizeDraft,
    })
  : null

// 儲存成功後由頁面呼叫，清掉這份暫存
defineExpose({ clearDraft: () => draft?.clear() })

const inputStyle = {
  minHeight: 'var(--touch-min)',
}
</script>

<template>
  <form novalidate class="space-y-6" @submit.prevent="submit">
    <!-- 短時間離開：已經填入，只是告知 -->
    <DraftBanner
      v-if="draft?.recovered.value"
      :note="draftNote"
      @clear-all="draft.clearAll()"
    />

    <p
      v-else-if="draftNote"
      class="rounded-sm px-3 py-2 text-sm"
      :style="{ background: 'var(--accent-wash)', color: 'var(--on-accent-wash)' }"
    >
      {{ draftNote }}
    </p>

    <!-- 隔了一段時間：意圖不明，開口問 -->
    <DraftOverlay
      v-if="draft"
      :open="draft.pending.value !== null"
      @accept="draft.accept()"
      @discard="draft.discard()"
    />
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
          :error="beanError"
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
        <p v-else class="mt-1 text-xs text-muted">選擇手法會依粉重帶入分段</p>
        <!-- 內建手法的分段模板數值尚未經實機核實（見 CLAUDE.md 階段備註）。
             在核實之前先講清楚它是參考值，避免使用者當成標準答案照做。 -->
        <p v-if="methods.length" class="mt-1 text-xs text-muted">
          內建手法為參考框架，實際水量請依自己的器材與豆子調整
        </p>
        <p v-if="methodNotice" class="mt-1 text-xs" :style="{ color: 'var(--danger)' }">
          {{ methodNotice }}
        </p>
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
        :style="{ borderColor: 'var(--border)', background: 'var(--surface)', minHeight: 'var(--touch-min)' }"
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
        :style="{ background: 'var(--accent)', color: 'var(--on-accent)', minHeight: 'var(--touch-min)' }"
      >
        {{ busy ? '儲存中' : submitLabel }}
      </button>

      <p
        v-if="error || summaryError || lookupError"
        role="alert"
        class="mt-3 rounded-sm border px-3 py-3 text-sm"
        :style="{ color: 'var(--danger)', borderColor: 'var(--danger)' }"
      >
        {{ error || summaryError || lookupError }}
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
