<script setup lang="ts">
// 編輯豆子。與新增共用同一個表單，差別只在初始值與照片已存在。
//
// 流程型畫面（《03》§3）：左上 ‹ 離開（暫存保留），沒有分頁列，底部是儲存。

definePageMeta({ screen: 'flow' })

const route = useRoute()
const supabase = useSupabaseClient()
const cache = useQueryCache()
const userId = useCurrentUserId()
const { upload, remove, signedUrl } = useBeanPhotos()

const id = computed(() => String(route.params.id))

const initial = ref<Partial<BeanFormValues> | null>(null)
const existingPath = ref<string | null>(null)
const photoUrl = ref<string | null>(null)
const loading = ref(true)
const loadError = ref('')
const notFound = ref(false)
const form = ref<{ clearDraft: () => void } | null>(null)
const saving = ref(false)
const error = ref('')

const view = computed(() => loadView({
  loading: loading.value,
  loadError: loadError.value,
  notFound: notFound.value,
  loaded: initial.value !== null,
}))

async function load() {
  loading.value = true
  loadError.value = ''
  notFound.value = false
  initial.value = null
  try {
    const result = await supabase
      .from('beans')
      .select('name, photo_path, roaster, roast_date, roast_level, country_id, region, processing_method_id, variety_id, official_notes')
      .eq('id', id.value)
      .maybeSingle()

    // 查詢失敗不是「找不到」：supabase-js 不拋例外，要自己看 error（loadState.ts）
    const failed = firstQueryError(result)
    if (failed) throw toError(failed)

    const data = result.data
    if (!data) {
      notFound.value = true
      return
    }
    const bean = data as unknown as Record<string, unknown>
    existingPath.value = (bean.photo_path as string | null) ?? null
    photoUrl.value = await signedUrl(existingPath.value)
    initial.value = {
      name: (bean.name as string) ?? '',
      roaster: (bean.roaster as string | null) ?? '',
      roast_date: (bean.roast_date as string | null) ?? '',
      roast_level: (bean.roast_level as RoastLevel | null) ?? null,
      country_id: (bean.country_id as string | null) ?? null,
      region: (bean.region as string | null) ?? '',
      processing_method_id: (bean.processing_method_id as string | null) ?? null,
      variety_id: (bean.variety_id as string | null) ?? null,
      official_notes: (bean.official_notes as string | null) ?? '',
    }
  }
  catch (e) {
    initial.value = null
    loadError.value = `讀不到資料：${errorText(e)}`
  }
  finally {
    // finally：任何失敗都不能讓頁面停在「讀取中」
    loading.value = false
  }
}

onMounted(load)

async function onSubmit(
  { values, photo, photoCleared }: { values: BeanFormValues; photo: CompressedImage | null; photoCleared: boolean },
) {
  if (!userId.value) {
    error.value = SESSION_EXPIRED
    return
  }
  saving.value = true
  error.value = ''

  let path = existingPath.value

  if (photo) {
    try {
      path = await upload(userId.value, id.value, photo)
    }
    catch (e) {
      saving.value = false
      error.value = errorText(e)
      return
    }
  }
  else if (photoCleared && existingPath.value) {
    await remove(existingPath.value)
    path = null
  }

  const { error: updateError } = await supabase
    .from('beans')
    .update({
      name: values.name,
      roaster: values.roaster.trim() || null,
      roast_date: values.roast_date || null,
      roast_level: values.roast_level,
      country_id: values.country_id,
      region: values.region.trim() || null,
      processing_method_id: values.processing_method_id,
      variety_id: values.variety_id,
      official_notes: values.official_notes.trim() || null,
      photo_path: path,
    } as never)
    .eq('id', id.value)

  saving.value = false
  if (updateError) {
    error.value = `儲存失敗：${errorText(updateError)}`
    return
  }
  form.value?.clearDraft()
  // 豆名與烘焙日期被內嵌在沖煮查詢裡，時間軸與紀錄詳情也要重來
  cache.invalidateAfter({ kind: 'bean' })
  await navigateTo(`/beans/${id.value}`)
}
</script>

<template>
  <main class="mx-auto px-5 py-10" :style="{ maxWidth: 'var(--content-max)' }">
    <!-- ‹ 在所有狀態判斷之外。它是「離開」不是「取消」：暫存留著，回來還在（《04》）。
         找不到這一筆時回上一層的列表——回到它的詳情頁只會再看到一次「找不到」 -->
    <PageHeader
      :title="view === 'notFound' ? '找不到這支豆子' : '編輯豆子'"
      :back="view === 'notFound' ? '/beans' : `/beans/${id}`"
      back-label="離開"
    />

    <template v-if="view !== 'notFound'">
      <div v-if="view === 'loading'" aria-busy="true" aria-label="讀取中" class="mt-8 space-y-4">
        <div
          v-for="card in 2" :key="card"
          class="rounded-sm border p-5"
          :style="{ borderColor: 'var(--border)', background: 'var(--surface)' }"
        >
          <SkeletonBlock width="5rem" height="0.875rem" />
          <div class="mt-4 space-y-4">
            <SkeletonBlock v-for="row in 3" :key="row" height="1.5rem" />
          </div>
        </div>
      </div>

      <!-- 讀取失敗不渲染表單（loadState.ts）：那張表單可以儲存，
           而儲存會用空白的內容覆蓋這支豆子 -->
      <div v-else-if="view === 'error'" class="mt-8">
        <p role="alert" class="text-sm" :style="{ color: 'var(--danger)' }">{{ loadError }}</p>
        <button
          type="button"
          class="mt-4 w-full rounded-sm border px-4 py-3"
          :style="{ borderColor: 'var(--border-strong)', minHeight: 'var(--touch-min)' }"
          @click="load"
        >
          重試
        </button>
      </div>

      <div v-else-if="view === 'ready'" class="mt-8">
        <BeanForm
          ref="form"
          :draft-key="`draft:bean:${id}`"
          :initial="initial ?? undefined"
          :photo-url="photoUrl"
          submit-label="儲存"
          :busy="saving"
          :error="error"
          @submit="onSubmit"
        />
      </div>
    </template>
  </main>
</template>
