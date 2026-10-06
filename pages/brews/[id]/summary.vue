<script setup lang="ts">
// 結算頁（《02》§5.2）。新增紀錄儲存成功後出現，只出現這一次。
//
// 由上到下：摘要（縮圖、豆名・M/D ›）→ 目標環 → 比較區 → 回饋句。
// 右上角的勾勾是「完成」：用取代的方式去總覽。返回鍵與返回手勢效果相同（onBeforeRouteLeave）。
// 直接打開網址、重新整理、之後再進來：導向這筆紀錄的詳情（summaryAccess）。
//
// 流程型畫面：沒有分頁列。顏色一律用語意 token；動畫只用 CSS。

definePageMeta({ screen: 'flow' })

const route = useRoute()
const id = String(route.params.id)
const ticket = useSummaryTicket()

const access = summaryAccess(ticket.value, id)
// 勾勾與摘要是頁面自己發的導覽；其他的離開（返回鍵、返回手勢）效果和按勾勾一樣（onBeforeRouteLeave）。
// 導向詳情也是頁面自己發的，不能被攔成去總覽
let leavingByPage = access === 'detail'
if (access === 'detail') {
  await navigateTo(`/brews/${id}`, { replace: true })
}
else {
  // 用掉：之後再進來（例如瀏覽器的下一頁）就導向詳情
  ticket.value = null
}

const supabase = useSupabaseClient()
const cache = useQueryCache()
const compare = useBrewComparison()
const { fetchStats, fetchGoals } = useBrewStats()
const { thumbnailUrls } = useBeanPhotos()

interface SummaryBrew {
  id: string
  bean_id: string | null
  brewed_at: string
  rating: number | null
  copied_from_brew_id: string | null
  beans: { name: string, photo_path: string | null, roast_level: RoastLevel | null } | null
}

const brew = ref<SummaryBrew | null>(null)
const photo = ref<string | null>(null)
const comparison = ref<Comparison | null>(null)
const stats = ref<StatBrew[]>([])
const goals = ref<GoalRow[]>([])
const ready = ref(false)
const filled = ref(false)

// 打開這一頁的當下：「本週」以它為準
const now = new Date()

const ring = computed(() => summaryRing(stats.value, goals.value, id, now))
const records = computed(() => recordCount(stats.value))
const compareRows = computed(() => {
  const c = comparison.value
  if (!c) return []
  return c.rating ? [...c.diffs, c.rating] : c.diffs
})
const feedback = ref<string | null>(null)

onMounted(async () => {
  if (access === 'detail') return
  const [brewResult, stepResult] = await Promise.all([
    supabase.from('brews').select(`${COMPARE_SELECT}, beans ( name, photo_path, roast_level )`).eq('id', id).maybeSingle(),
    supabase.from('brew_steps').select('step_index, hold_seconds, cumulative_water, step_type, note').eq('brew_id', id).order('step_index'),
  ])
  const row = brewResult.data as unknown as (SummaryBrew & Record<string, unknown>) | null
  if (!row) {
    leavingByPage = true
    await navigateTo(`/brews/${id}`, { replace: true })
    return
  }
  brew.value = row

  const [compared] = await Promise.all([
    compare(row, (stepResult.data ?? []) as unknown as StepRow[]).catch(() => null),
    cache.swr(cacheKeys.brewStats(), fetchStats, { apply: (rows) => { stats.value = rows } }).settled,
    cache.swr(cacheKeys.goals(), fetchGoals, { apply: (rows) => { goals.value = rows } }).settled,
  ])
  comparison.value = compared
  if (compared) {
    feedback.value = feedbackLine(compared.diffs, compared.target?.rating, row.rating, !!compared.target)
  }
  ready.value = true

  const path = row.beans?.photo_path
  if (path) photo.value = (await thumbnailUrls([path]).catch(() => new Map<string, string>())).get(path) ?? null
})

// ── 離開 ──────────────────────────────────────────────
onBeforeRouteLeave(() => {
  const result = summaryLeave(leavingByPage)
  leavingByPage = true
  return result
})

async function done() {
  leavingByPage = true
  await navigateTo('/', { replace: true })
}

async function openDetail() {
  leavingByPage = true
  await navigateTo(`/brews/${id}`, { replace: true })
}
</script>

<template>
  <main class="mx-auto px-5 pt-10 pb-16" :style="{ maxWidth: 'var(--content-max)' }">
    <!-- 右上角：完成。《03》§3 圖示表的「完成」 -->
    <header class="flex justify-end" :style="{ minHeight: 'var(--touch-min)' }">
      <button
        type="button"
        aria-label="完成"
        class="-mr-1 flex shrink-0 items-center justify-center rounded-full"
        :style="{ width: 'var(--touch-min)', height: 'var(--touch-min)', background: 'var(--accent)', color: 'var(--on-accent)' }"
        @click="done"
      >
        <svg
          width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"
          fill="none" stroke="currentColor" stroke-width="2.18" stroke-linecap="round" stroke-linejoin="round"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </button>
    </header>

    <div v-if="!ready" aria-busy="true" aria-label="讀取中" class="mt-4 space-y-6">
      <SkeletonBlock height="3.5rem" />
      <SkeletonBlock height="7rem" />
      <SkeletonBlock height="8rem" />
    </div>

    <template v-else-if="brew">
      <!-- 1. 摘要：點了用取代的方式進紀錄詳情，返回時不會回到結算頁 -->
      <a
        :href="`/brews/${id}`"
        class="mt-4 flex items-center gap-3"
        @click.prevent="openDetail"
      >
        <span class="block w-14 shrink-0 overflow-hidden rounded-md">
          <BeanThumb :photo-url="photo" :roast-level="brew.beans?.roast_level ?? null" :alt="brew.beans?.name ?? ''" />
        </span>
        <span class="min-w-0 flex-1 font-medium">{{ brew.beans?.name ?? '沒有指定豆子' }}・{{ monthDay(brew.brewed_at) }}</span>
        <svg
          width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" class="shrink-0" :style="{ color: 'var(--text-muted)' }"
          fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
      </a>

      <!-- 2. 目標環。這一筆不在本週時只留「第 N 筆紀錄」 -->
      <section class="mt-8">
        <div v-if="ring" class="flex items-center gap-5">
          <GoalRing :count="ring.after" :from="ring.before" :goal="ring.goal" :celebrate="ring.crossed" @filled="filled = true" />
          <div v-if="ring.crossed && filled">
            <p class="font-serif text-2xl font-bold">本週目標達成</p>
            <p class="mt-1 text-sm tabular-nums text-muted">{{ ring.goal }} 杯</p>
          </div>
          <p v-else class="font-serif text-2xl font-bold tabular-nums">
            本週 {{ filled ? ring.after : ring.before }}／{{ ring.goal }}
          </p>
        </div>
        <p class="tabular-nums" :class="ring ? 'mt-4' : ''">第 {{ records }} 筆紀錄</p>
      </section>

      <!-- 3. 比較區 -->
      <section class="mt-8">
        <template v-if="comparison?.target">
          <h2 class="font-serif text-lg font-bold">和 {{ monthDay(comparison.target.brewed_at) }} 那一杯相比</h2>
          <p v-if="!comparison.diffs.length" class="mt-3">參數和 {{ monthDay(comparison.target.brewed_at) }} 那一杯相同</p>
          <dl v-if="compareRows.length" class="mt-3">
            <div
              v-for="diff in compareRows"
              :key="diff.field"
              class="flex items-baseline justify-between gap-3 border-t py-3"
              :style="{ borderColor: 'var(--border)' }"
            >
              <dt class="shrink-0 text-sm text-muted">{{ diff.label }}</dt>
              <dd class="min-w-0 text-right tabular-nums">
                <span class="text-sm" :style="{ color: 'var(--text-muted)' }">{{ diff.before }}</span>
                <span class="mx-2 text-sm" :style="{ color: 'var(--text-muted)' }">→</span>
                <span class="font-medium" :style="{ color: 'var(--diff)' }">{{ diff.after }}</span>
              </dd>
            </div>
          </dl>
        </template>
        <p v-else-if="comparison">恭喜開箱新豆子。</p>
      </section>

      <!-- 4. 回饋句：有比較對象、兩筆都有評分才出現 -->
      <p v-if="feedback" class="mt-8 font-serif text-lg">{{ feedback }}</p>
    </template>
  </main>
</template>
