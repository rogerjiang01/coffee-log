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
// 膠囊上的文字（SelectField）：沒選時是 null，膠囊寫「選填」
const roastLabel = computed(() => values.roast_level ? roastLabels[values.roast_level] : null)

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
//
// photoRemoved 記的是「按過移除」。編輯頁上已上傳的那張不在 photo 裡，
// 不另外記的話，重新載入後舊照片會回來、儲存時也不會刪——
// 使用者以為移除了，實際上沒有。

type BeanDraft = BeanFormValues & { photo?: boolean, photoRemoved?: boolean }

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

// 實際存放的 key 帶使用者 id：A 的暫存與照片 B 讀不到（utils/draft.ts）
const storageKey = useScopedDraftKey(props.draftKey)
const draft = storageKey
  ? useFormDraft<BeanDraft>(storageKey, {
      read: () => ({ ...values, photo: photo.value !== null, photoRemoved: photoCleared.value }),
      restore: ({ photo: hadPhoto, photoRemoved, ...data }) => {
        Object.assign(values, data)
        // 兩者互斥：移除後再選一張，photoCleared 就回到 false
        if (photoRemoved) photoCleared.value = true
        else if (hadPhoto) void restorePhoto(storageKey)
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
    <!-- 按了「移除」就不再退回已上傳的那張：儲存時它會被刪掉，預覽要與之一致 -->
    <PhotoField
      :key="photoFieldKey"
      :preview-url="photoCleared ? null : (restoredPhotoUrl ?? photoUrl ?? null)"
      :notice="photoNotice"
      @picked="onPhotoPicked"
    />

    <!-- 卡片的分組（Figma 沒有畫這張表單，照記錄表單的做法與 iOS inset grouped 列表的慣例分）：
         這支豆子是誰／烘焙／產地與處理／官方風味描述。卡片之間 --gap-group。
         說明與錯誤用 FormNote，顯示在所在卡片的下方 -->
    <div class="flex flex-col" :style="{ gap: 'var(--gap-group)', marginTop: 'var(--gap-group)' }">
    <FormCard>
      <FormRow>
        <!-- 只有必填欄位有標示，其他不標，讓對比本身說明「其他都可空」。
             必填的列自己寫標籤（tests/unit/required-placeholder.test.mjs 靠這個標記找必填欄位） -->
        <div class="sheet-row">
          <label class="sheet-label" for="bean-name">豆名<span :style="{ color: 'var(--danger)' }" aria-hidden="true">*</span><span class="sr-only">必填</span><AlertIcon v-if="nameError" class="sheet-label-alert" /></label>
          <div class="sheet-value">
            <SheetText id="bean-name" v-model="values.name" placeholder="輸入豆名" />
          </div>
        </div>
      </FormRow>
      <FormNote v-if="nameError" tone="error">{{ nameError }}</FormNote>

      <FormRow label="咖啡店名" for="bean-roaster">
        <SheetText id="bean-roaster" v-model="values.roaster" />
      </FormRow>

    </FormCard>

    <FormCard>
      <FormRow label="烘焙日期" for="bean-roast-date">
        <!-- 膠囊上的字自己寫（utils/formDate.ts）：沒填是「選填」（iOS 的空日期什麼都不畫），
             填了是 YYYY/MM/DD，寬度貼合文字。原生的日期透明蓋在上面，點了照樣開系統的選擇器 -->
        <SelectField :text="pillDate(values.roast_date) ?? '選填'" :empty="!pillDate(values.roast_date)">
          <input
            id="bean-roast-date"
            v-model="values.roast_date"
            type="date"
          >
        </SelectField>
      </FormRow>
      <FormNote field="烘焙日期">填寫後顯示養豆天數</FormNote>

      <FormRow label="烘焙度" for="bean-roast-level">
        <SelectField :text="roastLabel ?? '選填'" :empty="!roastLabel">
          <select id="bean-roast-level" v-model="values.roast_level">
            <option :value="null">選填</option>
            <option v-for="option in roastOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </SelectField>
      </FormRow>

    </FormCard>

    <FormCard>
      <FormRow>
        <CountrySelect v-model="values.country_id" />
      </FormRow>

      <FormRow label="產區" for="bean-region">
        <SheetText id="bean-region" v-model="values.region" list="bean-region-options" />
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

    </FormCard>

    <!-- 只有一列：膠囊形（FormCard 的 pill）。打成好幾行時圓角不變 -->
    <FormCard pill>
      <FormRow label="官方風味描述" for="bean-notes">
        <textarea
          id="bean-notes"
          v-model="values.official_notes"
          rows="3"
          placeholder="選填"
          class="sheet-input"
        />
      </FormRow>
    </FormCard>
    </div>

    <!-- 表單最下方的儲存：膠囊形（《03》§4.18 的例外） -->
    <AppButton block
      type="submit"
      :busy="busy"
      :style="{ marginTop: 'var(--gap-section)' }"
    >
      {{ busy ? '儲存中' : submitLabel }}
    </AppButton>

    <!-- 暫存狀態：使用者在按儲存之前擔心東西安不安全，視線在這裡（《03》§4.11） -->
    <DraftStatus v-if="draft" :status="draft.status.value" class="mt-2" />

    <!-- 錯誤訊息在按鈕正下方。放上方時長表單一捲動就看不到，
         使用者會以為「按了沒反應」。 -->
    <p
      v-if="error || summaryError || lookupError"
      role="alert"
      class="mt-3 flex items-start gap-2 rounded-sm border px-3 py-3 text-sm"
      :style="{ color: 'var(--danger)', borderColor: 'var(--danger)' }"
    >
      <AlertIcon class="mt-0.5" />
      <span>{{ error || summaryError || lookupError }}</span>
    </p>
  </form>
</template>
