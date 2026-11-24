<script setup lang="ts">
// 紀錄分頁（《02-功能規格》§4.2）：所有沖煮紀錄，一筆一張紀錄卡片（BrewCard，《03》§4.21）。
//
// 紀錄的列表頁。紀錄詳情與編輯紀錄都屬於這個分頁（《03》§3），
// 詳情的 ‹ 沒有上一頁時、刪除紀錄之後，都回到這裡。
// 這一頁不做篩選、排序、搜尋。

definePageMeta({ screen: 'browse' })

const supabase = useSupabaseClient()
const fetchActiveBeans = useActiveBeans()
const { thumbnailUrls } = useBeanPhotos()

const PAGE_SIZE = 20

interface TimelineEntry {
  id: string
  brewedAt: string
  beanName: string | null
  photoPath: string | null
  roastLevel: RoastLevel | null
  rating: number | null
  dose: number | null
  waterTemp: number | null
  grindSetting: number | null
  totalTime: number | null
  isFavorite: boolean
  totalWater: number | null
}

const activeBeans = ref<ActiveBean[]>([])
const timeline = ref<TimelineEntry[]>([])
const photoUrls = ref<Map<string, string>>(new Map())
const hasMore = ref(false)
const loading = ref(true)
const loadingMore = ref(false)
const loadError = ref('')

// 卡片只呈現「這一杯」，不和上一杯比較（《02》§4.2）：不查比較對象，也不算差異。
// 差異只在紀錄詳情頁與結算頁
const BREW_SELECT = `
  id, brewed_at, dose, water_temp, grind_setting, total_time, rating, is_favorite,
  beans ( name, photo_path, roast_level )
`

type BrewRow = Record<string, unknown>
type BeanRow = { name: string, photo_path: string | null, roast_level: RoastLevel | null } | null

/**
 * 先把一頁紀錄變成卡片。總水量（粉水比要用）需要分段，那是另一趟來回：
 * 列表先畫出來，粉水比稍後補上。
 */
function toEntries(rows: BrewRow[]): TimelineEntry[] {
  return rows.map((row) => {
    const bean = row.beans as BeanRow
    return {
      id: row.id as string,
      brewedAt: row.brewed_at as string,
      beanName: bean?.name ?? null,
      photoPath: bean?.photo_path ?? null,
      roastLevel: bean?.roast_level ?? null,
      rating: (row.rating as number | null) ?? null,
      dose: (row.dose as number | null) ?? null,
      waterTemp: (row.water_temp as number | null) ?? null,
      grindSetting: (row.grind_setting as number | null) ?? null,
      totalTime: (row.total_time as number | null) ?? null,
      isFavorite: (row.is_favorite as boolean | null) ?? false,
      totalWater: null,
    }
  })
}

/**
 * 補上總水量與縮圖。就地改寫已經在畫面上的項目，不重排列表。
 * 一頁兩個請求並行（這一頁的分段、縮圖網址），不是每一列各發一次。
 */
async function enrichEntries(entries: TimelineEntry[]) {
  if (!entries.length) return
  const ids = entries.map(entry => entry.id)
  const [stepResult, urls] = await Promise.all([
    supabase.from('brew_steps').select('brew_id, cumulative_water').in('brew_id', ids),
    thumbnailUrls(entries.map(entry => entry.photoPath)).catch(() => new Map<string, string>()),
  ])

  photoUrls.value = new Map([...photoUrls.value, ...urls])

  const water = new Map<string, number>()
  for (const row of (stepResult.data ?? []) as { brew_id: string, cumulative_water: number | null }[]) {
    if (row.cumulative_water === null) continue
    water.set(row.brew_id, Math.max(water.get(row.brew_id) ?? 0, Number(row.cumulative_water)))
  }
  const byId = new Map(timeline.value.map(entry => [entry.id, entry]))
  for (const id of ids) {
    const entry = byId.get(id)
    if (entry) entry.totalWater = water.get(id) ?? null
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
      // 總水量與縮圖需要另一趟來回，不擋這一頁
      void enrichEntries(timeline.value).catch(e => console.warn('[brews] 粉水比或縮圖讀不到', e))
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
      const added = toEntries(rows)
      timeline.value = [...timeline.value, ...added]
      hasMore.value = rows.length === PAGE_SIZE
      void enrichEntries(added).catch(e => console.warn('[brews] 粉水比或縮圖讀不到', e))
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

    <!-- 骨架：卡片的形狀（標題區三行、分隔線、五欄），資料回來再填。
         §6 不做進場動畫，所以這裡是靜態色塊，沒有閃爍效果。 -->
    <ul v-if="loading" aria-busy="true" aria-label="讀取中" class="mt-6 space-y-3">
      <li v-for="n in 4" :key="n">
        <AppCard radius="ml" class="brew-card-skeleton">
          <!-- 標題區和 BrewCard 同一套切換：卡片內容寬 ≥ 276px 是兩行（縮圖 52），否則三行（縮圖 80） -->
          <div class="flex items-start gap-4">
            <div class="brew-skeleton__thumb shrink-0" />
            <div class="brew-skeleton__lines flex flex-1 flex-col gap-1">
              <div class="flex h-6 items-center"><SkeletonBlock width="65%" height="1rem" /></div>
              <div class="flex h-6 items-center"><SkeletonBlock width="7.25rem" height="1rem" /></div>
              <div class="brew-skeleton__date flex h-6 items-center"><SkeletonBlock width="45%" height="1rem" /></div>
            </div>
          </div>
          <div class="my-3 h-px" :style="{ background: 'var(--border)' }" />
          <div class="brew-skeleton__params grid grid-cols-5 py-2.5">
            <div v-for="m in 5" :key="m" class="space-y-2 pt-1">
              <SkeletonBlock width="70%" height="0.875rem" />
              <SkeletonBlock width="80%" height="1rem" />
            </div>
          </div>
        </AppCard>
      </li>
    </ul>

    <template v-else>
      <!-- 這一行說明的是畫面上看不到的機制（複製之後，紀錄詳情頁會顯示和那一杯的差異；
           列表的卡片不顯示差異），不重複浮動新增按鈕，所以保留（《03》§5.6 的適用範圍） -->
      <p v-if="!timeline.length" class="mt-6 text-muted">
        記錄沖煮後，可以比較每次的調整。
      </p>

      <ul v-else class="mt-6 space-y-3">
        <li v-for="entry in timeline" :key="entry.id">
          <BrewCard
            :id="entry.id"
            :bean-name="entry.beanName"
            :photo-url="entry.photoPath ? (photoUrls.get(entry.photoPath) ?? null) : null"
            :roast-level="entry.roastLevel"
            :rating="entry.rating"
            :brewed-at="entry.brewedAt"
            :is-favorite="entry.isFavorite"
            :dose="entry.dose"
            :grind-setting="entry.grindSetting"
            :water-temp="entry.waterTemp"
            :total-time="entry.totalTime"
            :total-water="entry.totalWater"
          />
        </li>
      </ul>

      <AppButton variant="outline" block
        v-if="hasMore"
        :busy="loadingMore"
        class="mt-4"
        @click="loadMore"
      >
        {{ loadingMore ? '載入中' : '載入更多' }}
      </AppButton>
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

<style scoped>
/* 骨架和紀錄卡片同一個內距與同一個切換點（BrewCard：上 16、左右 16、下 14；卡片內容寬 276px） */
.brew-card-skeleton {
  padding: var(--card-pad) var(--card-pad) 14px;
  container-type: inline-size;
}
/* 五欄的間距也和卡片同一套：三行 2px、兩行 6px */
.brew-skeleton__params {
  column-gap: 2px;
}
.brew-skeleton__thumb {
  width: 80px;
  height: 80px;
  border-radius: var(--radius-md);
  background: var(--border);
}
@container (min-width: 276px) {
  .brew-skeleton__thumb {
    width: 52px;
    height: 52px;
    border-radius: var(--radius-sm);
  }
  .brew-skeleton__date {
    display: none;
  }
  .brew-skeleton__params {
    column-gap: 6px;
  }
}
</style>
