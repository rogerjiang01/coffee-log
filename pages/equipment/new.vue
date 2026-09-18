<script setup lang="ts">
// 新增器材。流程型畫面：左上 ‹ 離開（暫存保留），底部是儲存（《03》§3）。

definePageMeta({ screen: 'flow' })

const supabase = useSupabaseClient()
const cache = useQueryCache()
const userId = useCurrentUserId()

const form = ref<{ clearDraft: () => void } | null>(null)
const saving = ref(false)
const error = ref('')

async function onSubmit(values: EquipmentFormValues) {
  if (!userId.value) {
    error.value = SESSION_EXPIRED
    return
  }
  saving.value = true
  error.value = ''
  try {
    if (values.is_default) await clearDefaultEquipment(supabase, userId.value, values.type)
    const { error: insertError } = await supabase.from('user_equipment').insert({
      user_id: userId.value,
      type: values.type,
      catalog_id: values.catalog_id,
      custom_name: values.catalog_id ? null : values.custom_name.trim(),
      note: values.note.trim() || null,
      is_default: values.is_default,
    } as never)
    if (insertError) throw toError(insertError)
  }
  catch (e) {
    saving.value = false
    error.value = `儲存失敗：${errorText(e)}`
    return
  }
  // 存成功了，這份暫存沒有用了
  form.value?.clearDraft()
  cache.invalidateAfter({ kind: 'equipment' })
  await navigateTo('/equipment')
}
</script>

<template>
  <main class="mx-auto px-5 pt-10 pb-16" :style="{ maxWidth: 'var(--content-max)' }">
    <PageHeader title="新增器材" back="/equipment" back-label="離開" />

    <div class="mt-8">
      <EquipmentForm
        ref="form"
        draft-key="draft:equipment:new"
        submit-label="儲存"
        :busy="saving"
        :error="error"
        @submit="onSubmit"
      />
    </div>
  </main>
</template>
