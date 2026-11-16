<script setup lang="ts">
// 總覽（《02-功能規格》§4.1）。
//
// 目的是讓使用者持續記錄，用可視化製造成就感。目標環全寬永遠在最上面，下面是固定的兩排：
//   第一排  最近沖煮、本週最高分（某一杯或某支豆子，點進去是詳情）
//   第二排  累計、本月（數字）
// 每張卡片的資料與顯示條件在 utils/dashboard.ts。**所有統計都排除範例資料。**
//
// 卡片照 Figma 的 Card（AppCard）：標題列在上（16px、字重 500，可點的卡片右端有 ›），內容在下。
// 最近沖煮、最高分、累計、本月固定同一個高度（--overview-card-h），全寬時也一樣。
// 數字是 --accent-text 的指標數字（text-display-s）加單位（text-metric-unit）。
//
// 空狀態（2026-11-16 使用者選定，《02》§4.1）：
//   完全沒有紀錄      目標卡片照常；下面一張全寬的說明卡片加「新增紀錄」
//   一排只剩一張卡    剩下那張全寬，內容橫向展開（高度不變）
//   上週最高分        標題「上週最高分」，卡片多一行「本週還沒有評分」
//   超過目標          環停在一圈，數字下方寫「超過 N 杯」
//
// 本週、本月都以沖煮日期計算，週一開始，瀏覽器的本地時間。
// 顏色一律用語意 token（品牌色會更換）。

import { NuxtLink } from '#components'

definePageMeta({ screen: 'browse' })

const { thumbnailUrls } = useBeanPhotos()
const fetchActiveBeans = useActiveBeans()
const { fetchStats, fetchGoals } = useBrewStats()
const cache = useQueryCache()
const { ready: splashReady } = useSplash()

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

const noRecords = computed(() => !totals.value)
// 同一排只剩一張：那一張全寬（兩張都沒有時整排不出現）。不往前遞補：
// 遞補會把不同性質的卡片排在一起，也會讓卡片落單
const firstRowWide = computed(() => !!last.value !== !!top.value)
const secondRowWide = computed(() => !!totals.value !== !!month.value)
const CARD_HEIGHT = { height: 'var(--overview-card-h)' }

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']
const weekdayOf = (iso: string) => `星期${WEEKDAYS[weekdayIndex(new Date(iso))]}`

// 最近沖煮與最高分的縮圖：長邊 384px 的縮圖檔（《01》§7.1），沒有縮圖檔時退回原圖
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
  // 開場的首圖在等這個：資料到了就可以淡出（composables/useSplash.ts）
  splashReady.value = true
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

    <!-- 骨架：目標環一張全寬、兩張半寬，和卡片同高。§6 不做進場動畫，靜態色塊 -->
    <div v-if="loading" aria-busy="true" aria-label="讀取中" class="mt-6 grid grid-cols-2 gap-3">
      <SkeletonBlock class="col-span-2" height="var(--overview-card-h)" radius="var(--radius-md)" />
      <SkeletonBlock height="var(--overview-card-h)" radius="var(--radius-md)" />
      <SkeletonBlock height="var(--overview-card-h)" radius="var(--radius-md)" />
    </div>

    <div v-else class="mt-6 grid grid-cols-2 gap-3">
      <!-- 目標環：有目標就一定顯示，0 杯也顯示。點了修改目標 -->
      <GoalWeekCard
        v-if="week"
        class="col-span-2"
        :count="week.count"
        :goal="week.goal"
        :days="week.days"
        over-text
        clickable
        @click="editing = true"
      />

      <!-- 完全沒有紀錄：一張全寬的卡片，插畫、一句說明、新增紀錄 -->
      <AppCard v-if="noRecords" class="col-span-2 flex items-center gap-4 p-4">
        <span class="block size-20 shrink-0 overflow-hidden rounded-sm">
          <BeanArt background="var(--roast-unknown)" />
        </span>
        <span class="flex min-w-0 flex-1 flex-col items-start gap-2">
          <span class="text-body-m font-medium">還沒有紀錄</span>
          <span class="text-sm text-muted">記下第一杯之後，最近沖煮、最高分與累計會顯示在這裡。</span>
          <AppButton :to="newBrewLink">新增紀錄</AppButton>
        </span>
      </AppCard>

      <!-- 第一排：最近沖煮。點了進豆子詳情，卡片上不放任何按鈕 -->
      <OverviewBeanCard
        v-if="last"
        title="最近沖煮"
        :to="`/beans/${last.beanId}`"
        :name="last.bean.name"
        :is-sample="last.bean.is_sample"
        :photo-url="photoOf(last.bean.photo_path)"
        :roast-level="last.bean.roast_level"
        :footer="`第 ${last.count} 杯`"
        :wide="firstRowWide"
        :class="{ 'col-span-2': firstRowWide }"
      />

      <!-- 第一排：本週最高分（本週沒有就是上週最高分）。點了進紀錄詳情 -->
      <OverviewBeanCard
        v-if="top"
        :title="top.week === 'this' ? '本週最高分' : '上週最高分'"
        :to="`/brews/${top.brew.id}`"
        :name="top.brew.beans?.name ?? '沒有指定豆子'"
        :is-sample="top.brew.beans?.is_sample"
        :photo-url="photoOf(top.brew.beans?.photo_path)"
        :roast-level="top.brew.beans?.roast_level ?? null"
        :rating="top.brew.rating"
        :note="top.week === 'last' ? '本週還沒有評分' : ''"
        :footer="weekdayOf(top.brew.brewed_at)"
        :wide="firstRowWide"
        :class="{ 'col-span-2': firstRowWide }"
      />

      <!-- 第二排：累計。點了進紀錄分頁。全寬時兩組數字並排，高度不變 -->
      <AppCard
        v-if="totals"
        :as="NuxtLink"
        to="/brews"
        title="累計"
        arrow
        class="flex flex-col overflow-hidden"
        :class="{ 'col-span-2': secondRowWide }"
        :style="CARD_HEIGHT"
      >
        <span class="px-3 pt-0.5 pb-2" :class="secondRowWide ? 'grid grid-cols-2 gap-3' : 'flex flex-col gap-1'">
          <span class="flex flex-col">
            <span class="text-sm">總共記錄</span>
            <MetricValue :value="totals.records" unit="筆" />
          </span>
          <span class="flex flex-col">
            <span class="text-sm">喝過豆子</span>
            <MetricValue :value="totals.beans" unit="支" />
          </span>
        </span>
      </AppCard>

      <!-- 第二排：本月。卡片不能點，所以沒有 › -->
      <AppCard v-if="month" title="本月" class="flex flex-col overflow-hidden" :style="CARD_HEIGHT">
        <span class="flex flex-col gap-1 px-3 pt-0.5 pb-2">
          <span class="flex flex-col">
            <span class="text-sm">記錄</span>
            <MetricValue :value="month.cups" unit="筆" />
          </span>
          <span class="flex flex-col">
            <span class="text-sm">煮了豆子</span>
            <MetricValue :value="month.dose" unit="克" />
          </span>
        </span>
      </AppCard>
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
