<script setup lang="ts">
// 總覽（《02-功能規格》§4.1）。
//
// 目的是讓使用者持續記錄，用可視化製造成就感。目標環全寬永遠在最上面，下面是固定的兩排：
//   第一排  上一杯、本週最高分（某一杯或某支豆子，點進去是詳情）
//   第二排  累計、本月（數字）
// 同一排只剩一張時那一張改成全寬，兩張都不顯示時整排不出現（utils/dashboard.ts 的 dashboardRows）。
// 每張卡片的資料與顯示條件也在 utils/dashboard.ts。**所有統計都排除範例資料。**
//
// 每張卡片的第一個元素都是標題，靠左上，位置與樣式相同（《03》§4.16）。
// 字級：標題 --text-lg、主要數字 --text-xl（不大過頁面標題「總覽」）、單位與次要文字 --text-sm。
//
// 本週、本月都以沖煮日期計算，週一開始，瀏覽器的本地時間。
// 顏色一律用語意 token（品牌色會更換）。

definePageMeta({ screen: 'browse' })

const { thumbnailUrls } = useBeanPhotos()
const fetchActiveBeans = useActiveBeans()
const { fetchStats, fetchGoals } = useBrewStats()
const cache = useQueryCache()

const stats = ref<StatBrew[]>([])
const goals = ref<GoalRow[]>([])
const activeBeans = ref<ActiveBean[]>([])
const photos = ref<Map<string, string>>(new Map())
const loading = ref(true)
const loadError = ref('')
const editing = ref(false)

// 「本週」「本月」看的是打開這一頁的當下；重新進來時重算
const now = ref(new Date())

const week = computed(() => weekCard(stats.value, goals.value, now.value))
const last = computed(() => lastBeanCard(stats.value))
const top = computed(() => topRatedCard(stats.value, now.value))
const totals = computed(() => totalsCard(stats.value))
const month = computed(() => monthCard(stats.value, now.value))

const rows = computed(() => dashboardRows({ last: !!last.value, top: !!top.value, totals: !!totals.value, month: !!month.value }))
const spanOf = (card: DashboardCard) => rows.value.flat().find(item => item.card === card)?.span ?? 1

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']
const barMax = computed(() => Math.max(1, ...(week.value?.days ?? [])))
// 本週全部 0 杯時長條區只剩底線，不保留空白
const barMaxCups = computed(() => Math.max(0, ...(week.value?.days ?? [])))
const barStyle = (cups: number) => ({
  height: cups ? `${(cups / barMax.value) * 100}%` : '2px',
  background: cups ? 'var(--accent)' : 'var(--border)',
})

// 上一杯與最高分的縮圖：長邊 384px 的縮圖檔（《01》§7.1），沒有縮圖檔時退回原圖
const photoPaths = computed(() => [last.value?.bean.photo_path, top.value?.brew.beans?.photo_path].filter((p): p is string => !!p))
watch(() => photoPaths.value.join('|'), async () => {
  const paths = photoPaths.value
  if (!paths.length) return
  const urls = await thumbnailUrls(paths).catch(() => new Map<string, string>())
  photos.value = new Map([...photos.value, ...urls])
})
const photoOf = (path: string | null | undefined) => (path ? photos.value.get(path) ?? null : null)

async function load() {
  loadError.value = ''
  now.value = new Date()
  const fail = (e: unknown) => { loadError.value = `讀不到資料：${errorText(e)}` }
  const statQuery = cache.swr(cacheKeys.brewStats(), fetchStats, { apply: (rows) => { stats.value = rows }, onError: fail })
  const goalQuery = cache.swr(cacheKeys.goals(), fetchGoals, { apply: (rows) => { goals.value = rows }, onError: fail })
  // 只用來決定浮動新增按鈕要不要帶入豆子，不擋畫面
  cache.swr(cacheKeys.beanActive(), fetchActiveBeans, { apply: (rows) => { activeBeans.value = rows } })

  loading.value = !(statQuery.hit && goalQuery.hit)
  await Promise.all([statQuery.settled, goalQuery.settled])
  loading.value = false
}

onMounted(load)

async function onGoalSaved() {
  editing.value = false
  // 新增了一列目標：重查之後環立刻重算
  goals.value = await fetchGoals().catch(() => goals.value)
  cache.set(cacheKeys.goals(), goals.value)
}

// 只有一支未喝完的豆子時直接帶入，少一步選擇。紀錄分頁的按鈕是同一條規則（utils/navigation.ts）
const newBrewLink = computed(() => newBrewEntry(activeBeans.value))
</script>

<template>
  <!-- 底部留白避開浮動按鈕；分頁列的高度由 app.vue 讓出 -->
  <main class="mx-auto px-5 pt-10 pb-24" :style="{ maxWidth: 'var(--content-max)' }">
    <PageHeader title="總覽">
      <template #end>
        <!-- 設定只從這裡進（《03》§3）。icon 封閉清單的三個之一 -->
        <NuxtLink
          to="/settings"
          aria-label="設定"
          class="-mr-3 flex shrink-0 items-center justify-center"
          :style="{ minWidth: 'var(--touch-min)', minHeight: 'var(--touch-min)', color: 'var(--settings-icon)' }"
        >
          <svg
            width="22" height="22" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2.18" stroke-linecap="round" stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </NuxtLink>
      </template>
    </PageHeader>

    <p v-if="loadError" role="alert" class="mt-4 text-sm" :style="{ color: 'var(--danger)' }">
      {{ loadError }}
    </p>

    <!-- 骨架：目標環一張全寬、兩張半寬。§6 不做進場動畫，靜態色塊 -->
    <div v-if="loading" aria-busy="true" aria-label="讀取中" class="mt-6 grid grid-cols-2 gap-3">
      <SkeletonBlock class="col-span-2" height="13rem" radius="var(--radius-md)" />
      <SkeletonBlock height="13rem" radius="var(--radius-md)" />
      <SkeletonBlock height="13rem" radius="var(--radius-md)" />
    </div>

    <!-- 目標環全寬在最上面；下面固定兩排（dashboardRows）：同一排只剩一張時那一張全寬，兩張都不顯示時整排不出現。
         每張卡片的第一個元素是標題，靠左上（《03》§4.16） -->
    <div v-else class="mt-6 grid grid-cols-2 gap-3">
      <!-- 目標環：有目標就一定顯示，0 杯也顯示。點了修改目標 -->
      <button
        v-if="week"
        type="button"
        class="col-span-2 rounded-md border p-3 text-left"
        :style="{ borderColor: 'var(--border)', background: 'var(--surface)' }"
        @click="editing = true"
      >
        <h2 class="font-serif text-lg font-bold">本週目標</h2>

        <!-- 環在左；右邊上方是「N／M 杯」，下方是長條圖（《03》§4.16） -->
        <div class="mt-3 flex items-center gap-4">
          <GoalRing :count="week.count" :goal="week.goal" :size="80" />
          <div class="min-w-0 flex-1">
            <p class="tabular-nums">
              <span class="font-serif text-xl font-bold">{{ week.count }}／{{ week.goal }}</span>
              <span class="ml-1 text-sm text-muted">杯</span>
            </p>
            <div class="mt-2 flex items-end gap-1.5" aria-hidden="true">
              <div v-for="(cups, day) in week.days" :key="day" class="flex flex-1 flex-col items-center gap-1">
                <div class="flex w-full items-end" :class="barMaxCups ? 'h-7' : 'h-0.5'">
                  <div class="w-full rounded-sm" :style="barStyle(cups)" />
                </div>
                <span class="text-sm leading-none text-muted">{{ WEEKDAYS[day] }}</span>
              </div>
            </div>
          </div>
        </div>

      </button>

      <!-- 第一排：上一杯。點了進豆子詳情，卡片上不放任何按鈕 -->
      <NuxtLink
        v-if="last"
        :to="`/beans/${last.beanId}`"
        class="block rounded-md border p-3"
        :class="{ 'col-span-2': spanOf('last') === 2 }"
        :style="{ borderColor: 'var(--border)', background: 'var(--surface)' }"
      >
        <h2 class="font-serif text-lg font-bold">上一杯</h2>
        <div class="mt-3 flex items-start gap-2.5">
          <span class="block size-16 shrink-0 overflow-hidden rounded-md">
            <BeanThumb :photo-url="photoOf(last.bean.photo_path)" :roast-level="last.bean.roast_level" :alt="last.bean.name" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="line-clamp-3 text-sm font-medium break-keep wrap-anywhere">{{ last.bean.name }}</span>
            <span class="mt-1 block text-sm tabular-nums text-muted">第 {{ last.count }} 杯</span>
          </span>
        </div>
      </NuxtLink>

      <!-- 第一排：本週最高分（本週沒有就是上週最高分）。點了進紀錄詳情 -->
      <NuxtLink
        v-if="top"
        :to="`/brews/${top.brew.id}`"
        class="block rounded-md border p-3"
        :class="{ 'col-span-2': spanOf('top') === 2 }"
        :style="{ borderColor: 'var(--border)', background: 'var(--surface)' }"
      >
        <h2 class="font-serif text-lg font-bold">{{ top.week === 'this' ? '本週最高分' : '上週最高分' }}</h2>
        <div class="mt-3 flex items-start gap-2.5">
          <span class="block size-16 shrink-0 overflow-hidden rounded-md">
            <BeanThumb :photo-url="photoOf(top.brew.beans?.photo_path)" :roast-level="top.brew.beans?.roast_level ?? null" :alt="top.brew.beans?.name ?? ''" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="line-clamp-3 text-sm font-medium break-keep wrap-anywhere">{{ top.brew.beans?.name ?? '沒有指定豆子' }}</span>
            <span class="mt-1 flex" :aria-label="`評分 ${top.brew.rating} 顆星`">
              <svg
                v-for="level in 5" :key="level"
                width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"
                stroke-width="3" stroke-linecap="round" stroke-linejoin="round"
                :fill="top.brew.rating! >= level ? 'var(--favorite)' : 'transparent'"
                :stroke="top.brew.rating! >= level ? 'var(--favorite)' : 'var(--control-empty)'"
              >
                <path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" />
              </svg>
            </span>
            <span class="mt-1 block text-sm tabular-nums text-muted">{{ monthDay(top.brew.brewed_at) }}</span>
          </span>
        </div>
      </NuxtLink>

      <!-- 第二排：累計。點了進紀錄分頁 -->
      <NuxtLink
        v-if="totals"
        to="/brews"
        class="block rounded-md border p-3"
        :class="{ 'col-span-2': spanOf('totals') === 2 }"
        :style="{ borderColor: 'var(--border)', background: 'var(--surface)' }"
      >
        <h2 class="font-serif text-lg font-bold">累計</h2>
        <p class="mt-3 tabular-nums"><span class="font-serif text-xl font-bold">{{ totals.records }}</span><span class="ml-1 text-sm text-muted">筆紀錄</span></p>
        <p class="mt-1 tabular-nums"><span class="text-sm text-muted">喝過</span><span class="mx-1 font-serif text-xl font-bold">{{ totals.beans }}</span><span class="text-sm text-muted">支豆子</span></p>
      </NuxtLink>

      <!-- 第二排：本月。卡片不能點 -->
      <div
        v-if="month"
        class="rounded-md border p-3"
        :class="{ 'col-span-2': spanOf('month') === 2 }"
        :style="{ borderColor: 'var(--border)', background: 'var(--surface)' }"
      >
        <h2 class="font-serif text-lg font-bold">本月</h2>
        <p class="mt-3 tabular-nums"><span class="font-serif text-xl font-bold">{{ month.cups }}</span><span class="ml-1 text-sm text-muted">杯</span></p>
        <p class="mt-1 tabular-nums"><span class="font-serif text-xl font-bold">{{ month.dose }}</span><span class="ml-1 text-sm text-muted">g</span></p>
      </div>
    </div>

    <GoalDialog
      v-if="week"
      :open="editing"
      :current="week.goal"
      @close="editing = false"
      @saved="onGoalSaved"
    />

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
