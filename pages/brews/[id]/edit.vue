<script setup lang="ts">
// 編輯沖煮紀錄。與新增共用同一個表單。
//
// 分段的更新採「全刪重建」：段數會增減、step_index 會重排，
// 逐筆比對的複雜度遠高於重建，而且容易留下孤兒列。

const route = useRoute()
const supabase = useSupabaseClient()
const cache = useQueryCache()
const userId = useCurrentUserId()

const id = computed(() => String(route.params.id))

const initial = ref<Partial<BrewFormValues> | null>(null)
const stepInputs = ref<StepInput[]>([])
const tagIds = ref<string[]>([])
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
    // 三個查詢都只靠網址上的 id，一起發。原本是一個接一個 await，
    // 三趟來回全部疊在使用者按下「編輯」到看見表單之間。
    const [brewResult, stepResult, tagResult] = await Promise.all([
      supabase
        .from('brews')
        .select('bean_id, brew_method_id, dose, water_temp, grinder_id, grind_setting, dripper_id, kettle_id, filter_id, server_id, total_time, brewed_at, rating, is_favorite, tasting_notes, intensity')
        .eq('id', id.value)
        .maybeSingle(),
      supabase
        .from('brew_steps')
        .select('step_index, hold_seconds, cumulative_water, step_type, note')
        .eq('brew_id', id.value)
        .order('step_index'),
      supabase.from('brew_flavor_tags').select('flavor_tag_id').eq('brew_id', id.value),
    ])

    // 三個都要檢查。分段或標籤讀不到卻照樣顯示表單，分段會退回模板、
    // 標籤是空的——按下儲存就把原本的分段與標籤刪掉換成這些（loadState.ts）
    const failed = firstQueryError(brewResult, stepResult, tagResult)
    if (failed) throw toError(failed)

    const data = brewResult.data
    if (!data) {
      notFound.value = true
      return
    }
    const brew = data as unknown as Record<string, unknown>
    const totalTime = (brew.total_time as number | null) ?? null

    // 分段欄位一對一，沒有換算
    const rows = (stepResult.data ?? []) as unknown as StepRow[]
    stepInputs.value = rows.length ? toStepInputs(rows) : initialSteps()

    tagIds.value = ((tagResult.data ?? []) as unknown as { flavor_tag_id: string }[])
      .map(t => t.flavor_tag_id)

    // 最後才設：initial 有值代表表單需要的東西全部到位
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

async function onSubmit(payload: {
  values: BrewFormValues
  steps: StepInput[]
  flavorTagIds: string[]
}) {
  if (!userId.value) {
    error.value = SESSION_EXPIRED
    return
  }
  const { values, steps, flavorTagIds } = payload
  saving.value = true
  error.value = ''

  // form_duration_seconds 只在新增時寫入，編輯不覆蓋也不累加：
  // 要量的是「記一筆要多久」，不是「總共花多少時間維護這筆」
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
    error.value = `儲存失敗：${errorText(updateError)}`
    return
  }

  await supabase.from('brew_steps').delete().eq('brew_id', id.value)
  const stepRows = toStepRows(steps).map(step => ({ ...step, brew_id: id.value, user_id: userId.value }))
  if (stepRows.length) {
    const { error: stepError } = await supabase.from('brew_steps').insert(stepRows as never)
    if (stepError) {
      saving.value = false
      error.value = `紀錄存好了，但分段沒存進去：${errorText(stepError)}`
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
  form.value?.clearDraft()
  cache.invalidateAfter({ kind: 'brew' })
  await navigateTo(`/brews/${id.value}`)
}
</script>

<template>
  <main class="mx-auto px-5 pt-10 pb-16" :style="{ maxWidth: 'var(--content-max)' }">
    <template v-if="view === 'notFound'">
      <h1 class="font-serif text-xl font-bold">找不到這筆紀錄</h1>
      <NuxtLink to="/" class="mt-4 inline-block underline" :style="{ color: 'var(--accent)' }">回首頁</NuxtLink>
    </template>

    <template v-else>
      <!-- 離開的入口不跟著資料走：讀取中、讀取失敗都要看得到 -->
      <div class="flex items-baseline justify-between">
        <h1 class="font-serif text-xl font-bold">編輯紀錄</h1>
        <NuxtLink :to="`/brews/${id}`" class="text-sm underline" :style="{ color: 'var(--accent)' }">取消</NuxtLink>
      </div>

      <!-- 骨架：表單的分組卡片先佔位，等資料回來換成真的表單。
           §6 不做進場動畫，所以是靜態色塊。 -->
      <div v-if="view === 'loading'" aria-busy="true" aria-label="讀取中" class="mt-8 space-y-4">
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

      <!-- 讀取失敗不渲染表單（loadState.ts）：那張表單可以儲存，
           而儲存會用不完整的內容覆蓋這筆紀錄 -->
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
        <BrewForm
          ref="form"
          :draft-key="`draft:brew:${id}`"
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
