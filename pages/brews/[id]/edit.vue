<script setup lang="ts">
// 編輯沖煮紀錄。與新增共用同一個表單。
//
// 分段的更新採「全刪重建」：段數會增減、step_index 會重排，
// 逐筆比對的複雜度遠高於重建，而且容易留下孤兒列。

const route = useRoute()
const supabase = useSupabaseClient()
const userId = useCurrentUserId()

const id = computed(() => String(route.params.id))

const initial = ref<Partial<BrewFormValues> | null>(null)
const stepInputs = ref<StepInput[]>([])
const tagIds = ref<string[]>([])
const loading = ref(true)
const loadError = ref('')
const notFound = ref(false)
const saving = ref(false)
const error = ref('')

onMounted(async () => {
  try {
    const { data } = await supabase
      .from('brews')
      .select('bean_id, brew_method_id, dose, water_temp, grinder_id, grind_setting, dripper_id, kettle_id, filter_id, server_id, total_time, brewed_at, rating, is_favorite, tasting_notes, intensity')
      .eq('id', id.value)
      .maybeSingle()

    if (!data) {
      notFound.value = true
      return
    }
    const brew = data as unknown as Record<string, unknown>
    const totalTime = (brew.total_time as number | null) ?? null

    initial.value = {
      bean_id: (brew.bean_id as string | null) ?? null,
      brew_method_id: (brew.brew_method_id as string | null) ?? null,
      dose: (brew.dose as number | null) ?? null,
      water_temp: (brew.water_temp as number | null) ?? null,
      grinder_id: (brew.grinder_id as string | null) ?? null,
      grind_setting: (brew.grind_setting as number | null) ?? null,
      dripper_id: (brew.dripper_id as string | null) ?? null,
      kettle_id: (brew.kettle_id as string | null) ?? null,
      filter_id: (brew.filter_id as string | null) ?? null,
      server_id: (brew.server_id as string | null) ?? null,
      total_time: totalTime,
      brewed_at: toLocalInput(new Date(brew.brewed_at as string)),
      rating: (brew.rating as number | null) ?? null,
      is_favorite: (brew.is_favorite as boolean | null) ?? false,
      tasting_notes: (brew.tasting_notes as string | null) ?? '',
      intensity: (brew.intensity as Intensity | null) ?? {},
    }

    const { data: steps } = await supabase
      .from('brew_steps')
      .select('step_index, time_offset, cumulative_water, step_type, note')
      .eq('brew_id', id.value)
      .order('step_index')
    // 資料庫的累積時間點在這裡換算回介面的停留秒數
    const rows = (steps ?? []) as unknown as StepRow[]
    stepInputs.value = rows.length ? toStepInputs(rows, totalTime) : initialSteps()

    const { data: tags } = await supabase
      .from('brew_flavor_tags')
      .select('flavor_tag_id')
      .eq('brew_id', id.value)
    tagIds.value = ((tags ?? []) as unknown as { flavor_tag_id: string }[]).map(t => t.flavor_tag_id)

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

async function onSubmit(payload: {
  values: BrewFormValues
  steps: StepInput[]
  flavorTagIds: string[]
}) {
  if (!userId.value) {
    error.value = '登入狀態好像過期了，重新登入一次再試'
    return
  }
  const { values, steps, flavorTagIds } = payload
  saving.value = true
  error.value = ''

  // form_duration_seconds 只記錄新增時的填寫時間，編輯不覆蓋
  const { error: updateError } = await supabase
    .from('brews')
    .update({
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
      rating: values.rating,
      is_favorite: values.is_favorite,
      tasting_notes: values.tasting_notes.trim() || null,
      intensity: Object.keys(values.intensity).length ? values.intensity : null,
      brewed_at: fromLocalInput(values.brewed_at) ?? new Date().toISOString(),
    } as never)
    .eq('id', id.value)

  if (updateError) {
    saving.value = false
    error.value = `沒有存起來：${updateError.message}`
    return
  }

  await supabase.from('brew_steps').delete().eq('brew_id', id.value)
  const stepRows = toStepRows(steps).map(step => ({ ...step, brew_id: id.value, user_id: userId.value }))
  if (stepRows.length) {
    const { error: stepError } = await supabase.from('brew_steps').insert(stepRows as never)
    if (stepError) {
      saving.value = false
      error.value = `紀錄存好了，但分段沒存進去：${stepError.message}`
      return
    }
  }

  await supabase.from('brew_flavor_tags').delete().eq('brew_id', id.value)
  if (flavorTagIds.length) {
    await supabase.from('brew_flavor_tags').insert(
      flavorTagIds.map(tagId => ({ brew_id: id.value, flavor_tag_id: tagId, user_id: userId.value })) as never,
    )
  }

  saving.value = false
  await navigateTo(`/brews/${id.value}`)
}
</script>

<template>
  <main class="mx-auto px-5 pt-10 pb-16" :style="{ maxWidth: 'var(--content-max)' }">
    <p v-if="loadError" role="alert" class="text-sm" :style="{ color: 'var(--danger)' }">{{ loadError }}</p>
    <p v-if="loading" class="text-muted">讀取中</p>

    <template v-else-if="notFound">
      <h1 class="font-serif text-xl font-bold">找不到這筆紀錄</h1>
      <NuxtLink to="/" class="mt-4 inline-block underline" :style="{ color: 'var(--accent)' }">回首頁</NuxtLink>
    </template>

    <template v-else>
      <div class="flex items-baseline justify-between">
        <h1 class="font-serif text-xl font-bold">編輯紀錄</h1>
        <NuxtLink :to="`/brews/${id}`" class="text-sm underline" :style="{ color: 'var(--accent)' }">取消</NuxtLink>
      </div>

      <div class="mt-8">
        <BrewForm
          :initial="initial ?? undefined"
          :initial-steps="stepInputs"
          :initial-flavor-tag-ids="tagIds"
          submit-label="儲存"
          :busy="saving"
          :error="error"
          @submit="onSubmit"
        />
      </div>
    </template>
  </main>
</template>
