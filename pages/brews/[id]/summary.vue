<script setup lang="ts">
// 結算頁（《02》§5「結算頁」、《03》§4.17；2026-11-26 照 Figma 結算頁 v2 改版）。新增紀錄儲存成功後出現，只出現這一次。
//
// 由上到下：
//   主圖（BrewHero）  豆袋照片滿版，沒有照片時交給 BrewHeroFallback。右上角是分享＋完成。
//                     標題區壓在主圖底部：咖啡店名、豆名、本週目標（小環＋一行字）、日期與收藏
//   小數據列           評分、養豆、紀錄（第 N 筆）、豆子（第 N 支，只在這支豆子的第一杯）
//   有比較對象         和 M/D 那一杯相比（BrewCompareSection 的 summary）→ 沖煮參數
//   這支豆子的第一杯   沖煮參數（下方「下一杯會和這一杯比較。」）→ 這支豆子
// 沖煮參數的卡片整張可點，用取代的方式進紀錄詳情（返回時不會回到結算頁）。
//
// 右上角的勾勾是「完成」：用取代的方式去總覽。返回鍵與返回手勢效果相同（onBeforeRouteLeave）。
// 直接打開網址、重新整理、之後再進來：導向這筆紀錄的詳情（summaryAccess）。
//
// 流程型畫面：沒有分頁列。顏色一律用語意 token；動畫只用 CSS。

definePageMeta({ screen: 'flow' })

const route = useRoute()
const id = String(route.params.id)
const ticket = useSummaryTicket()

const access = summaryAccess(ticket.value, id)
// 勾勾與參數卡片是頁面自己發的導覽；其他的離開（返回鍵、返回手勢）效果和按勾勾一樣（onBeforeRouteLeave）。
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
const { signedUrl } = useBeanPhotos()

interface SummaryBrew {
  id: string
  bean_id: string | null
  brewed_at: string
  rating: number | null
  is_favorite: boolean
  tasting_notes: string | null
  copied_from_brew_id: string | null
  dose: number | null
  water_temp: number | null
  grind_setting: number | null
  total_time: number | null
  beans: (FirstCupBean & { photo_path: string | null, roaster: string | null }) | null
}

const brew = ref<SummaryBrew | null>(null)
const photo = ref<string | null>(null)
const comparison = ref<Comparison | null>(null)
const stats = ref<StatBrew[]>([])
const goals = ref<GoalRow[]>([])
const ready = ref(false)
const ownSteps = ref<StepRow[]>([])
const feedback = ref<string | null>(null)

// 打開這一頁的當下：「本週」以它為準
const now = new Date()

const beanName = computed(() => brew.value?.beans?.name ?? '沒有指定豆子')
const roaster = computed(() => brew.value?.beans?.roaster?.trim() || null)

// ── 本週目標：小環＋一行字。這一筆不在本週時整行不出現（summaryRing 回 null）─────────
const ring = computed(() => summaryRing(stats.value, goals.value, id, now))
// 環最多畫到一圈（和總覽的目標卡片相同）
const ringCount = computed(() => (ring.value ? Math.min(ring.value.after, ring.value.goal) : 0))
const ringFrom = computed(() => (ring.value ? Math.min(ring.value.before, ring.value.goal) : null))
// 有動畫時，字等環畫完才換成存檔後的杯數；起點和終點相同（已經超過目標）就沒有動畫。
// 減少動態時 GoalRing 一掛載就送出 filled，直接是最後的狀態
const ringFilled = ref(false)
const goalText = computed(() => {
  const r = ring.value
  if (!r) return ''
  const shown = ringFilled.value || ringFrom.value === ringCount.value ? r.after : r.before
  return shown >= r.goal ? `本週 ${shown}／${r.goal} 杯，達成目標` : `本週 ${shown}／${r.goal} 杯`
})

// ── 小數據列 ─────────────────────────────────────────
const firstCup = computed(() => !!comparison.value && !comparison.value.target)
const beanInfo = computed(() => (brew.value ? firstCupBean(brew.value.beans, brew.value.brewed_at, stats.value) : null))
const stat = computed(() => {
  const items: { label: string, value: string, star?: boolean }[] = []
  const b = brew.value
  if (!b) return items
  if (b.rating !== null) items.push({ label: '評分', value: String(b.rating), star: true })
  const rest = restDayValue(beanInfo.value?.restDay)
  if (rest) items.push({ label: '養豆', value: rest })
  const records = recordCount(stats.value)
  if (records > 0) items.push({ label: '紀錄', value: isFirstRecord(stats.value, id) ? '第一筆' : `第 ${records} 筆` })
  const ordinal = beanInfo.value?.beanOrdinal ?? 0
  if (firstCup.value && ordinal > 0) items.push({ label: '豆子', value: `第 ${ordinal} 支` })
  return items
})

const params = computed(() => (brew.value ? summaryParams(brew.value, ownSteps.value) : []))

onMounted(async () => {
  if (access === 'detail') return
  const [brewResult, stepResult] = await Promise.all([
    supabase.from('brews')
      .select(`${COMPARE_SELECT}, is_favorite, tasting_notes, beans ( name, roaster, photo_path, roast_level, roast_date, region, countries ( name_zh ), processing_methods ( name ) )`)
      .eq('id', id).maybeSingle(),
    supabase.from('brew_steps').select('step_index, hold_seconds, cumulative_water, step_type, note').eq('brew_id', id).order('step_index'),
  ])
  const row = brewResult.data as unknown as (SummaryBrew & Record<string, unknown>) | null
  if (!row) {
    leavingByPage = true
    await navigateTo(`/brews/${id}`, { replace: true })
    return
  }
  brew.value = row
  ownSteps.value = (stepResult.data ?? []) as unknown as StepRow[]

  // 主圖用原圖（長邊 1600），不用 384 的縮圖。和其他查詢一起發，不等它
  const path = row.beans?.photo_path
  if (path) void signedUrl(path).then((url) => { photo.value = url }).catch(() => {})

  const [compared] = await Promise.all([
    compare(row, ownSteps.value).catch(() => null),
    cache.swr(cacheKeys.brewStats(), fetchStats, { apply: (rows) => { stats.value = rows } }).settled,
    cache.swr(cacheKeys.goals(), fetchGoals, { apply: (rows) => { goals.value = rows } }).settled,
  ])
  comparison.value = compared
  // 回饋句：有比較對象、兩筆都有評分才有（utils/feedback.ts）。第一杯沒有回饋句（2026-11-26）
  if (compared?.target) feedback.value = feedbackLine(compared.diffs, compared.target.rating, row.rating, true)
  ready.value = true
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
  <!-- 沒有左右內距：主圖要滿版（手機上貼齊螢幕，寬螢幕時就是這一欄的寬度）。下面的內容自己留 px-5 -->
  <main class="mx-auto pb-16" :style="{ maxWidth: 'var(--content-max)' }">
    <template v-if="ready && brew">
      <BrewHero
        :has-photo="!!brew.beans?.photo_path"
        :photo-url="photo"
        :roast-level="brew.beans?.roast_level ?? null"
      >
        <!-- 右上角：分享（和紀錄詳情同一套流程）＋完成。鍵盤順序：分享 → 完成 → 參數卡片 -->
        <template #actions>
          <BrewShare
            floating
            :brew-id="brew.id"
            :bean-name="beanName"
            :brewed-at="brew.brewed_at"
            :has-notes="!!brew.tasting_notes?.trim()"
            :photo-path="brew.beans?.photo_path ?? null"
          />
          <DoneButton @click="done" />
        </template>

        <p v-if="roaster" class="text-heading-s font-medium">{{ roaster }}</p>
        <!-- 換行不截斷 -->
        <h1 class="text-display-l font-medium break-words">{{ beanName }}</h1>
        <p v-if="ring" class="flex items-center gap-2 text-heading-m font-medium tabular-nums" :style="{ color: 'var(--accent)' }">
          <GoalRing
            :count="ringCount"
            :from="ringFrom"
            :goal="ring.goal"
            :size="26"
            :stroke="6"
            :celebrate="ring.crossed"
            @filled="ringFilled = true"
          />
          <span>{{ goalText }}</span>
        </p>
        <!-- 日期與收藏是兩個獨立元素，用間距分開（不是 §1 禁止的中間點串接） -->
        <div class="flex flex-wrap items-center gap-x-3">
          <!-- 日期與時刻各自不斷行，兩者之間可以換行（320px） -->
          <p class="text-body-l tabular-nums text-muted"><span class="whitespace-nowrap">{{ brewedDate(brew.brewed_at) }}</span> <span class="whitespace-nowrap">{{ brewedTime(brew.brewed_at) }}</span></p>
          <!-- 和紀錄詳情頁一樣的「♥ 收藏」 -->
          <span v-if="brew.is_favorite" class="flex items-center gap-1 text-sm" :style="{ color: 'var(--favorite)' }">
            <svg
              width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"
              fill="var(--favorite)" stroke="var(--favorite)"
              stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
            >
              <path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5" />
            </svg>
            收藏
          </span>
        </div>
      </BrewHero>

      <!-- 左右是頁面的內距（--form-gutter），和主圖的標題區、下面的段落用同一組 token -->
      <div class="pt-5" :style="{ paddingInline: 'var(--form-gutter)' }">
        <!-- 小數據列：左邊和段落標題、主圖的標題區同一條線（--card-pad），項目間距 28，放不下就換行。
             值在上、標籤在下（dt 在 DOM 裡先，畫面上在下） -->
        <dl v-if="stat.length" class="flex flex-wrap gap-x-7 gap-y-3" :style="{ paddingLeft: 'var(--card-pad)' }">
          <div v-for="item in stat" :key="item.label" class="flex flex-col-reverse gap-0.5">
            <dt class="text-body-m text-muted">{{ item.label }}</dt>
            <dd class="flex items-center gap-1 text-heading-l font-medium tabular-nums">
              <svg
                v-if="item.star"
                width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"
                stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                fill="var(--favorite)" stroke="var(--favorite)"
              >
                <path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" />
              </svg>
              {{ item.value }}
            </dd>
          </div>
        </dl>

        <div class="mt-8 flex flex-col" :style="{ gap: 'var(--gap-section)' }">
          <!-- 有比較對象：和 M/D 那一杯相比。參數相同時是一句話（評分不同才接評分那一列），回饋句在標題下 -->
          <BrewCompareSection v-if="comparison?.target" :comparison="comparison" summary :feedback="feedback" />

          <!-- 沖煮參數：兩欄三列，整張可點進紀錄詳情（取代式，返回時不會回到結算頁）。可點的卡片不加 ›（《03》§1） -->
          <FormSection title="沖煮參數">
            <div>
              <AppCard
                as="a"
                :href="`/brews/${id}`"
                class="block px-6 py-5"
                @click.prevent="openDetail"
              >
                <!-- 連結的名稱：「前往紀錄」加上卡片裡的參數 -->
                <span class="sr-only">前往紀錄：</span>
                <dl class="grid grid-cols-2 gap-x-4 gap-y-4.5">
                  <div v-for="item in params" :key="item.label" class="flex min-w-0 flex-col gap-0.5">
                    <dt class="text-body-l text-muted">{{ item.label }}</dt>
                    <dd class="text-display-s font-medium tabular-nums">{{ item.value }}</dd>
                  </div>
                </dl>
              </AppCard>
              <!-- 第一杯：說明畫面上看不到的機制（下一杯會拿這一杯來比），《03》§5.6。位置同表單卡片下方的小字 -->
              <div v-if="firstCup" class="form-card-footer">
                <FormNote>下一杯會和這一杯比較。</FormNote>
              </div>
            </div>
          </FormSection>

          <!-- 這支豆子的第一杯：產國、產區、處理法、烘焙度，有填才有。養豆與第 N 支豆子已經在小數據列 -->
          <FormSection v-if="firstCup && beanInfo?.rows.length" title="這支豆子">
            <FormCard>
              <dl>
                <ReadonlyRow v-for="row in beanInfo.rows" :key="row.label" :label="row.label">{{ row.value }}</ReadonlyRow>
              </dl>
            </FormCard>
          </FormSection>
        </div>
      </div>
    </template>

    <!-- 讀取中：主圖的位置先留好（同一個高度），完成鈕在同一個位置，隨時可以離開 -->
    <div v-else aria-busy="true" aria-label="讀取中">
      <div class="summary-hero-placeholder relative flex flex-col justify-end gap-2">
        <div class="absolute top-10 right-5">
          <DoneButton @click="done" />
        </div>
        <SkeletonBlock width="40%" height="1.25rem" />
        <SkeletonBlock width="80%" height="2.25rem" />
        <SkeletonBlock width="60%" height="1.25rem" />
      </div>
      <div class="mt-8 space-y-6" :style="{ paddingInline: 'var(--form-gutter)' }">
        <SkeletonBlock height="3.5rem" />
        <SkeletonBlock height="10rem" />
      </div>
    </div>
  </main>
</template>

<style scoped>
/* 和 BrewHero 同一個高度 */
.summary-hero-placeholder {
  min-height: min(470px, 58svh);
  padding-inline: calc(var(--form-gutter) + var(--card-pad));
}
</style>
