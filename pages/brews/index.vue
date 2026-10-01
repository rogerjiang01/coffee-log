<script setup lang="ts">
// 紀錄分頁（《02-功能規格》§4）：所有沖煮紀錄的時間軸。
//
// 紀錄的列表頁。紀錄詳情與編輯紀錄都屬於這個分頁（《03》§3），
// 詳情的 ‹ 沒有上一頁時、刪除紀錄之後，都回到這裡。
// 這一頁不做篩選、排序、搜尋。

definePageMeta({ screen: 'browse' })

const supabase = useSupabaseClient()
const fetchActiveBeans = useActiveBeans()

const PAGE_SIZE = 20

interface TimelineEntry {
  id: string
  brewedAt: string
  beanName: string | null
  dose: number | null
  waterTemp: number | null
  grindSetting: number | null
  isFavorite: boolean
  isSample: boolean
  totalWater: number | null
  diffs: BrewDiff[]
}

const activeBeans = ref<ActiveBean[]>([])
const timeline = ref<TimelineEntry[]>([])
const hasMore = ref(false)
const loading = ref(true)
const loadingMore = ref(false)
const loadError = ref('')

// 一筆紀錄要算差異，需要它自己與來源的參數、器材名稱與分段
const BREW_SELECT = `
  id, brewed_at, dose, water_temp, grind_setting, total_time, is_favorite, is_sample, copied_from_brew_id,
  brew_method_id, grinder_id, dripper_id, kettle_id,
  beans ( name ),
  brew_methods ( name ),
  grinder:grinder_id ( custom_name, equipment_catalog ( brand, model, variant ) ),
  dripper:dripper_id ( custom_name, equipment_catalog ( brand, model, variant ) ),
  kettle:kettle_id ( custom_name, equipment_catalog ( brand, model, variant ) )
`

type BrewRow = Record<string, unknown>

function toSubject(row: BrewRow, steps: StepRow[]): DiffSubject {
  const equipmentName = (value: unknown) =>
    value ? equipmentOptionName(value as { custom_name: string | null, equipment_catalog: { brand: string, model: string, variant: string | null } | null }) : null
  return {
    dose: (row.dose as number | null) ?? null,
    water_temp: (row.water_temp as number | null) ?? null,
    grind_setting: (row.grind_setting as number | null) ?? null,
    total_time: (row.total_time as number | null) ?? null,
    grinder_id: (row.grinder_id as string | null) ?? null,
    dripper_id: (row.dripper_id as string | null) ?? null,
    kettle_id: (row.kettle_id as string | null) ?? null,
    brew_method_id: (row.brew_method_id as string | null) ?? null,
    grinderName: equipmentName(row.grinder),
    dripperName: equipmentName(row.dripper),
    kettleName: equipmentName(row.kettle),
    methodName: (row.brew_methods as { name: string } | null)?.name ?? null,
    steps,
  }
}

/**
 * 先把一頁紀錄變成時間軸項目。
 *
 * 差異與總水量都還沒有——它們需要來源紀錄與分段，那是另一趟來回。
 * 列表先畫出來，那兩樣稍後補上：使用者要看的「哪天沖了哪支豆子」
 * 在第一趟就已經到手，沒有理由陪著差異一起等。
 */
function toEntries(rows: BrewRow[]): TimelineEntry[] {
  return rows.map(row => ({
    id: row.id as string,
    brewedAt: row.brewed_at as string,
    beanName: (row.beans as { name: string } | null)?.name ?? null,
    dose: (row.dose as number | null) ?? null,
    waterTemp: (row.water_temp as number | null) ?? null,
    grindSetting: (row.grind_setting as number | null) ?? null,
    isFavorite: (row.is_favorite as boolean | null) ?? false,
    isSample: (row.is_sample as boolean | null) ?? false,
    totalWater: null,
    diffs: [],
  }))
}

/** 補上總水量與差異。就地改寫已經在畫面上的項目，不重排列表。 */
async function enrichEntries(rows: BrewRow[]) {
  if (!rows.length) return
  const sourceIds = [...new Set(
    rows.map(row => row.copied_from_brew_id as string | null).filter((id): id is string => !!id),
  )]

  // 來源紀錄與所有分段各用一次查詢取回，不要每筆各查一次
  const [sourceResult, stepResult] = await Promise.all([
    sourceIds.length
      ? supabase.from('brews').select(BREW_SELECT).in('id', sourceIds)
      : Promise.resolve({ data: [] }),
    supabase
      .from('brew_steps')
      .select('brew_id, step_index, hold_seconds, cumulative_water, step_type, note')
      .in('brew_id', [...rows.map(row => row.id as string), ...sourceIds])
      .order('step_index'),
  ])

  const sources = new Map(
    ((sourceResult.data ?? []) as unknown as BrewRow[]).map(row => [row.id as string, row]),
  )
  const stepsByBrew = new Map<string, StepRow[]>()
  for (const row of (stepResult.data ?? []) as unknown as (StepRow & { brew_id: string })[]) {
    if (!stepsByBrew.has(row.brew_id)) stepsByBrew.set(row.brew_id, [])
    stepsByBrew.get(row.brew_id)!.push(row)
  }

  const byId = new Map(timeline.value.map(entry => [entry.id, entry]))
  for (const row of rows) {
    const id = row.id as string
    const entry = byId.get(id)
    if (!entry) continue
    const ownSteps = stepsByBrew.get(id) ?? []
    const sourceId = row.copied_from_brew_id as string | null
    const source = sourceId ? sources.get(sourceId) : undefined

    entry.totalWater = ownSteps.length
      ? Math.max(...ownSteps.map(step => Number(step.cumulative_water)))
      : null
    entry.diffs = source
      ? computeBrewDiff(toSubject(row, ownSteps), toSubject(source, stepsByBrew.get(sourceId!) ?? []))
      : []
  }
}

const cache = useQueryCache()

async function fetchBrewPage(from: number) {
  const { data, error } = await supabase
    .from('brews')
    .select(BREW_SELECT)
    .order('brewed_at', { ascending: false })
    .order('id', { ascending: false })
    .range(from, from + PAGE_SIZE - 1)
  if (error) throw toError(error)
  return (data ?? []) as unknown as BrewRow[]
}

async function load() {
  loadError.value = ''

  // 未喝完的豆子只用來決定浮動新增按鈕要不要帶入豆子：不擋列表，
  // 讀不到也不顯示錯誤——按鈕退回空白新增，表單裡照樣能選豆子
  cache.swr(cacheKeys.beanActive(), fetchActiveBeans, {
    apply: (rows) => { activeBeans.value = rows },
  })

  const pageQuery = cache.swr(cacheKeys.brewPage(0), () => fetchBrewPage(0), {
    apply: (rows) => {
      timeline.value = toEntries(rows)
      hasMore.value = rows.length === PAGE_SIZE
      // 差異與總水量需要另一趟來回，不擋這一頁
      void enrichEntries(rows).catch(e => console.warn('[brews] 差異算不出來', e))
    },
    onError: (e) => { loadError.value = `讀不到資料：${errorText(e)}` },
  })

  // 命中時畫面同步就填好了，骨架連一幀都不該出現
  loading.value = !pageQuery.hit
  await pageQuery.settled
  loading.value = false
}

async function loadMore() {
  loadingMore.value = true
  const from = timeline.value.length
  await cache.swr(cacheKeys.brewPage(from), () => fetchBrewPage(from), {
    apply: (rows) => {
      timeline.value = [...timeline.value, ...toEntries(rows)]
      hasMore.value = rows.length === PAGE_SIZE
      void enrichEntries(rows).catch(e => console.warn('[brews] 差異算不出來', e))
    },
    onError: (e) => { loadError.value = `讀不到更多紀錄：${errorText(e)}` },
  }).settled
  loadingMore.value = false
}

onMounted(load)

// 與總覽的浮動新增按鈕同一條規則（utils/navigation.ts）
const newBrewLink = computed(() => newBrewEntry(activeBeans.value))
</script>

<template>
  <!-- 底部留白避開浮動按鈕，否則最後一筆會被永久遮住；分頁列的高度由 app.vue 讓出 -->
  <main class="mx-auto px-5 pt-10 pb-24" :style="{ maxWidth: 'var(--content-max)' }">
    <!-- 瀏覽型：頂部只有標題 -->
    <PageHeader title="紀錄" />

    <p v-if="loadError" role="alert" class="mt-4 text-sm" :style="{ color: 'var(--danger)' }">
      {{ loadError }}
    </p>

    <!-- 骨架：先把版面結構畫出來，資料回來再填。
         §6 不做進場動畫，所以這裡是靜態色塊，沒有閃爍效果。 -->
    <ul v-if="loading" aria-busy="true" aria-label="讀取中" class="mt-6 space-y-6">
      <li v-for="n in 4" :key="n">
        <SkeletonBlock width="7rem" height="0.75rem" />
        <SkeletonBlock width="65%" height="1.125rem" class="mt-2" />
        <SkeletonBlock width="45%" height="0.875rem" class="mt-2" />
      </li>
    </ul>

    <template v-else>
      <!-- 這一行說明的是畫面上看不到的機制（複製之後會顯示差異），
           不重複浮動新增按鈕，所以保留（《03》§5.6 的適用範圍） -->
      <p v-if="!timeline.length" class="mt-6 text-muted">
        記錄沖煮後，可以比較每次的調整。
      </p>

      <ul v-else class="mt-4">
        <li
          v-for="entry in timeline"
          :key="entry.id"
          class="border-t"
          :style="{ borderColor: 'var(--border)' }"
        >
          <NuxtLink :to="`/brews/${entry.id}`" class="block">
            <BrewTimelineItem
              :bean-name="entry.beanName"
              :brewed-at="entry.brewedAt"
              :dose="entry.dose"
              :total-water="entry.totalWater"
              :water-temp="entry.waterTemp"
              :grind-setting="entry.grindSetting"
              :is-favorite="entry.isFavorite"
              :is-sample="entry.isSample"
              :diffs="entry.diffs"
            />
          </NuxtLink>
        </li>
      </ul>

      <button
        v-if="hasMore"
        type="button"
        :disabled="loadingMore"
        class="mt-4 w-full rounded-sm border px-4 py-3 disabled:opacity-60"
        :style="{ borderColor: 'var(--border)', color: 'var(--accent)', minHeight: 'var(--touch-min)' }"
        @click="loadMore"
      >
        {{ loadingMore ? '載入中' : '載入更多' }}
      </button>
    </template>

    <!-- 列表頁的新增入口一律是右下角浮動按鈕（§3 導覽） -->
    <NuxtLink
      :to="newBrewLink"
      aria-label="新增紀錄"
      class="fixed right-5 bottom-20 z-30 flex size-14 items-center justify-center rounded-full"
      :style="{ background: 'var(--accent)', color: 'var(--on-accent)', boxShadow: 'var(--overlay-shadow)' }"
    >
      <svg
        width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"
        fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
      >
        <path d="M5 12h14" />
        <path d="M12 5v14" />
      </svg>
    </NuxtLink>
  </main>
</template>
