<script setup lang="ts">
// 豆子詳情（《02-功能規格》§8）。
//
// 此頁的重點是該豆子所有沖煮紀錄的並排比較——這是本產品「幫助使用者進步」
// 的核心價值落點。

interface BeanDetail {
  id: string
  name: string
  photo_path: string | null
  roaster: string | null
  roast_date: string | null
  roast_level: RoastLevel | null
  official_notes: string | null
  is_finished: boolean
  countries: { name_zh: string } | null
  region: string | null
  processing_methods: { name: string } | null
  varieties: { name: string } | null
}

const route = useRoute()
const supabase = useSupabaseClient()
const { signedUrl, remove } = useBeanPhotos()

const bean = ref<BeanDetail | null>(null)
const photoUrl = ref<string | null>(null)
const brewCount = ref(0)
const favoriteCount = ref(0)
const compareRows = ref<CompareRow[]>([])
const loading = ref(true)
const loadError = ref('')
const notFound = ref(false)
const confirmOpen = ref(false)
const deleting = ref(false)
const actionError = ref('')

const id = computed(() => String(route.params.id))

const cache = useQueryCache()

// 從列表帶進來的資料只有一半（沒有產區、處理法、品種、官方風味描述）。
// 標題與照片可以先出來，其餘欄位等完整資料回來再補——
// 顯示「沒有填」再跳出值，比等一趟來回還糟。
const partial = ref(false)

async function fetchBean() {
  const { data, error } = await supabase
    .from('beans')
    .select(`
      id, name, photo_path, roaster, roast_date, roast_level, region, official_notes, is_finished,
      countries ( name_zh ),
      processing_methods ( name ), varieties ( name )
    `)
    .eq('id', id.value)
    .maybeSingle()
  if (error) throw toError(error)
  return data as unknown as BeanDetail | null
}

async function fetchBrews() {
  const { data, error } = await supabase
    .from('brews')
    .select('id, brewed_at, dose, water_temp, grind_setting, total_time, is_favorite')
    .eq('bean_id', id.value)
    .order('brewed_at', { ascending: true })
    .order('id', { ascending: true })
  if (error) throw toError(error)
  return (data ?? []) as unknown as Omit<CompareBrew, 'totalWater'>[]
}

/** 總水量要靠分段算出來。一次把所有分段取回，不每筆各查一次。 */
async function fetchWater(brewRows: { id: string }[]) {
  if (!brewRows.length) return new Map<string, number>()
  const { data } = await supabase
    .from('brew_steps')
    .select('brew_id, cumulative_water')
    .in('brew_id', brewRows.map(row => row.id))
  const water = new Map<string, number>()
  for (const step of (data ?? []) as unknown as { brew_id: string, cumulative_water: number }[]) {
    const value = Number(step.cumulative_water)
    const current = water.get(step.brew_id)
    if (current === undefined || value > current) water.set(step.brew_id, value)
  }
  return water
}

function applyBean(detail: BeanDetail | null) {
  if (!detail) {
    notFound.value = true
    return
  }
  bean.value = detail
  // countries 只有完整查詢才有，用它判斷這份是不是列表帶進來的半成品
  partial.value = !('countries' in detail)
  loadPhoto(detail.photo_path)
}

// 簽名網址有時效，不快取；但它只依賴 photo_path，與主查詢並行
async function loadPhoto(path: string | null) {
  photoUrl.value = await signedUrl(path).catch(() => null)
}

function applyBrews(rows: Omit<CompareBrew, 'totalWater'>[], water: Map<string, number>) {
  brewCount.value = rows.length
  favoriteCount.value = rows.filter(row => row.is_favorite).length
  compareRows.value = buildCompareRows(
    rows.map(row => ({ ...row, totalWater: water.get(row.id) ?? null })),
    bean.value?.roast_date ?? null,
  )
}

async function load() {
  loadError.value = ''

  // 豆子與紀錄都只靠網址上的 id，互不相依，一起發。
  const beanQuery = cache.swr(cacheKeys.bean(id.value), fetchBean, {
    apply: applyBean,
    onError: (e) => { loadError.value = `讀不到資料：${errorText(e)}` },
  })

  const brewsKey = cacheKeys.brewsByBean(id.value)
  const brewsQuery = cache.swr(
    brewsKey,
    async () => {
      const rows = await fetchBrews()
      return { rows, water: [...(await fetchWater(rows))] as [string, number][] }
    },
    {
      apply: ({ rows, water }) => applyBrews(rows, new Map(water)),
      onError: (e) => { loadError.value = `讀不到資料：${errorText(e)}` },
    },
  )

  // 兩邊都命中才算完全命中：只要有一邊要等，就先給骨架
  loading.value = !(beanQuery.hit && brewsQuery.hit)
  await Promise.all([beanQuery.settled, brewsQuery.settled])
  loading.value = false
}

onMounted(load)

const days = computed(() => restDays(bean.value?.roast_date))

const rows = computed(() => {
  const b = bean.value
  if (!b) return []
  return [
    { label: '咖啡店名', value: b.roaster },
    { label: '烘焙日期', value: b.roast_date },
    { label: '養豆天數', value: days.value === null ? null : `${days.value} 天` },
    { label: '烘焙度', value: b.roast_level ? roastLabels[b.roast_level] : null },
    { label: '產國', value: b.countries?.name_zh ?? null },
    { label: '產區', value: b.region },
    { label: '處理法', value: b.processing_methods?.name ?? null },
    { label: '品種', value: b.varieties?.name ?? null },
  ].filter(row => row.value)
})

async function toggleFinished(next: boolean) {
  if (!bean.value) return
  const { error } = await supabase.from('beans').update({ is_finished: next } as never).eq('id', id.value)
  if (error) {
    actionError.value = `更新失敗：${errorText(error)}`
    return
  }
  bean.value.is_finished = next
  // 影響列表的分組與首頁上區的收錄。不清的話回上一頁還看得到它在「沖煮中」
  cache.invalidateAfter({ kind: 'bean-finished' })
}

async function destroy() {
  if (!bean.value) return
  deleting.value = true
  const path = bean.value.photo_path
  const { error } = await supabase.from('beans').delete().eq('id', id.value)
  if (error) {
    deleting.value = false
    confirmOpen.value = false
    actionError.value = `刪除失敗：${errorText(error)}`
    return
  }
  // 外鍵 cascade，紀錄跟著沒了——時間軸與次數統計都要重來
  cache.invalidateAfter({ kind: 'bean' })
  if (path) await remove(path)
  await navigateTo('/beans')
}
</script>

<template>
  <main class="mx-auto px-5 py-10" :style="{ maxWidth: 'var(--content-max)' }">
    <p v-if="loadError" role="alert" class="text-sm" :style="{ color: 'var(--danger)' }">{{ loadError }}</p>
    <div v-if="loading" aria-busy="true" aria-label="讀取中">
      <SkeletonBlock width="3rem" height="0.875rem" />
      <SkeletonBlock height="10rem" radius="4px" class="mt-4" />
      <SkeletonBlock width="55%" height="1.75rem" class="mt-4" />
      <SkeletonBlock width="8rem" height="0.875rem" class="mt-2" />
      <div class="mt-8 space-y-3">
        <SkeletonBlock v-for="n in 5" :key="n" height="1.25rem" />
      </div>
    </div>

    <template v-else-if="notFound">
      <h1 class="font-serif text-xl font-bold">找不到這支豆子</h1>
      <NuxtLink to="/beans" class="mt-6 inline-block underline" :style="{ color: 'var(--accent)' }">
        回豆子列表
      </NuxtLink>
    </template>

    <template v-else-if="bean">
      <div class="flex items-baseline justify-between">
        <NuxtLink to="/beans" class="text-sm underline" :style="{ color: 'var(--accent)' }">豆子</NuxtLink>
        <NuxtLink :to="`/beans/${bean.id}/edit`" class="text-sm underline" :style="{ color: 'var(--accent)' }">
          編輯
        </NuxtLink>
      </div>

      <img
        v-if="photoUrl"
        :src="photoUrl"
        :alt="bean.name"
        class="mt-4 block max-h-80 w-full rounded-md object-cover"
      >
      <div
        v-else
        class="mt-4 flex h-32 items-center rounded-md px-4"
        :style="roastFill(bean.roast_level)"
      >
        <span class="font-serif text-lg font-bold">{{ bean.name }}</span>
      </div>

      <h1 class="mt-5 font-serif text-2xl font-bold">{{ bean.name }}</h1>

      <dl class="mt-6">
        <div
          v-for="row in rows"
          :key="row.label"
          class="flex justify-between border-t py-3"
          :style="{ borderColor: 'var(--border)' }"
        >
          <dt class="text-sm text-muted">{{ row.label }}</dt>
          <dd class="tabular-nums">{{ row.value }}</dd>
        </div>
        <!-- 從列表帶進來的資料沒有產區、處理法、品種這幾格。
             留一列骨架告訴使用者「還有東西在路上」，
             不然那幾格會無預警地冒出來，看起來像畫面在跳。 -->
        <div
          v-if="partial"
          class="flex justify-between border-t py-3"
          :style="{ borderColor: 'var(--border)' }"
        >
          <SkeletonBlock width="4rem" height="0.875rem" />
          <SkeletonBlock width="6rem" height="0.875rem" />
        </div>
        <div class="flex justify-between border-t py-3" :style="{ borderColor: 'var(--border)' }">
          <dt class="text-sm text-muted">沖煮次數</dt>
          <dd class="tabular-nums">{{ brewCount }}</dd>
        </div>
        <div
          v-if="favoriteCount > 0"
          class="flex justify-between border-t py-3"
          :style="{ borderColor: 'var(--border)' }"
        >
          <dt class="text-sm text-muted">收藏次數</dt>
          <dd class="tabular-nums">{{ favoriteCount }}</dd>
        </div>
      </dl>

      <section v-if="bean.official_notes" class="mt-6">
        <h2 class="text-sm text-muted">官方風味描述</h2>
        <p class="mt-1 whitespace-pre-line">{{ bean.official_notes }}</p>
      </section>

      <!-- 比較表。這張表必須在手機上好用——Excel 在電腦上做得比這好，
           但在手機上做得極差，而喝咖啡的當下人都在手機上。 -->
      <section class="mt-8">
        <h2 class="font-serif text-lg font-bold">每次怎麼沖的</h2>

        <p v-if="!compareRows.length" class="mt-2 text-muted">
          還沒有紀錄。沖一杯記下來，之後就能比較每次的調整。
        </p>

        <template v-else>
          <p v-if="compareRows.length === 1" class="mt-2 text-muted">
            再記一筆就能開始比較——改動的數值會標出來。
          </p>
          <div class="mt-3">
            <BeanCompareTable :rows="compareRows" />
          </div>
          <p v-if="compareRows.length > 1" class="mt-2 text-xs text-muted">
            由舊到新，與前一次不同的數值有標色。左右可以捲動。
          </p>
        </template>
      </section>

      <NuxtLink
        :to="`/brews/new?bean=${bean.id}`"
        class="mt-8 block w-full rounded-sm px-4 py-3 text-center font-medium"
        :style="{ background: 'var(--accent)', color: 'var(--on-accent)', minHeight: 'var(--touch-min)' }"
      >
        用這支豆子沖一杯
      </NuxtLink>

      <!-- 狀態不是動作，用 role="switch" 的開關而不是按鈕 -->
      <div class="mt-4">
        <ToggleSwitch
          :model-value="bean.is_finished"
          label="已喝完"
          @update:model-value="toggleFinished"
        />
      </div>

      <p v-if="actionError" class="mt-4 text-sm" :style="{ color: 'var(--danger)' }">{{ actionError }}</p>

      <button
        type="button"
        class="mt-4 w-full rounded-sm px-4 py-3"
        :style="{ color: 'var(--danger)', minHeight: 'var(--touch-min)' }"
        @click="confirmOpen = true"
      >
        刪除
      </button>

      <ConfirmDialog
        :open="confirmOpen"
        title="刪除這支豆子？"
        :body="brewCount > 0
          ? `連同這支豆子的 ${brewCount} 筆沖煮紀錄一起刪掉，沒辦法復原。`
          : '刪掉之後沒辦法復原。'"
        confirm-label="刪除這支豆子"
        :busy="deleting"
        @cancel="confirmOpen = false"
        @confirm="destroy"
      />
    </template>
  </main>
</template>
