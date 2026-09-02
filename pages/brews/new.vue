<script setup lang="ts">
// 新增沖煮紀錄。支援 ?bean={id} 帶入豆子。
// ?copy={id} 的複製流程是階段 6，這裡先不做。

const route = useRoute()
const supabase = useSupabaseClient()
const userId = useCurrentUserId()

const saving = ref(false)
const error = ref('')

const initial = computed(() => {
  const beanId = route.query.bean
  return typeof beanId === 'string' && beanId ? { bean_id: beanId } : undefined
})

async function onSubmit(payload: {
  values: BrewFormValues
  steps: StepInput[]
  flavorTagIds: string[]
  formDurationSeconds: number
}) {
  if (!userId.value) {
    error.value = '登入狀態好像過期了，重新登入一次再試'
    return
  }
  const { values, steps, flavorTagIds, formDurationSeconds } = payload

  saving.value = true
  error.value = ''

  const row = {
    user_id: userId.value,
    bean_id: values.bean_id,
    brew_method_id: values.brew_method_id,
    dose: values.dose,
    water_temp: values.water_temp,
    grinder_id: values.grinder_id,
    grind_setting: values.grind_setting,
    dripper_id: values.dripper_id,
    kettle_id: values.kettle_id,
    filter_id: values.filter_id,
    server_id: values.server_id,
    total_time: values.total_time,
    is_favorite: values.is_favorite,
    tasting_notes: values.tasting_notes.trim() || null,
    intensity: Object.keys(values.intensity).length ? values.intensity : null,
    brewed_at: fromLocalInput(values.brewed_at) ?? new Date().toISOString(),
    // 產品指標，使用者不可見（§9）
    form_duration_seconds: formDurationSeconds,
  }

  const { data, error: insertError } = await supabase
    .from('brews')
    .insert(row as never)
    .select('id')
    .single()

  if (insertError || !data) {
    saving.value = false
    error.value = `沒有存起來：${insertError?.message ?? '未知狀況'}`
    return
  }
  const brewId = (data as unknown as { id: string }).id

  // 分段：介面的停留秒數在這裡才換算成累積時間點
  const stepRows = toStepRows(steps).map(step => ({
    ...step,
    brew_id: brewId,
    user_id: userId.value,
  }))
  if (stepRows.length) {
    const { error: stepError } = await supabase.from('brew_steps').insert(stepRows as never)
    if (stepError) {
      saving.value = false
      error.value = `紀錄存好了，但分段沒存進去：${stepError.message}`
      return
    }
  }

  if (flavorTagIds.length) {
    await supabase.from('brew_flavor_tags').insert(
      flavorTagIds.map(id => ({ brew_id: brewId, flavor_tag_id: id, user_id: userId.value })) as never,
    )
  }

  await navigateTo(`/brews/${brewId}`)
}
</script>

<template>
  <main class="mx-auto px-5 pt-10 pb-16" :style="{ maxWidth: 'var(--content-max)' }">
    <div class="flex items-baseline justify-between">
      <h1 class="font-serif text-xl font-bold">新增紀錄</h1>
      <NuxtLink to="/" class="text-sm underline" :style="{ color: 'var(--accent)' }">取消</NuxtLink>
    </div>

    <div class="mt-8">
      <BrewForm :initial="initial" submit-label="儲存" :busy="saving" :error="error" @submit="onSubmit" />
    </div>
  </main>
</template>
