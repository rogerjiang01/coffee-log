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
//   上週最高分        標題「上週最高分」，最下面一行寫「上週六，本週未評分」（不換行，放不下時截斷）
//   達到或超過目標    環停在一圈，數字下方寫「達成目標」（N ≥ M）
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
const weekdayShort = (iso: string) => WEEKDAYS[weekdayIndex(new Date(iso))]
const weekdayOf = (iso: string) => `星期${weekdayShort(iso)}`

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
  <!-- 底部留白（分頁列與浮動按鈕）由 app.vue 讓出，這裡不留 -->
  <main class="mx-auto px-5 pt-10" :style="{ maxWidth: 'var(--content-max)' }">
    <PageHeader title="總覽">
      <template #end>
        <!-- 設定只從這裡進（《03》§3）。人頭佔位（2026-11-27，取代齒輪；Figma 3320:2675）：
             實心圓底加白色人形，44px，圓本身就是按鈕，不再外包 --surface 的圓；陰影和其他頁首圓鈕一樣是 --shadow-light（和卡片同一個，2026-11-27 第二版）。
             圓的外緣對齊右側 20 的內距。頭像上傳是之後的工作，這輪只有佔位 -->
        <NuxtLink
          to="/settings"
          aria-label="帳號與設定"
          class="account-avatar flex shrink-0 items-center justify-center rounded-full"
        >
          <!-- Figma 的人形向量（24 格線，圓佔滿整格），放大到 44px；圓由連結的底色畫 -->
          <svg width="44" height="44" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill-rule="evenodd" clip-rule="evenodd" fill="currentColor"
              d="M4.86791 19.4486C6.48542 17.2081 9.11931 15.75 12.0938 15.75C15.0209 15.75 17.6181 17.1621 19.2416 19.3421C17.3795 21.1789 14.8222 22.3125 12 22.3125C9.23278 22.3125 6.72011 21.2226 4.86791 19.4486ZM16.125 9.65625C16.125 11.9862 14.3202 13.875 12.0938 13.875C9.86736 13.875 8.0625 11.9862 8.0625 9.65625C8.0625 7.3263 9.86736 5.4375 12.0938 5.4375C14.3202 5.4375 16.125 7.3263 16.125 9.65625Z"
            />
          </svg>
        </NuxtLink>
      </template>
    </PageHeader>

    <p v-if="loadError" role="alert" class="mt-4 text-sm" :style="{ color: 'var(--danger)' }">
      {{ loadError }}
    </p>

    <!-- 骨架：目標環一張全寬、兩張半寬，和卡片同高。§6 不做進場動畫，靜態色塊 -->
    <div v-if="loading" aria-busy="true" aria-label="讀取中" class="mt-6 grid grid-cols-2 gap-3">
      <SkeletonBlock class="card-ml-corners col-span-2" height="var(--overview-card-h)" radius="var(--radius-card-ml)" />
      <SkeletonBlock height="var(--overview-card-h)" radius="var(--radius-card-ml)" class="card-ml-corners" />
      <SkeletonBlock height="var(--overview-card-h)" radius="var(--radius-card-ml)" class="card-ml-corners" />
    </div>

    <div v-else class="mt-6 grid grid-cols-2 gap-3">
      <!-- 目標環：有目標就一定顯示，0 杯也顯示。點了修改目標 -->
      <GoalWeekCard
        v-if="week"
        class="col-span-2"
        :count="week.count"
        :goal="week.goal"
        :days="week.days"
        clickable
        @click="editing = true"
      />

      <!-- 完全沒有紀錄：一張全寬的卡片，插畫、一句說明、新增紀錄 -->
      <AppCard v-if="noRecords" radius="ml" class="col-span-2 flex items-center gap-4 p-4">
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
        :photo-url="photoOf(top.brew.beans?.photo_path)"
        :roast-level="top.brew.beans?.roast_level ?? null"
        :rating="top.brew.rating"
        :name-lines="top.week === 'last' ? 1 : 2"
        :footer="top.week === 'last' ? `上週${weekdayShort(top.brew.brewed_at)}，本週未評分` : weekdayOf(top.brew.brewed_at)"
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
        radius="ml"
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
      <AppCard v-if="month" title="本月" radius="ml" class="flex flex-col overflow-hidden" :style="CARD_HEIGHT">
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
      class="fab-position flex size-14 items-center justify-center rounded-full"
      :style="{ background: 'var(--accent)', color: 'var(--on-accent)', boxShadow: 'var(--float-shadow)' }"
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
/* 人頭佔位：Figma 是由上而下的漸層（沒有綁變數，兩端的值剛好是 stone-400 → stone-500，tokens.css 的 --avatar-placeholder-*） */
.account-avatar {
  width: var(--touch-min);
  height: var(--touch-min);
  background: linear-gradient(to bottom, var(--avatar-placeholder-from), var(--avatar-placeholder-to));
  box-shadow: var(--shadow-light);
  color: var(--on-avatar-placeholder);
}
</style>
