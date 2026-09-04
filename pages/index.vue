<script setup lang="ts">
// 首頁（《02-功能規格》§4）。
//
// **首頁不是「新增入口」，是「查閱起點」。** 兩種使用情境都是先看既有紀錄，
// 不是從零開始填表。上下兩區並存，不做視角切換——切換器會把決策成本
// 丟給使用者，而兩區並存已經同時滿足兩種需求。

const supabase = useSupabaseClient()
const { signedUrls } = useBeanPhotos()

const PAGE_SIZE = 20

interface ActiveBean {
  id: string
  name: string
  photo_path: string | null
  roast_date: string | null
  roast_level: RoastLevel | null
}

interface TimelineEntry {
  id: string
  brewedAt: string
  beanName: string | null
  dose: number | null
  waterTemp: number | null
  grindSetting: number | null
  isFavorite: boolean
  totalWater: number | null
  diffs: BrewDiff[]
}

const beans = ref<ActiveBean[]>([])
const photoUrls = ref<Map<string, string>>(new Map())
const brewCounts = ref<Map<string, number>>(new Map())
const favoriteCounts = ref<Map<string, number>>(new Map())
const timeline = ref<TimelineEntry[]>([])
const hasMore = ref(false)
const loading = ref(true)
const loadingMore = ref(false)
const loadError = ref('')

// 一筆紀錄要算差異，需要它自己與來源的參數、器材名稱與分段
const BREW_SELECT = `
  id, brewed_at, dose, water_temp, grind_setting, total_time, is_favorite, copied_from_brew_id,
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
      .select('brew_id, step_index, time_offset, cumulative_water, step_type, note')
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

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const [beanResult, countResult, brewResult] = await Promise.all([
      supabase
        .from('beans')
        .select('id, name, photo_path, roast_date, roast_level')
        .eq('is_finished', false)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false }),
      supabase.from('brews').select('bean_id, is_favorite'),
      supabase
        .from('brews')
        .select(BREW_SELECT)
        .order('brewed_at', { ascending: false })
        .order('id', { ascending: false })
        .range(0, PAGE_SIZE - 1),
    ])
    if (beanResult.error) throw toError(beanResult.error)
    if (brewResult.error) throw toError(brewResult.error)

    beans.value = (beanResult.data ?? []) as unknown as ActiveBean[]

    const counts = new Map<string, number>()
    const favorites = new Map<string, number>()
    for (const row of (countResult.data ?? []) as unknown as { bean_id: string, is_favorite: boolean }[]) {
      counts.set(row.bean_id, (counts.get(row.bean_id) ?? 0) + 1)
      if (row.is_favorite) favorites.set(row.bean_id, (favorites.get(row.bean_id) ?? 0) + 1)
    }
    brewCounts.value = counts
    favoriteCounts.value = favorites

    const rows = (brewResult.data ?? []) as unknown as BrewRow[]
    timeline.value = toEntries(rows)
    hasMore.value = rows.length === PAGE_SIZE

    // 第一趟到此為止，畫面可以出來了。
    loading.value = false

    // 第二趟：照片簽名網址與差異彼此不相依，一起發，也不再擋著畫面。
    // 照片取不到不該拖垮整頁。
    await Promise.all([
      signedUrls(beans.value.map(bean => bean.photo_path))
        .then((map) => { photoUrls.value = map })
        .catch(() => { photoUrls.value = new Map() }),
      enrichEntries(rows),
    ])
  }
  catch (e) {
    loadError.value = `讀不到資料：${errorText(e)}`
  }
  finally {
    // finally：任何失敗都不能讓頁面停在「讀取中」而看不到新增入口
    loading.value = false
  }
}

async function loadMore() {
  loadingMore.value = true
  try {
    const from = timeline.value.length
    const { data, error } = await supabase
      .from('brews')
      .select(BREW_SELECT)
      .order('brewed_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw toError(error)
    const rows = (data ?? []) as unknown as BrewRow[]
    timeline.value = [...timeline.value, ...toEntries(rows)]
    hasMore.value = rows.length === PAGE_SIZE
    loadingMore.value = false
    await enrichEntries(rows)
  }
  catch (e) {
    loadError.value = `讀不到更多紀錄：${errorText(e)}`
  }
  finally {
    loadingMore.value = false
  }
}

onMounted(load)

const isEmpty = computed(() => !loading.value && !loadError.value && !beans.value.length && !timeline.value.length)

// 只有一支未喝完的豆子時直接帶入，少一步選擇
const newBrewLink = computed(() =>
  beans.value.length === 1 ? `/brews/new?bean=${beans.value[0]!.id}` : '/brews/new',
)
</script>

<template>
  <!-- 底部留白同時避開分頁列與浮動按鈕 -->
  <main class="mx-auto px-5 pt-10 pb-32" :style="{ maxWidth: 'var(--content-max)' }">
    <div class="flex items-baseline justify-between">
      <h1 class="font-serif text-xl font-bold">手沖咖啡紀錄</h1>
      <NuxtLink to="/settings" class="text-sm underline" :style="{ color: 'var(--accent)' }">設定</NuxtLink>
    </div>

    <p v-if="loadError" role="alert" class="mt-4 text-sm" :style="{ color: 'var(--danger)' }">
      {{ loadError }}
    </p>

    <!-- 骨架：先把版面結構畫出來，資料回來再填。
         §6 不做進場動畫，所以這裡是靜態色塊，沒有閃爍效果。 -->
    <div v-if="loading" aria-busy="true" aria-label="讀取中">
      <section class="mt-8">
        <SkeletonBlock width="6rem" height="0.875rem" />
        <div class="-mx-5 mt-2 overflow-hidden">
          <ul class="flex gap-3 px-5">
            <li v-for="n in 2" :key="n">
              <SkeletonBlock width="9.5rem" height="12rem" radius="4px" />
            </li>
          </ul>
        </div>
      </section>
      <section class="mt-10">
        <SkeletonBlock width="4rem" height="0.875rem" />
        <ul class="mt-4 space-y-6">
          <li v-for="n in 4" :key="n">
            <SkeletonBlock width="7rem" height="0.75rem" />
            <SkeletonBlock width="65%" height="1.125rem" class="mt-2" />
            <SkeletonBlock width="45%" height="0.875rem" class="mt-2" />
          </li>
        </ul>
      </section>
    </div>

    <!-- 空狀態是邀請行動的時機，不是說明現況的時機 -->
    <section v-else-if="isEmpty" class="mt-10">
      <h2 class="font-serif text-lg font-bold">從一支豆子開始</h2>
      <NuxtLink
        to="/beans/new"
        class="mt-6 block w-full rounded-sm px-4 py-3 text-center font-medium"
        :style="{ background: 'var(--accent)', color: 'var(--on-accent)', minHeight: 'var(--touch-min)' }"
      >
        新增豆子
      </NuxtLink>
    </section>

    <template v-else>
      <!-- 上區：沖煮中的豆子。沒有未喝完的豆子時整區不顯示，不放空狀態佔位。 -->
      <section v-if="beans.length" class="mt-8">
        <h2 class="text-sm text-muted">沖煮中的豆子</h2>
        <!-- 負邊距讓卡片列可以捲到螢幕邊緣，不被頁面內距切斷。
             內距放在 ul 而不是捲動容器上：捲動容器的 padding-right
             不一定會被算進可捲動範圍，最後一張卡片會貼死在螢幕邊緣。
             放在 ul 上就是它自己寬度的一部分，左右必然對稱。 -->
        <div class="-mx-5 mt-2 overflow-x-auto">
          <ul class="flex gap-3 px-5">
            <li v-for="bean in beans" :key="bean.id">
              <NuxtLink :to="`/beans/${bean.id}`" class="block">
                <HomeBeanCard
                  :name="bean.name"
                  :photo-url="bean.photo_path ? (photoUrls.get(bean.photo_path) ?? null) : null"
                  :roast-level="bean.roast_level"
                  :roast-date="bean.roast_date"
                  :brew-count="brewCounts.get(bean.id) ?? 0"
                  :favorite-count="favoriteCounts.get(bean.id) ?? 0"
                />
              </NuxtLink>
            </li>
          </ul>
        </div>
      </section>

      <!-- 下區：沖煮紀錄時間軸 -->
      <section class="mt-8">
        <h2 class="text-sm text-muted">沖煮紀錄</h2>

        <p v-if="!timeline.length" class="mt-3 text-muted">
          記下第一次沖煮，之後就能比較每次的調整。
        </p>

        <ul v-else class="mt-1">
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
      </section>
    </template>

    <!-- 列表頁的新增入口一律是右下角浮動按鈕（§3 導覽） -->
    <NuxtLink
      :to="newBrewLink"
      aria-label="新增紀錄"
      class="fixed right-5 bottom-20 z-30 flex size-14 items-center justify-center rounded-full"
      :style="{ background: 'var(--accent)', color: 'var(--on-accent)', boxShadow: 'var(--overlay-shadow)' }"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      </svg>
    </NuxtLink>

    <BottomNav />
  </main>
</template>
