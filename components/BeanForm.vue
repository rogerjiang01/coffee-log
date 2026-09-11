<script setup lang="ts">
// 豆子表單，/beans/new 與 /beans/[id]/edit 共用。
//
// 必填只有 name（《01》§3.4、《02》§0.4）。其他欄位一律可空，
// 不得加任何前端必填驗證——這是首次流程能否成立的關鍵。
//
// 豆袋照片放在最上方，不是最下方（《02》§9）。
//
// 豆子表單沒有收合區，九個欄位全部可見。
// 咖啡店名緊接在豆名之後——豆袋上的資訊結構是「某某店的某某豆」，
// 店名是豆名的所屬關係，不是並列的另一個屬性。
// 一個欄位不值得做收合區，收合區機制留給真的很長的沖煮表單。
//
// 已喝完不在表單裡，由詳情頁的 toggle 負責。

const props = defineProps<{
  initial?: Partial<BeanFormValues>
  photoUrl?: string | null
  submitLabel: string
  busy?: boolean
  error?: string
  /** 自動暫存的 key。沒給就不做暫存。 */
  draftKey?: string
}>()

const emit = defineEmits<{
  submit: [payload: { values: BeanFormValues; photo: CompressedImage | null; photoCleared: boolean }]
}>()

const supabase = useSupabaseClient()

function initialValues(): BeanFormValues {
  return {
  name: props.initial?.name ?? '',
  roaster: props.initial?.roaster ?? '',
  roast_date: props.initial?.roast_date ?? '',
  roast_level: props.initial?.roast_level ?? null,
  country_id: props.initial?.country_id ?? null,
  region: props.initial?.region ?? '',
  processing_method_id: props.initial?.processing_method_id ?? null,
  variety_id: props.initial?.variety_id ?? null,
  official_notes: props.initial?.official_notes ?? '',
  }
}

const values = reactive<BeanFormValues>(initialValues())

const photo = ref<CompressedImage | null>(null)
const photoCleared = ref(false)
const nameError = ref('')
// 欄位層級的錯誤留在該欄位下方，但按鈕正下方也要有一則總結：
// 長表單上使用者的視線在按鈕附近，只在上方顯示會讓人以為沒反應。
const summaryError = ref('')

// 產區是自由文字，建議來源是使用者自己填過的值，沒有歷史就沒有建議
const regionSuggestions = ref<string[]>([])


// 查表載入失敗時要講出來，不要讓下拉默默變成空的
const lookupError = ref('')

onMounted(async () => {
  try {
    await loadLookups()
  }
  catch (e) {
    lookupError.value = `產區建議讀不到：${errorText(e)}`
  }
})

async function loadLookups() {
  // 產國由 CountrySelect 自己查（它需要 continent 與英文名，欄位與這裡不同，
  // 共用同一個快取 key 會讓後到的那份缺欄位）。這裡只剩產區建議。
  const regionResult = await supabase
    .from('beans').select('region').not('region', 'is', null).order('region')
  const seen = (regionResult.data ?? []) as unknown as { region: string | null }[]
  regionSuggestions.value = [...new Set(seen.map(row => row.region).filter((v): v is string => !!v))]
}

function onPhotoPicked(picked: CompressedImage | null) {
  photo.value = picked
  photoCleared.value = picked === null
  // 使用者自己選了（或移除了）：還原來的那張與「沒能還原」的說明都不再適用
  photoNotice.value = ''
  setRestoredUrl(null)
}

const roastOptions: { value: RoastLevel; label: string }[] = (
  ['light', 'medium_light', 'medium', 'medium_dark', 'dark'] as RoastLevel[]
).map(value => ({ value, label: roastLabels[value] }))

function submit() {
  // 錯誤訊息只在送出時顯示，不在輸入過程中即時跳出（《03》§4.1）
  nameError.value = values.name.trim() ? '' : '豆名尚未填寫'
  if (nameError.value) {
    summaryError.value = '沒有儲存：豆名尚未填寫'
    return
  }
  summaryError.value = ''
  emit('submit', {
    values: { ...values, name: values.name.trim() },
    photo: photo.value,
    photoCleared: photoCleared.value,
  })
}

// ── 自動暫存（§6）────────────────────────────────────────
// 文字欄位進 localStorage（useFormDraft），豆袋照片進 IndexedDB（draftPhotos），
// 兩邊用同一個 key。手機瀏覽器會回收背景分頁，切去別的 app 再回來就等同
// 重新整理——照片不暫存的話，最容易遺失資料的情境正好把它弄丟。
//
// 文字暫存裡的 photo 只是「本來有照片」的標記：
//   - 照片讀不回來時靠它說明，其他欄位照常還原
//   - 只選了照片、還沒打字的表單也會被暫存——照片是逃生路徑，
//     不想打字的人第一個動作就是它

type BeanDraft = BeanFormValues & { photo?: boolean }

const BEAN_REFERENCE_FIELDS = ['country_id', 'processing_method_id', 'variety_id']
const draftNote = ref('')
const photoNotice = ref('')
/** 從暫存還原的照片。預覽優先用它，其次才是已經上傳的那張 */
const restoredPhotoUrl = ref<string | null>(null)
/** 「全部清除」時換 key 讓 PhotoField 重建，連它自己的預覽一起清掉 */
const photoFieldKey = ref(0)
/** 已經寫進 IndexedDB 的那張——還原回來的不必再寫一次 */
let persistedPhoto: CompressedImage | null = null

function setRestoredUrl(url: string | null) {
  if (restoredPhotoUrl.value) URL.revokeObjectURL(restoredPhotoUrl.value)
  restoredPhotoUrl.value = url
}
onBeforeUnmount(() => setRestoredUrl(null))

async function restorePhoto(storageKey: string) {
  const image = await draftPhotos.load(storageKey)
  // 等 IndexedDB 的這段時間使用者已經自己選了照片：以他選的為準
  if (photo.value) return
  if (!image) {
    photoNotice.value = PHOTO_NOT_RESTORED
    return
  }
  persistedPhoto = image
  photo.value = image
  photoCleared.value = false
  setRestoredUrl(URL.createObjectURL(image.blob))
}

function resetPhoto() {
  photo.value = null
  photoCleared.value = false
  photoNotice.value = ''
  setRestoredUrl(null)
  photoFieldKey.value++
}

async function sanitizeDraft(incoming: BeanDraft): Promise<BeanDraft> {
  const alive = new Set<string>()
  const [countryRes, processingRes, varietyRes] = await Promise.all([
    incoming.country_id
      ? supabase.from('countries').select('id').in('id', [incoming.country_id])
      : Promise.resolve({ data: [] }),
    incoming.processing_method_id
      ? supabase.from('processing_methods').select('id').in('id', [incoming.processing_method_id])
      : Promise.resolve({ data: [] }),
    incoming.variety_id
      ? supabase.from('varieties').select('id').in('id', [incoming.variety_id])
      : Promise.resolve({ data: [] }),
  ])
  for (const result of [countryRes, processingRes, varietyRes]) {
    for (const row of (result.data ?? []) as unknown as { id: string }[]) alive.add(row.id)
  }

  const pruned = pruneMissingIds(
    incoming as unknown as Record<string, unknown>,
    BEAN_REFERENCE_FIELDS,
    id => alive.has(id),
  )
  if (pruned.dropped.length) {
    draftNote.value = droppedFieldsMessage(pruned.dropped)
  }
  return pruned.data as unknown as BeanDraft
}

const storageKey = props.draftKey
const draft = storageKey
  ? useFormDraft<BeanDraft>(storageKey, {
      read: () => ({ ...values, photo: photo.value !== null }),
      restore: ({ photo: hadPhoto, ...data }) => {
        Object.assign(values, data)
        if (hadPhoto) void restorePhoto(storageKey)
      },
      reset: () => {
        Object.assign(values, initialValues())
        draftNote.value = ''
        resetPhoto()
      },
      // 儲存成功、重新開始、全部清除都走這裡：照片與文字一起刪
      onClear: () => {
        persistedPhoto = null
        void draftPhotos.remove(storageKey)
      },
      sanitize: sanitizeDraft,
    })
  : null

// 選照片、換照片、移除照片都立刻寫進 IndexedDB，不等 debounce：
// 照片是整份表單裡最難重來的東西
if (storageKey) {
  watch(photo, (value) => {
    if (value === persistedPhoto) return
    persistedPhoto = value
    if (value) void draftPhotos.save(storageKey, value)
    else void draftPhotos.remove(storageKey)
  })
}

// 儲存成功後由頁面呼叫
defineExpose({ clearDraft: () => draft?.clear() })

const inputStyle = {
  minHeight: 'var(--touch-min)',
}

// 未選取的下拉要用 --text-muted，否則黑字看起來像已經填好的值
function selectStyle(value: unknown) {
  return { ...inputStyle, color: value == null ? 'var(--text-muted)' : 'var(--text)' }
}
</script>

<template>
  <form novalidate @submit.prevent="submit">
    <DraftBanner
      v-if="draft?.recovered.value"
      :note="draftNote"
      class="mb-6"
      @clear-all="draft.clearAll()"
    />

    <p
      v-else-if="draftNote"
      class="mb-6 rounded-sm px-3 py-2 text-sm"
      :style="{ background: 'var(--accent-wash)', color: 'var(--on-accent-wash)' }"
    >
      {{ draftNote }}
    </p>

    <DraftOverlay
      v-if="draft"
      :open="draft.pending.value !== null"
      @accept="draft.accept()"
      @discard="draft.discard()"
    />
    <!-- 逃生路徑：放在最上方，且不進卡片——它是媒體區塊不是欄位列，
         塞進卡片會變成框中框。 -->
    <PhotoField
      :key="photoFieldKey"
      :preview-url="restoredPhotoUrl ?? photoUrl ?? null"
      :notice="photoNotice"
      @picked="onPhotoPicked"
    />

    <FormCard class="mt-6">
      <FormRow>
        <!-- 只有必填欄位有標示，其他不標，讓對比本身說明「其他都可空」 -->
        <label class="block text-sm" for="bean-name">
          豆名
          <span :style="{ color: 'var(--danger)' }" aria-hidden="true">*</span>
          <span class="sr-only">必填</span>
        </label>
        <input
          id="bean-name"
          v-model="values.name"
          :data-filled="!!values.name"
          type="text"
          class="mt-1 block w-full field py-2.5"
          :style="inputStyle"
        >
        <p v-if="nameError" class="mt-2 text-sm" :style="{ color: 'var(--danger)' }">{{ nameError }}</p>
      </FormRow>

      <FormRow>
        <label class="block text-sm" for="bean-roaster">咖啡店名</label>
        <input
          id="bean-roaster"
          v-model="values.roaster"
          :data-filled="!!values.roaster"
          type="text"
          class="mt-1 block w-full field py-2.5"
          :style="inputStyle"
        >
      </FormRow>

      <FormRow>
        <label class="block text-sm" for="bean-roast-date">烘焙日期</label>
        <input
          id="bean-roast-date"
          v-model="values.roast_date"
          :data-filled="!!values.roast_date"
          type="date"
          class="mt-1 block w-full field py-2.5"
          :class="{ 'date-empty': !values.roast_date }"
          :style="inputStyle"
        >
        <p class="mt-1 text-xs text-muted">填了才會顯示養豆天數</p>
      </FormRow>

      <FormRow>
        <label class="block text-sm" for="bean-roast-level">烘焙度</label>
        <SelectField>
          <select
            id="bean-roast-level"
            v-model="values.roast_level"
            :data-filled="values.roast_level !== null"
            class="mt-1 block w-full field py-2.5"
            :style="selectStyle(values.roast_level)"
          >
            <option :value="null">選填</option>
            <option v-for="option in roastOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </SelectField>
      </FormRow>

      <FormRow>
        <CountrySelect v-model="values.country_id" />
      </FormRow>

      <FormRow>
        <label class="block text-sm" for="bean-region">產區</label>
        <input
          id="bean-region"
          v-model="values.region"
          :data-filled="!!values.region"
          type="text"
          list="bean-region-options"
          class="mt-1 block w-full field py-2.5"
          :style="inputStyle"
        >
        <!-- 建議來自使用者填過的值，沒有歷史就沒有建議，不擋任何輸入 -->
        <datalist id="bean-region-options">
          <option v-for="suggestion in regionSuggestions" :key="suggestion" :value="suggestion" />
        </datalist>
      </FormRow>

      <FormRow>
        <LookupSelect v-model="values.processing_method_id" label="處理法" table="processing_methods" />
      </FormRow>

      <FormRow>
        <LookupSelect v-model="values.variety_id" label="品種" table="varieties" />
      </FormRow>

      <FormRow>
        <label class="block text-sm" for="bean-notes">官方風味描述</label>
        <textarea
          id="bean-notes"
          v-model="values.official_notes"
          :data-filled="!!values.official_notes"
          rows="3"
          class="mt-1 block w-full field py-2.5"
        />
      </FormRow>
    </FormCard>

    <button
      type="submit"
      :disabled="busy"
      class="mt-6 w-full rounded-sm px-4 py-3 font-medium disabled:opacity-60"
      :style="{ background: 'var(--accent)', color: 'var(--on-accent)', minHeight: 'var(--touch-min)' }"
    >
      {{ busy ? '儲存中' : submitLabel }}
    </button>

    <!-- 錯誤訊息在按鈕正下方。放上方時長表單一捲動就看不到，
         使用者會以為「按了沒反應」。 -->
    <p
      v-if="error || summaryError || lookupError"
      role="alert"
      class="mt-3 rounded-sm border px-3 py-3 text-sm"
      :style="{ color: 'var(--danger)', borderColor: 'var(--danger)' }"
    >
      {{ error || summaryError || lookupError }}
    </p>
  </form>
</template>
