<script setup lang="ts">
// 總覽（《02-功能規格》§4）。
//
// 首頁改版的第一階段只改導覽結構：這一頁目前只有「沖煮中的豆子」。
// 看板內容（目標環、總記錄數）在後續階段加入；時間軸已經搬到紀錄分頁（pages/brews/index.vue）。
//
// **沒有空狀態**（《02》§9）：沒有未喝完的豆子時只剩標題、齒輪與浮動新增按鈕，
// 不放任何佔位文字。

definePageMeta({ screen: 'browse' })

const supabase = useSupabaseClient()
const { thumbnailUrls } = useBeanPhotos()
const fetchActiveBeans = useActiveBeans()

const beans = ref<ActiveBean[]>([])
const photoUrls = ref<Map<string, string>>(new Map())
const brewCounts = ref<Map<string, number>>(new Map())
const favoriteCounts = ref<Map<string, number>>(new Map())
const loading = ref(true)
const loadError = ref('')

const cache = useQueryCache()

async function fetchCounts() {
  const { data } = await supabase.from('brews').select('bean_id, is_favorite')
  return (data ?? []) as unknown as { bean_id: string, is_favorite: boolean }[]
}

function applyBeans(rows: ActiveBean[]) {
  beans.value = rows
  // 詳情頁的標題與照片這裡已經查到了，先放進去省下那一趟
  for (const row of rows) cache.prime(cacheKeys.bean(row.id), row)
  loadPhotos(rows)
}

// 卡片用縮圖（沒有縮圖檔時退回原圖，utils/beanPhoto.ts）。與主查詢並行，不串在後面
async function loadPhotos(rows: ActiveBean[]) {
  try {
    photoUrls.value = await thumbnailUrls(rows.map(bean => bean.photo_path))
  }
  catch {
    photoUrls.value = new Map()
  }
}

function applyCounts(rows: { bean_id: string, is_favorite: boolean }[]) {
  const counts = new Map<string, number>()
  const favorites = new Map<string, number>()
  for (const row of rows) {
    counts.set(row.bean_id, (counts.get(row.bean_id) ?? 0) + 1)
    if (row.is_favorite) favorites.set(row.bean_id, (favorites.get(row.bean_id) ?? 0) + 1)
  }
  brewCounts.value = counts
  favoriteCounts.value = favorites
}

async function load() {
  loadError.value = ''

  const beanQuery = cache.swr(cacheKeys.beanActive(), fetchActiveBeans, {
    apply: applyBeans,
    onError: (e) => { loadError.value = `讀不到資料：${errorText(e)}` },
  })
  const countQuery = cache.swr(cacheKeys.brewCounts(), fetchCounts, { apply: applyCounts })

  // 兩個都命中才算完全命中：任何一個要等，就先給骨架
  loading.value = !(beanQuery.hit && countQuery.hit)
  await Promise.all([beanQuery.settled, countQuery.settled])
  loading.value = false
}

onMounted(load)

// 只有一支未喝完的豆子時直接帶入，少一步選擇。紀錄分頁的按鈕是同一條規則（utils/navigation.ts）
const newBrewLink = computed(() => newBrewEntry(beans.value))
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

    <!-- 骨架：先把版面結構畫出來，資料回來再填。
         §6 不做進場動畫，所以這裡是靜態色塊，沒有閃爍效果。 -->
    <div v-if="loading" aria-busy="true" aria-label="讀取中">
      <section class="mt-8">
        <SkeletonBlock width="6rem" height="0.875rem" />
        <div class="-mx-5 mt-2 overflow-hidden">
          <ul class="flex gap-3 px-5">
            <li v-for="n in 2" :key="n">
              <!-- 與 HomeBeanCard 同尺寸（實測 160×258）：照片 160 見方＋資訊 96＋上下框線各 1 -->
              <SkeletonBlock width="10rem" height="16.125rem" radius="4px" />
            </li>
          </ul>
        </div>
      </section>
    </div>

    <!-- 沖煮中的豆子。沒有未喝完的豆子時整區不顯示，不放空狀態佔位（《02》§9）。 -->
    <section v-else-if="beans.length" class="mt-8">
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
                :is-sample="bean.is_sample"
              />
            </NuxtLink>
          </li>
        </ul>
      </div>
    </section>

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
