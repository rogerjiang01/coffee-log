<script setup lang="ts">
// 新增豆子。必填只有 name。
//
// 照片的上傳順序：先建立豆子取得 id，再以 {user_id}/{bean_id}.{ext} 上傳，
// 最後回寫 photo_path。路徑格式由 §7 決定，而 bean_id 在建立前不存在。
//
// 流程型畫面（《03》§3）：左上 ‹ 離開（暫存保留），沒有分頁列，底部是儲存。

definePageMeta({ screen: 'flow' })

const supabase = useSupabaseClient()
const cache = useQueryCache()
const exitTo = useFlowExit()
const userId = useCurrentUserId()
const { upload } = useBeanPhotos()

const form = ref<{ clearDraft: () => void } | null>(null)
const saving = ref(false)
const error = ref('')

async function onSubmit({ values, photo }: { values: BeanFormValues; photo: CompressedImage | null }) {
  if (!userId.value) {
    error.value = SESSION_EXPIRED
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
    error.value = `儲存失敗：${errorText(insertError)}`
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
      // 豆子已經建立，只有照片失敗。兩個分支講同一件事，
      // 差別只在錯誤原因取不取得到。
      error.value = `照片上傳失敗：${errorText(e)}。豆子已儲存，可在編輯頁重新上傳照片`
      return
    }
  }

  form.value?.clearDraft()
  // 新的豆子要出現在列表與首頁上區
  cache.invalidateAfter({ kind: 'bean' })
  // 取代表單那一筆：儲存後按返回不會回到表單（useFlowExit）
  await exitTo(`/beans/${beanId}`)
}
</script>

<template>
  <main class="mx-auto px-5 py-10" :style="{ maxWidth: 'var(--content-max)' }">
    <!-- ‹ 是「離開」不是「取消」：暫存留著，回來還在（《04》） -->
    <PageHeader title="新增豆子" back="/beans" back-label="離開" />

    <div class="mt-8">
      <BeanForm ref="form" draft-key="draft:bean:new" submit-label="儲存" :busy="saving" :error="error" @submit="onSubmit" />
    </div>
  </main>
</template>
