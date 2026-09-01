<script setup lang="ts">
// 豆子表單，/beans/new 與 /beans/[id]/edit 共用。
//
// 必填只有 name（《01》§3.4、《02》§0.4）。其他欄位一律可空，
// 不得加任何前端必填驗證——這是首次流程能否成立的關鍵。
//
// 豆袋照片放在最上方，不是最下方（《02》§9）。

// BeanFormValues 定義在 utils/bean.ts，由 Nuxt 自動匯入

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
  region_id: props.initial?.region_id ?? null,
  processing_method_id: props.initial?.processing_method_id ?? null,
  variety_id: props.initial?.variety_id ?? null,
  official_notes: props.initial?.official_notes ?? '',
})

const photo = ref<CompressedImage | null>(null)
const photoCleared = ref(false)
const nameError = ref('')

const countries = ref<{ id: string; name_zh: string }[]>([])
onMounted(async () => {
  const { data } = await supabase
    .from('countries')
    .select('id, name_zh')
    .order('sort_order')
  countries.value = (data ?? []) as unknown as { id: string; name_zh: string }[]
})

// 換國家時清掉已選產區，避免留下不屬於該國的產區
watch(() => values.country_id, (next, prev) => {
  if (prev !== undefined && next !== prev) values.region_id = null
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
  if (nameError.value) return
  emit('submit', { values: { ...values, name: values.name.trim() }, photo: photo.value, photoCleared: photoCleared.value })
}

const inputStyle = {
  borderColor: 'var(--border)',
  background: 'var(--surface)',
  minHeight: '44px',
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
      <label class="block text-sm" for="bean-roaster">烘焙商</label>
      <input
        id="bean-roaster"
        v-model="values.roaster"
        type="text"
        class="mt-1 block w-full rounded-sm border px-3 py-2.5"
        :style="inputStyle"
      >
    </div>

    <div class="mt-5">
      <label class="block text-sm" for="bean-roast-date">烘焙日期</label>
      <input
        id="bean-roast-date"
        v-model="values.roast_date"
        type="date"
        class="mt-1 block w-full rounded-sm border px-3 py-2.5"
        :style="inputStyle"
      >
      <p class="mt-1 text-xs text-muted">填了才會顯示養豆天數，不填也能存。</p>
    </div>

    <div class="mt-5">
      <label class="block text-sm" for="bean-roast-level">烘焙度</label>
      <select
        id="bean-roast-level"
        v-model="values.roast_level"
        class="mt-1 block w-full rounded-sm border px-3 py-2.5"
        :style="inputStyle"
      >
        <option :value="null">不填</option>
        <option v-for="option in roastOptions" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
    </div>

    <CollapsibleSection title="產地與風味" storage-key="beanForm.origin.expanded">
      <div>
        <label class="block text-sm" for="bean-country">產國</label>
        <select
          id="bean-country"
          v-model="values.country_id"
          class="mt-1 block w-full rounded-sm border px-3 py-2.5"
          :style="inputStyle"
        >
          <option :value="null">不填</option>
          <option v-for="country in countries" :key="country.id" :value="country.id">
            {{ country.name_zh }}
          </option>
        </select>
      </div>

      <div class="mt-5">
        <LookupSelect
          v-model="values.region_id"
          label="產區"
          table="regions"
          :country-id="values.country_id"
          :hint="values.country_id ? undefined : '選了產國就只會列出該國的產區'"
        />
      </div>

      <div class="mt-5">
        <LookupSelect v-model="values.processing_method_id" label="處理法" table="processing_methods" />
      </div>

      <div class="mt-5">
        <LookupSelect v-model="values.variety_id" label="品種" table="varieties" />
      </div>

      <div class="mt-5">
        <label class="block text-sm" for="bean-notes">袋上的風味描述</label>
        <textarea
          id="bean-notes"
          v-model="values.official_notes"
          rows="3"
          class="mt-1 block w-full rounded-sm border px-3 py-2.5"
          :style="{ borderColor: 'var(--border)', background: 'var(--surface)' }"
        />
      </div>
    </CollapsibleSection>

    <p v-if="error" class="mt-6 text-sm" :style="{ color: 'var(--danger)' }">{{ error }}</p>

    <button
      type="submit"
      :disabled="busy"
      class="mt-6 w-full rounded-sm px-4 py-3 font-medium disabled:opacity-60"
      :style="{ background: 'var(--accent)', color: '#FFFFFF', minHeight: '44px' }"
    >
      {{ busy ? '儲存中' : submitLabel }}
    </button>
  </form>
</template>
