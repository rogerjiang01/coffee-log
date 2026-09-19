<script setup lang="ts">
// 器材表單，/equipment/new 與 /equipment/[id]/edit 共用。
//
// 原本是開在 /equipment 列表頂部的頁內表單：沒有暫存、返回鍵直接離開列表頁、
// 分頁列與新增按鈕還在——按新增會靜默換掉編輯中的內容。改成獨立路由之後
// 與豆子、沖煮紀錄的表單同一套：流程型畫面、自動暫存、底部是儲存（《03》§3）。

const props = defineProps<{
  initial?: Partial<EquipmentFormValues>
  /** 編輯時這台原本的名稱，「已將 X 設為常用」在表單還沒有名稱時用 */
  currentName?: string | null
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

/**
 * 這次有沒有按過「設為常用」。
 *
 * 用來決定要不要顯示回饋，而不是拿 values.is_default 直接判斷——
 * 本來就是常用的那台一打開表單就是 true，那不是「剛剛做了什麼」，
 * 是「原本就是這樣」，不該冒出一句回饋。
 */
const pressedDefault = ref(false)

function toggleDefault() {
  values.is_default = !values.is_default
  pressedDefault.value = true
}

/** 表單上這台的名稱，給回饋文案用。以表單當下的值為準，沒有名字時回 null */
const formName = computed(() => {
  if (values.catalog_id && selectedCatalog.value) return catalogDisplayName(selectedCatalog.value)
  const typed = values.custom_name.trim()
  if (typed) return typed
  return props.currentName ?? null
})

function submit() {
  // 型錄與自訂名稱至少要有一個（DB 的 name_or_catalog check 也擋，
  // 但不該讓使用者看到資料庫的錯誤訊息）
  if (!values.catalog_id && !values.custom_name.trim()) {
    summaryError.value = '選一個型號，或直接填名稱'
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
      reset: () => {
        writeBack(initialValues())
        pressedDefault.value = false
      },
    })
  : null

defineExpose({ clearDraft: () => draft?.clear() })

const inputStyle = {
  minHeight: 'var(--touch-min)',
}
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

    <!-- 與豆子表單同一套分組卡片；只有一張卡片，不另外下標題（頁面標題已經是新增／編輯器材） -->
    <FormCard>
      <FormRow>
        <label class="block text-sm" for="equipment-type">
          類型
          <span :style="{ color: 'var(--danger)' }" aria-hidden="true">*</span>
          <span class="sr-only">必填</span>
        </label>
        <SelectField>
          <select id="equipment-type" v-model="values.type" class="mt-1 block w-full field py-2.5" :style="inputStyle">
            <option v-for="type in equipmentTypes" :key="type" :value="type">
              {{ equipmentLabels[type] }}
            </option>
          </select>
        </SelectField>
      </FormRow>

      <FormRow>
        <CatalogSelect
          :key="values.type"
          v-model="values.catalog_id"
          :type="values.type"
          @selected="selectedCatalog = $event"
        />
        <!-- 型錄存在的唯一目的是讓刻度這個數字可以被正確解讀（§3.2） -->
        <div
          v-if="values.type === 'grinder' && selectedCatalog && (!isFreeformScale(scaleSpec) || scaleSpec.note)"
          class="mt-3 rounded-sm px-3 py-3 text-sm"
          :style="{ background: 'var(--accent-wash)', color: 'var(--on-accent-wash)' }"
        >
          <!-- 無刻度的機型不說「這台面板沒有刻度標示」：
               不顯示範圍提示本身就已經表達了 -->
          <template v-if="!isFreeformScale(scaleSpec)">
            <p class="tabular-nums">
              刻度範圍 {{ grindScaleRangeLabel(scaleSpec) }}
              <span v-if="scaleSpec.increment !== null" class="ml-3">最小間隔 {{ scaleSpec.increment }}</span>
              <span v-else class="ml-3">連續無段</span>
            </p>
            <p v-if="grindScaleSuggestionLabel(scaleSpec)" class="mt-1 tabular-nums">
              {{ grindScaleSuggestionLabel(scaleSpec) }}
            </p>
          </template>
          <p v-if="scaleSpec.note" class="mt-1">{{ scaleSpec.note }}</p>
        </div>
      </FormRow>

      <FormRow>
        <label class="block text-sm" for="equipment-name">
          自訂名稱
          <span v-if="!values.catalog_id" :style="{ color: 'var(--danger)' }" aria-hidden="true">*</span>
          <span v-if="!values.catalog_id" class="sr-only">必填</span>
        </label>
        <input
          id="equipment-name"
          v-model="values.custom_name"
          type="text"
          :disabled="!!values.catalog_id"
          class="mt-1 block w-full field py-2.5 disabled:opacity-60"
          :style="inputStyle"
        >
        <p class="mt-1 text-xs text-muted">
          {{ values.catalog_id ? "已選型號，用型錄的名稱" : "型錄裡沒有的直接填名稱" }}
        </p>
      </FormRow>

      <FormRow>
        <label class="block text-sm" for="equipment-note">備註</label>
        <input id="equipment-note" v-model="values.note" type="text" class="mt-1 block w-full field py-2.5" :style="inputStyle">
        <p class="mt-1 text-xs text-muted">例如換刀盤、加裝配件</p>
      </FormRow>

      <FormRow>
        <!-- 動作按鈕而非 toggle。同類型只能有一台常用（DB 有 partial
             unique index），toggle 表達的是獨立的開關，用它承載單選會讓
             副作用隱形——使用者看不到「開啟這台會關掉另一台」。
             改成兩個狀態的按鈕，並把副作用寫在下面那行。 -->
        <button
          type="button"
          class="w-full rounded-sm border px-4 py-3"
          :style="{
            borderColor: values.is_default ? 'var(--border-strong)' : 'var(--accent)',
            color: values.is_default ? 'var(--text)' : 'var(--accent)',
            minHeight: 'var(--touch-min)',
          }"
          @click="toggleDefault"
        >
          {{ values.is_default ? "取消常用" : "設為常用" }}
        </button>

        <!-- 事後回饋，不是事前警告。使用者按下「設為常用」時意圖已經很明確，
             事前提醒他會換掉哪一台，是把系統的顧慮丟給他判斷——與模糊比對
             從攔截器改成過濾器是同一個問題。 -->
        <p v-if="values.is_default && pressedDefault" class="mt-2 text-xs text-muted">
          {{ formName ? `已將 ${formName} 設為常用` : "已設為常用" }}
        </p>

        <!-- 沒有任何常用是合法狀態，新使用者本來就沒有。不阻止取消。 -->
        <p v-else-if="!values.is_default" class="mt-2 text-xs text-muted">新增紀錄時會自動填入</p>
      </FormRow>
    </FormCard>

    <button
      type="submit"
      :disabled="busy"
      class="mt-6 w-full rounded-sm px-4 py-3 font-medium disabled:opacity-60"
      :style="{ background: 'var(--accent)', color: 'var(--on-accent)', minHeight: 'var(--touch-min)' }"
    >
      {{ busy ? "儲存中" : submitLabel }}
    </button>

    <!-- 暫存狀態：使用者在按儲存之前擔心東西安不安全，視線在這裡（《03》§4.11） -->
    <DraftStatus v-if="draft" :status="draft.status.value" class="mt-2" />

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
