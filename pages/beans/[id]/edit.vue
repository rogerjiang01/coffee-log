<script setup lang="ts">
// 編輯豆子。與新增共用同一個表單，差別只在初始值與照片已存在。

const route = useRoute()
const supabase = useSupabaseClient()
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

onMounted(async () => {
  try {
    const { data } = await supabase
      .from('beans')
      .select('name, photo_path, roaster, roast_date, roast_level, country_id, region, processing_method_id, variety_id, official_notes')
      .eq('id', id.value)
      .maybeSingle()

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
    loading.value = false
  }
  catch (e) {
    loadError.value = e instanceof Error ? `讀不到資料：${e.message}` : '讀不到資料'
  }
  finally {
    // finally：任何失敗都不能讓頁面停在「讀取中」
    loading.value = false
  }
})

async function onSubmit(
  { values, photo, photoCleared }: { values: BeanFormValues; photo: CompressedImage | null; photoCleared: boolean },
) {
  if (!userId.value) {
    error.value = '登入狀態好像過期了，重新登入一次再試'
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
      error.value = e instanceof Error ? e.message : '照片沒有上傳成功'
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
    error.value = `沒有存起來：${updateError.message}`
    return
  }
  form.value?.clearDraft()
  await navigateTo(`/beans/${id.value}`)
}
</script>

<template>
  <main class="mx-auto px-5 py-10" :style="{ maxWidth: 'var(--content-max)' }">
    <p v-if="loadError" role="alert" class="text-sm" :style="{ color: 'var(--danger)' }">{{ loadError }}</p>
    <p v-if="loading" class="text-muted">讀取中</p>

    <template v-else-if="notFound">
      <h1 class="font-serif text-xl font-bold">找不到這支豆子</h1>
      <NuxtLink to="/beans" class="mt-4 inline-block underline" :style="{ color: 'var(--accent)' }">
        回豆子列表
      </NuxtLink>
    </template>

    <template v-else>
      <div class="flex items-baseline justify-between">
        <h1 class="font-serif text-xl font-bold">編輯豆子</h1>
        <NuxtLink :to="`/beans/${id}`" class="text-sm underline" :style="{ color: 'var(--accent)' }">取消</NuxtLink>
      </div>

      <div class="mt-8">
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
