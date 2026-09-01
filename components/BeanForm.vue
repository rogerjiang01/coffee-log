<script setup lang="ts">
// 豆子表單，/beans/new 與 /beans/[id]/edit 共用。
//
// 必填只有 name（《01》§3.4、《02》§0.4）。其他欄位一律可空，
// 不得加任何前端必填驗證——這是首次流程能否成立的關鍵。
//
// 豆袋照片放在最上方，不是最下方（《02》§9）。
//
// L1／L2 的切分：處理法、品種、產區留在 L1。台灣咖啡文化在豆袋上強調
// 這三項，把它們藏進收合區正是競品被詬病的地方。咖啡店名反而是查閱時
// 才需要，不是輸入時的重點，因此收進 L2。

const props = defineProps<{
  initial?: Partial<BeanFormValues>
  photoUrl?: string | null
  submitLabel: string
  busy?: boolean
  error?: string
}>()

const emit = defineEmits<{
  submit: [payload: { values: BeanFormValues; photo: CompressedImage | null; photoCleared: boolean }]
}>()

const supabase = useSupabaseClient()

const values = reactive<BeanFormValues>({
  name: props.initial?.name ?? '',
  roaster: props.initial?.roaster ?? '',
  roast_date: props.initial?.roast_date ?? '',
  roast_level: props.initial?.roast_level ?? null,
  country_id: props.initial?.country_id ?? null,
  region: props.initial?.region ?? '',
  processing_method_id: props.initial?.processing_method_id ?? null,
  variety_id: props.initial?.variety_id ?? null,
  official_notes: props.initial?.official_notes ?? '',
  is_finished: props.initial?.is_finished ?? false,
})

const photo = ref<CompressedImage | null>(null)
const photoCleared = ref(false)
const nameError = ref('')
// 欄位層級的錯誤留在該欄位下方，但按鈕正下方也要有一則總結：
// 長表單上使用者的視線在按鈕附近，只在上方顯示會讓人以為沒反應。
const summaryError = ref('')

const countries = ref<{ id: string; name_zh: string }[]>([])
// 產區是自由文字，建議來源是使用者自己填過的值，沒有歷史就沒有建議
const regionSuggestions = ref<string[]>([])

onMounted(async () => {
  const [countryResult, regionResult] = await Promise.all([
    supabase.from('countries').select('id, name_zh').order('sort_order').order('name_zh'),
    supabase.from('beans').select('region').not('region', 'is', null).order('region'),
  ])
  countries.value = (countryResult.data ?? []) as unknown as { id: string; name_zh: string }[]
  const seen = (regionResult.data ?? []) as unknown as { region: string | null }[]
  regionSuggestions.value = [...new Set(seen.map(row => row.region).filter((v): v is string => !!v))]
})

function onPhotoPicked(picked: CompressedImage | null) {
  photo.value = picked
  photoCleared.value = picked === null
}

const roastOptions: { value: RoastLevel; label: string }[] = (
  ['light', 'medium_light', 'medium', 'medium_dark', 'dark'] as RoastLevel[]
).map(value => ({ value, label: roastLabels[value] }))

function submit() {
  // 錯誤訊息只在送出時顯示，不在輸入過程中即時跳出（《03》§4.1）
  nameError.value = values.name.trim() ? '' : '豆子總得有個名字，其他都可以之後再說'
  if (nameError.value) {
    summaryError.value = '還沒存起來：上面的豆名還沒填。'
    return
  }
  summaryError.value = ''
  emit('submit', {
    values: { ...values, name: values.name.trim() },
    photo: photo.value,
    photoCleared: photoCleared.value,
  })
}

const inputStyle = {
  borderColor: 'var(--border)',
  background: 'var(--surface)',
  minHeight: '44px',
}

// 未選取的下拉要用 --text-muted，否則黑字看起來像已經填好的值
function selectStyle(value: unknown) {
  return { ...inputStyle, color: value == null ? 'var(--text-muted)' : 'var(--text)' }
}
</script>

<template>
  <form novalidate @submit.prevent="submit">
    <!-- 逃生路徑：放在最上方 -->
    <PhotoField :preview-url="photoUrl ?? null" @picked="onPhotoPicked" />

    <div class="mt-8">
      <label class="block text-sm" for="bean-name">豆名</label>
      <input
        id="bean-name"
        v-model="values.name"
        type="text"
        class="mt-1 block w-full rounded-sm border px-3 py-2.5"
        :style="inputStyle"
      >
      <p v-if="nameError" class="mt-2 text-sm" :style="{ color: 'var(--danger)' }">{{ nameError }}</p>
    </div>

    <div class="mt-5">
      <label class="block text-sm" for="bean-roast-date">烘焙日期</label>
      <input
        id="bean-roast-date"
        v-model="values.roast_date"
        type="date"
        class="mt-1 block w-full rounded-sm border px-3 py-2.5"
        :class="{ 'date-empty': !values.roast_date }"
        :style="inputStyle"
      >
      <p class="mt-1 text-xs text-muted">填了才會顯示養豆天數</p>
    </div>

    <div class="mt-5">
      <label class="block text-sm" for="bean-roast-level">烘焙度</label>
      <select
        id="bean-roast-level"
        v-model="values.roast_level"
        class="mt-1 block w-full rounded-sm border px-3 py-2.5"
        :style="selectStyle(values.roast_level)"
      >
        <option :value="null">選填</option>
        <option v-for="option in roastOptions" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
    </div>

    <div class="mt-5">
      <label class="block text-sm" for="bean-country">產國</label>
      <select
        id="bean-country"
        v-model="values.country_id"
        class="mt-1 block w-full rounded-sm border px-3 py-2.5"
        :style="selectStyle(values.country_id)"
      >
        <option :value="null">選填</option>
        <option v-for="country in countries" :key="country.id" :value="country.id">
          {{ country.name_zh }}
        </option>
      </select>
    </div>

    <div class="mt-5">
      <label class="block text-sm" for="bean-region">產區</label>
      <input
        id="bean-region"
        v-model="values.region"
        type="text"
        list="bean-region-options"
        class="mt-1 block w-full rounded-sm border px-3 py-2.5"
        :style="inputStyle"
      >
      <!-- 建議來自使用者填過的值，沒有歷史就沒有建議，不擋任何輸入 -->
      <datalist id="bean-region-options">
        <option v-for="suggestion in regionSuggestions" :key="suggestion" :value="suggestion" />
      </datalist>
    </div>

    <div class="mt-5">
      <LookupSelect v-model="values.processing_method_id" label="處理法" table="processing_methods" />
    </div>

    <div class="mt-5">
      <LookupSelect v-model="values.variety_id" label="品種" table="varieties" />
    </div>

    <CollapsibleSection title="店家與備註" storage-key="beanForm.other.expanded">
      <div>
        <label class="block text-sm" for="bean-roaster">咖啡店名</label>
        <input
          id="bean-roaster"
          v-model="values.roaster"
          type="text"
          class="mt-1 block w-full rounded-sm border px-3 py-2.5"
          :style="inputStyle"
        >
      </div>

      <div class="mt-5">
        <label class="block text-sm" for="bean-notes">官方風味描述</label>
        <textarea
          id="bean-notes"
          v-model="values.official_notes"
          rows="3"
          class="mt-1 block w-full rounded-sm border px-3 py-2.5"
          :style="{ borderColor: 'var(--border)', background: 'var(--surface)' }"
        />
      </div>

      <label class="mt-5 flex items-center gap-3" :style="{ minHeight: '44px' }">
        <input
          v-model="values.is_finished"
          type="checkbox"
          class="size-5"
          :style="{ accentColor: 'var(--accent)' }"
        >
        <span>已喝完</span>
      </label>
    </CollapsibleSection>

    <button
      type="submit"
      :disabled="busy"
      class="mt-8 w-full rounded-sm px-4 py-3 font-medium disabled:opacity-60"
      :style="{ background: 'var(--accent)', color: '#FFFFFF', minHeight: '44px' }"
    >
      {{ busy ? '儲存中' : submitLabel }}
    </button>

    <!-- 錯誤訊息必須在按鈕正下方。放在按鈕上方時，長表單一捲動就看不到，
         使用者會以為「按了沒反應」。 -->
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
