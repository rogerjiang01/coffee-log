<script setup lang="ts">
// 新增沖煮紀錄。
//
// 三種進入方式共用同一個表單，差別只在初始值（《02-功能規格》§5）：
//   /brews/new              從空白新增，帶入預設器材
//   /brews/new?bean={id}    同上，豆子已選定
//   /brews/new?copy={id}    複製既有紀錄
//
// 複製是本產品最高頻的路徑，優先做對。

const route = useRoute()
const supabase = useSupabaseClient()
const cache = useQueryCache()
const userId = useCurrentUserId()

const form = ref<{ clearDraft: () => void } | null>(null)
const saving = ref(false)
const error = ref('')

const ready = ref(false)
const initial = ref<Partial<BrewFormValues> | undefined>(undefined)
const initialSteps = ref<StepInput[] | undefined>(undefined)
const copiedFrom = ref<string | null>(null)

onMounted(async () => {
  const beanId = typeof route.query.bean === 'string' ? route.query.bean : null
  const copyId = typeof route.query.copy === 'string' ? route.query.copy : null

  if (!copyId) {
    if (beanId) initial.value = { bean_id: beanId }
    ready.value = true
    return
  }

  try {
    // 分段查的是 brew_id = copyId，而 copyId 從網址就拿到了，
    // 不必等上一筆查詢回來才發，兩個一起送。
    const [brewResult, stepResult] = await Promise.all([
      supabase
        .from('brews')
        .select('bean_id, brew_method_id, dose, water_temp, grinder_id, grind_setting, dripper_id, kettle_id, filter_id, server_id, total_time')
        .eq('id', copyId)
        .maybeSingle(),
      supabase
        .from('brew_steps')
        .select('step_index, time_offset, cumulative_water, step_type, note')
        .eq('brew_id', copyId)
        .order('step_index'),
    ])
    const data = brewResult.data

    if (data) {
      const source = data as unknown as Record<string, unknown>
      // 帶入參數與器材；品飲欄位一律不繼承——那是這一次的新體驗。
      // brewed_at 不帶入，用表單預設的當下。
      initial.value = {
        bean_id: (source.bean_id as string | null) ?? null,
        brew_method_id: (source.brew_method_id as string | null) ?? null,
        dose: (source.dose as number | null) ?? null,
        water_temp: (source.water_temp as number | null) ?? null,
        grinder_id: (source.grinder_id as string | null) ?? null,
        grind_setting: (source.grind_setting as number | null) ?? null,
        dripper_id: (source.dripper_id as string | null) ?? null,
        kettle_id: (source.kettle_id as string | null) ?? null,
        filter_id: (source.filter_id as string | null) ?? null,
        server_id: (source.server_id as string | null) ?? null,
        total_time: (source.total_time as number | null) ?? null,
        brewed_at: toLocalInput(new Date()),
      }
      copiedFrom.value = copyId

      const rows = (stepResult.data ?? []) as unknown as StepRow[]
      // 完整分段，含備註與攪拌標記
      if (rows.length) {
        initialSteps.value = toStepInputs(rows, (source.total_time as number | null) ?? null)
      }
    }
    else {
      error.value = '找不到要複製的那筆紀錄'
    }
  }
  catch (e) {
    error.value = `讀不到來源紀錄：${errorText(e)}`
  }
  finally {
    ready.value = true
  }
})

async function onSubmit(payload: {
  values: BrewFormValues
  steps: StepInput[]
  flavorTagIds: string[]
  formDurationSeconds: number
}) {
  if (!userId.value) {
    error.value = SESSION_EXPIRED
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
    rating: values.rating,
    is_favorite: values.is_favorite,
    tasting_notes: values.tasting_notes.trim() || null,
    intensity: Object.keys(values.intensity).length ? values.intensity : null,
    brewed_at: fromLocalInput(values.brewed_at) ?? new Date().toISOString(),
    // 自動 diff 的唯一資料來源（§3.5）
    copied_from_brew_id: copiedFrom.value,
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
    error.value = `儲存失敗：${errorText(insertError)}`
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
      error.value = `紀錄存好了，但分段沒存進去：${errorText(stepError)}`
      return
    }
  }

  if (flavorTagIds.length) {
    await supabase.from('brew_flavor_tags').insert(
      flavorTagIds.map(id => ({ brew_id: brewId, flavor_tag_id: id, user_id: userId.value })) as never,
    )
  }

  // 存成功了，這份暫存沒有用了
  form.value?.clearDraft()
  cache.invalidateAfter({ kind: 'brew' })
  await navigateTo(`/brews/${brewId}`)
}
</script>

<template>
  <main class="mx-auto px-5 pt-10 pb-16" :style="{ maxWidth: 'var(--content-max)' }">
    <div class="flex items-baseline justify-between">
      <h1 class="font-serif text-xl font-bold">{{ copiedFrom ? '再沖一次' : '新增紀錄' }}</h1>
      <NuxtLink to="/" class="text-sm underline" :style="{ color: 'var(--accent)' }">取消</NuxtLink>
    </div>

    <p v-if="copiedFrom" class="mt-1 text-sm text-muted">
      代入上一次沖煮參數與沖煮流程
    </p>

    <!-- 骨架：表單的分組卡片先佔位，等資料回來換成真的表單。
         §6 不做進場動畫，所以是靜態色塊。 -->
    <div v-if="!ready" aria-busy="true" aria-label="讀取中" class="mt-8 space-y-4">
      <div
        v-for="card in 3" :key="card"
        class="rounded-sm border p-5"
        :style="{ borderColor: 'var(--border)', background: 'var(--surface)' }"
      >
        <SkeletonBlock width="5rem" height="0.875rem" />
        <div class="mt-4 space-y-4">
          <SkeletonBlock v-for="row in 3" :key="row" height="1.5rem" />
        </div>
      </div>
    </div>

    <div v-else class="mt-8">
      <BrewForm
        ref="form"
        draft-key="draft:brew:new"
        :initial="initial"
        :initial-steps="initialSteps"
        submit-label="儲存"
        :busy="saving"
        :error="error"
        @submit="onSubmit"
      />
    </div>
  </main>
</template>
