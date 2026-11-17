<script setup lang="ts">
// 器材表單，/equipment/new 與 /equipment/[id]/edit 共用。
//
// 原本是開在 /equipment 列表頂部的頁內表單：沒有暫存、返回鍵直接離開列表頁、
// 分頁列與新增按鈕還在——按新增會靜默換掉編輯中的內容。改成獨立路由之後
// 與豆子、沖煮紀錄的表單同一套：流程型畫面、自動暫存、底部是儲存（《03》§3）。

const props = defineProps<{
  initial?: Partial<EquipmentFormValues>
  /** 編輯時這一台的 id：找「同一種器材目前的常用」時排除自己 */
  equipmentId?: string
  submitLabel: string
  busy?: boolean
  error?: string
  /** 自動暫存的 key。沒給就不做暫存。 */
  draftKey?: string
}>()

const emit = defineEmits<{
  submit: [values: EquipmentFormValues]
}>()

function initialValues(): EquipmentFormValues {
  return {
    type: props.initial?.type ?? 'grinder',
    catalog_id: props.initial?.catalog_id ?? null,
    custom_name: props.initial?.custom_name ?? '',
    note: props.initial?.note ?? '',
    is_default: props.initial?.is_default ?? false,
  }
}

const values = reactive<EquipmentFormValues>(initialValues())
const selectedCatalog = ref<CatalogRow | null>(null)
const summaryError = ref('')

const scaleSpec = computed<GrindScaleSpec>(() => grindScaleOf(selectedCatalog.value))

// 換類型時型號跟著清掉：磨豆機的型號不能留在濾杯上。
// 型號選單以類型為 key 重建，所以清除由這裡負責，而且只在使用者換類型時清——
// 暫存還原與全部清除是把整組值寫回來，型號是跟著類型一起回來的，不能清。
let writingBack = false
watch(() => values.type, () => {
  if (writingBack) return
  values.catalog_id = null
  selectedCatalog.value = null
}, { flush: 'sync' })

function writeBack(data: EquipmentFormValues) {
  writingBack = true
  try {
    Object.assign(values, data)
    selectedCatalog.value = null
  }
  finally {
    writingBack = false
  }
}

// 「設為常用」卡片下方要寫出同一種器材目前的常用是哪一台（不含這一台），
// 開了之後儲存，那一台的常用會被取消（DefaultEquipmentCard）。換類型時重查。
const supabase = useSupabaseClient()
const currentDefault = ref<string | null>(null)
let defaultQuery = 0

async function loadCurrentDefault() {
  const ticket = ++defaultQuery
  let query = supabase
    .from('user_equipment')
    .select(USER_EQUIPMENT_SELECT)
    .eq('type', values.type)
    .eq('is_default', true)
  if (props.equipmentId) query = query.neq('id', props.equipmentId)
  const { data } = await query.limit(1).maybeSingle()
  // 讀不到就只寫前半句：這一句是說明，不擋任何操作
  if (ticket !== defaultQuery) return
  currentDefault.value = data ? equipmentOptionName(data as unknown as UserEquipmentRow) : null
}

onMounted(loadCurrentDefault)
watch(() => values.type, loadCurrentDefault)

function submit() {
  // 型錄與自訂名稱至少要有一個（DB 的 name_or_catalog check 也擋，
  // 但不該讓使用者看到資料庫的錯誤訊息）
  if (!values.catalog_id && !values.custom_name.trim()) {
    summaryError.value = '選擇型號，或填寫名稱'
    return
  }
  summaryError.value = ''
  emit('submit', { ...values })
}

// 自動暫存（《02》§6）。型號是系統型錄，使用者刪不掉，不必檢查參照是否還在
// 實際存放的 key 帶使用者 id：A 的暫存 B 讀不到（utils/draft.ts）
const draftStorageKey = useScopedDraftKey(props.draftKey)
const draft = draftStorageKey
  ? useFormDraft<EquipmentFormValues>(draftStorageKey, {
      read: () => ({ ...values }),
      restore: data => writeBack({ ...initialValues(), ...data }),
      reset: () => writeBack(initialValues()),
    })
  : null

defineExpose({ clearDraft: () => draft?.clear() })

</script>

<template>
  <form novalidate @submit.prevent="submit">
    <DraftBanner
      v-if="draft?.recovered.value"
      class="mb-6"
      @clear-all="draft.clearAll()"
    />

    <DraftOverlay
      v-if="draft"
      :open="draft.pending.value !== null"
      @accept="draft.accept()"
      @discard="draft.discard()"
    />

    <!-- 與豆子表單同一套分組卡片（Figma 沒有畫這張表單）：是哪一台／名稱與備註，卡片之間 --gap-group。
         不另外下標題（頁面標題已經是新增／編輯器材）。說明用 FormNote，顯示在所在卡片的下方 -->
    <div class="flex flex-col" :style="{ gap: 'var(--gap-group)' }">
    <FormCard>
      <FormRow>
        <!-- 必填的列自己寫標籤（tests/unit/required-placeholder.test.mjs 靠這個標記找必填欄位） -->
        <div class="sheet-row">
          <label class="sheet-label" for="equipment-type">類型<span :style="{ color: 'var(--danger)' }" aria-hidden="true">*</span><span class="sr-only">必填</span></label>
          <div class="sheet-value">
            <SelectField>
              <select id="equipment-type" v-model="values.type" class="sheet-pill">
                <option v-for="type in equipmentTypes" :key="type" :value="type">
                  {{ equipmentLabels[type] }}
                </option>
              </select>
            </SelectField>
          </div>
        </div>
      </FormRow>

      <FormRow>
        <CatalogSelect
          :key="values.type"
          v-model="values.catalog_id"
          :type="values.type"
          @selected="selectedCatalog = $event"
        />
      </FormRow>
      <!-- 型錄存在的唯一目的是讓刻度這個數字可以被正確解讀（§3.2）。
           無刻度的機型不說「這台面板沒有刻度標示」：不顯示範圍提示本身就已經表達了 -->
      <template v-if="values.type === 'grinder' && selectedCatalog">
        <FormNote v-if="!isFreeformScale(scaleSpec)">
          <span>刻度範圍 {{ grindScaleRangeLabel(scaleSpec) }}</span>
          <span v-if="scaleSpec.increment !== null">最小間隔 {{ scaleSpec.increment }}</span>
          <span v-else>連續無段</span>
          <span v-if="grindScaleSuggestionLabel(scaleSpec)">{{ grindScaleSuggestionLabel(scaleSpec) }}</span>
        </FormNote>
        <FormNote v-if="scaleSpec.note" :field="isFreeformScale(scaleSpec) ? '型號' : undefined">{{ scaleSpec.note }}</FormNote>
      </template>
    </FormCard>

    <FormCard>
      <FormRow>
        <div class="sheet-row">
          <label class="sheet-label" for="equipment-name">
            自訂名稱<span v-if="!values.catalog_id" :style="{ color: 'var(--danger)' }" aria-hidden="true">*</span>
            <span v-if="!values.catalog_id" class="sr-only">必填</span>
            <AlertIcon v-if="summaryError" class="sheet-label-alert" />
          </label>
          <div class="sheet-value">
            <SheetText id="equipment-name" v-model="values.custom_name" :disabled="!!values.catalog_id" :placeholder="values.catalog_id ? '' : '輸入自訂名稱'" />
          </div>
        </div>
      </FormRow>
      <FormNote>{{ values.catalog_id ? "已選型號，用型錄的名稱" : "型錄沒有的器材，請填寫名稱" }}</FormNote>

      <FormRow label="備註" for="equipment-note">
        <SheetText id="equipment-note" v-model="values.note" />
      </FormRow>
      <FormNote field="備註">例如換刀盤、加裝配件</FormNote>
    </FormCard>

    <!-- 設為常用：開關一張卡片（2026-11-17，取代原本的動作按鈕）。同類型只能有一台常用，
         開了會取代哪一台寫在卡片下方——副作用在畫面上看得到（《03》§4.0.1）。
         沒有任何常用是合法狀態，新使用者本來就沒有。不阻止關掉。 -->
    <DefaultEquipmentCard v-model="values.is_default" :current-default="currentDefault" />
    </div>

    <!-- 表單最下方的儲存：膠囊形（《03》§4.18 的例外） -->
    <AppButton block
      type="submit"
      shape="pill"
      :busy="busy"
      :style="{ marginTop: 'var(--gap-section)' }"
    >
      {{ busy ? "儲存中" : submitLabel }}
    </AppButton>

    <!-- 暫存狀態：使用者在按儲存之前擔心東西安不安全，視線在這裡（《03》§4.11） -->
    <DraftStatus v-if="draft" :status="draft.status.value" class="mt-2" />

    <p
      v-if="error || summaryError"
      role="alert"
      class="mt-3 flex items-start gap-2 rounded-sm border px-3 py-3 text-sm"
      :style="{ color: 'var(--danger)', borderColor: 'var(--danger)' }"
    >
      <AlertIcon class="mt-0.5" />
      <span>{{ error || summaryError }}</span>
    </p>
  </form>
</template>
