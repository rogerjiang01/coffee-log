<script setup lang="ts">
// 新增豆子。必填只有 name。
//
// 照片的上傳順序：先建立豆子取得 id，再以 {user_id}/{bean_id}.{ext} 上傳，
// 最後回寫 photo_path。路徑格式由 §7 決定，而 bean_id 在建立前不存在。

const supabase = useSupabaseClient()
const userId = useCurrentUserId()
const { upload } = useBeanPhotos()

const form = ref<{ clearDraft: () => void } | null>(null)
const saving = ref(false)
const error = ref('')

async function onSubmit({ values, photo }: { values: BeanFormValues; photo: CompressedImage | null }) {
  if (!userId.value) {
    error.value = '登入狀態好像過期了，重新登入一次再試'
    return
  }
  saving.value = true
  error.value = ''

  // 空字串一律轉 null，避免資料庫留下一堆空字串
  const row = {
    user_id: userId.value,
    name: values.name,
    roaster: values.roaster.trim() || null,
    roast_date: values.roast_date || null,
    roast_level: values.roast_level,
    country_id: values.country_id,
    region: values.region.trim() || null,
    processing_method_id: values.processing_method_id,
    variety_id: values.variety_id,
    official_notes: values.official_notes.trim() || null,
  }

  const { data, error: insertError } = await supabase
    .from('beans')
    .insert(row as never)
    .select('id')
    .single()

  if (insertError || !data) {
    saving.value = false
    error.value = `沒有存起來：${errorText(insertError)}`
    return
  }

  const beanId = (data as unknown as { id: string }).id

  if (photo) {
    try {
      const path = await upload(userId.value, beanId, photo)
      await supabase.from('beans').update({ photo_path: path } as never).eq('id', beanId)
    }
    catch (e) {
      // 豆子已經建立成功，照片失敗不該把整筆丟掉
      saving.value = false
      // 豆子已經建立成功，暫存留著只會在下次進來時問一次舊資料
      form.value?.clearDraft()
      error.value = e instanceof Error
        ? `${errorText(e)}。豆子已經存好了，可以到編輯頁再上傳一次。`
        : '照片沒有上傳成功，豆子已經存好了。'
      return
    }
  }

  form.value?.clearDraft()
  await navigateTo(`/beans/${beanId}`)
}
</script>

<template>
  <main class="mx-auto px-5 py-10" :style="{ maxWidth: 'var(--content-max)' }">
    <div class="flex items-baseline justify-between">
      <h1 class="font-serif text-xl font-bold">新增豆子</h1>
      <NuxtLink to="/beans" class="text-sm underline" :style="{ color: 'var(--accent)' }">取消</NuxtLink>
    </div>

    <div class="mt-8">
      <BeanForm ref="form" draft-key="draft:bean:new" submit-label="儲存" :busy="saving" :error="error" @submit="onSubmit" />
    </div>
  </main>
</template>
