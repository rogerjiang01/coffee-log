<script setup lang="ts">
// 豆子列表。未喝完的排前面，同組內依建立時間倒序。

definePageMeta({ screen: 'browse' })

interface BeanRow {
  id: string
  name: string
  photo_path: string | null
  roaster: string | null
  roast_date: string | null
  roast_level: RoastLevel | null
  is_finished: boolean
}

const supabase = useSupabaseClient()
const { thumbnailUrls } = useBeanPhotos()

const beans = ref<BeanRow[]>([])
const photoUrls = ref<Map<string, string>>(new Map())
const loading = ref(true)
const loadError = ref('')

const cache = useQueryCache()

async function fetchBeans() {
  // 排序全部寫死：未喝完在前，再依建立時間倒序，最後用 id 當決勝鍵。
  // 少了決勝鍵時，created_at 相同的兩筆每次載入的順序可能不同。
  const { data, error } = await supabase
    .from('beans')
    .select('id, name, photo_path, roaster, roast_date, roast_level, is_finished')
    .order('is_finished', { ascending: true })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
  if (error) throw toError(error)
  return (data ?? []) as unknown as BeanRow[]
}

function apply(rows: BeanRow[]) {
  beans.value = rows
  // 詳情頁需要的欄位這裡已經查到一半了，先放進去，
  // 點進去時標題與照片可以立刻出現，不必等那一趟來回。
  for (const row of rows) cache.prime(cacheKeys.bean(row.id), row)
  loadPhotos(rows)
}

// 列表用縮圖（沒有縮圖檔時退回原圖，utils/beanPhoto.ts）。只依賴 photo_path，
// 可以與主查詢並行，不必等資料回來才開始。
async function loadPhotos(rows: BeanRow[]) {
  try {
    photoUrls.value = await thumbnailUrls(rows.map(bean => bean.photo_path))
  }
  catch {
    photoUrls.value = new Map()
  }
}

async function load() {
  loadError.value = ''
  const { hit, settled } = cache.swr(cacheKeys.beanList(), fetchBeans, {
    apply,
    onError: (e) => { loadError.value = `讀不到豆子：${errorText(e)}` },
  })
  // 命中時畫面同步就填好了，骨架連一幀都不該出現
  loading.value = !hit
  await settled
  loading.value = false
}

// 已喝完用分組表達，不用透明度。
// 透明度讓文字讀不了，無照片時也看不出差別，而且語意錯了——
// 透明度表達「不重要」，但已喝完的豆子使用者可能正要回頭找它。
const active = computed(() => beans.value.filter(bean => !bean.is_finished))
const finished = computed(() => beans.value.filter(bean => bean.is_finished))

// 每一列的縮圖網址、養豆、無障礙名稱（utils/bean.ts）
const photoUrl = (bean: BeanRow) => bean.photo_path ? (photoUrls.value.get(bean.photo_path) ?? null) : null
const rest = (bean: BeanRow) => beanListRest(bean.roast_date, bean.is_finished)
const rowLabel = (bean: BeanRow) => beanRowLabel({ name: bean.name, roaster: bean.roaster, rest: rest(bean) })

onMounted(load)
</script>

<template>
  <!-- 底部留白（分頁列與浮動按鈕）由 app.vue 讓出，這裡不留；少了它最後一筆會被永久遮住 -->
  <main class="mx-auto px-5 pt-10" :style="{ maxWidth: 'var(--content-max)' }">
    <!-- 瀏覽型：頂部只有標題。回總覽是分頁列的事，這裡不放第二個入口 -->
    <PageHeader title="豆子" />

    <p v-if="loadError" role="alert" class="mt-4 text-sm" :style="{ color: 'var(--danger)' }">
      {{ loadError }}
    </p>

    <!-- 骨架：和內容同一個版面——一張卡片、卡片裡是縮圖方塊加兩行的列（2026-11-27）。
         縮圖方塊跟著縮圖用 --radius-md（《03》§2.3.1 例外 a，class 名稱有 thumb 讓盤點認得）；
         文字的色塊不在轉角區（離卡片邊 92px 以上），用預設圓角 -->
    <AppCard
      v-if="loading" radius="ml" border-inside aria-busy="true" aria-label="讀取中"
      class="overflow-hidden" :style="{ marginTop: 'var(--gap-section)' }"
    >
      <ul>
        <li
          v-for="n in 4" :key="n" class="bean-skeleton-row card-pad-x flex items-center gap-3"
          :style="{ paddingBlock: 'var(--sheet-pad-thumb)' }"
        >
          <SkeletonBlock width="4rem" height="4rem" radius="var(--radius-md)" class="bean-skeleton-thumb shrink-0" />
          <span class="flex min-w-0 flex-1 flex-col" :style="{ gap: '2px' }">
            <span class="flex items-center" :style="{ height: 'var(--sheet-line)' }"><SkeletonBlock width="60%" height="1.125rem" /></span>
            <span class="flex items-center" :style="{ height: 'calc(var(--text-body-m) * var(--text-body-m--line-height))' }"><SkeletonBlock width="40%" height="0.875rem" /></span>
          </span>
        </li>
      </ul>
    </AppCard>

    <!-- 空狀態不放文案：新增入口（右下浮動按鈕）已經在畫面上，
         §5.6 明講這種情況不顯示任何文字 -->

    <!-- 分組卡片（2026-11-27，Figma「豆子列表（草稿）－B 分組卡片」3675:1888，《03》§4.5.2）：
         還在喝的一張卡片、上面不加段落標題（頁面標題「豆子」就是它的標題）；已喝完是段落標題加一張卡片
         （FormSection，和器材列表同一個做法），沒有已喝完的豆子時整段不顯示。
         卡片是分頁第一層的 ml（18px），邊界與陰影和總覽、紀錄卡片相同；外框畫在內側（border-inside），
         列文字因此和段落標題對齊在同一條線（--card-pad）。頁首、卡片、段落之間都是 --gap-section -->
    <div
      v-else-if="beans.length" class="flex flex-col"
      :style="{ marginTop: 'var(--gap-section)', gap: 'var(--gap-section)' }"
    >
      <AppCard v-if="active.length" radius="ml" border-inside class="overflow-hidden">
        <ul>
          <TwoLineRow v-for="bean in active" :key="bean.id" :to="`/beans/${bean.id}`" :aria-label="rowLabel(bean)">
            <template #start>
              <!-- 豆名就在旁邊，縮圖不另外唸一次（alt 留空） -->
              <span class="bean-row-thumb block size-16 shrink-0 overflow-hidden">
                <BeanThumb :photo-url="photoUrl(bean)" :roast-level="bean.roast_level" alt="" />
              </span>
            </template>
            <!-- 範例豆子的標示寫在豆名裡（「範例-…」，《01》§13.2），不另外放標籤 -->
            <template #title>
              <span class="min-w-0 truncate">{{ bean.name }}</span>
            </template>
            <!-- 第二行：咖啡店名、養豆，兩項之間是間距，不用中間點。沒填的那項不顯示，兩項都沒有時整行不出現 -->
            <template v-if="bean.roaster?.trim() || rest(bean)" #meta>
              <span v-if="bean.roaster?.trim()" class="min-w-0 truncate">{{ bean.roaster }}</span>
              <span v-if="rest(bean)" class="shrink-0 tabular-nums">{{ rest(bean) }}</span>
            </template>
          </TwoLineRow>
        </ul>
      </AppCard>

      <!-- 已喝完用分組表達，不用透明度（見 script）。已喝完的豆子不顯示養豆（beanListRest） -->
      <FormSection v-if="finished.length" title="已喝完">
        <AppCard radius="ml" border-inside class="overflow-hidden">
          <ul>
            <TwoLineRow v-for="bean in finished" :key="bean.id" :to="`/beans/${bean.id}`" :aria-label="rowLabel(bean)">
              <template #start>
                <span class="bean-row-thumb block size-16 shrink-0 overflow-hidden">
                  <BeanThumb :photo-url="photoUrl(bean)" :roast-level="bean.roast_level" alt="" />
                </span>
              </template>
              <template #title>
                <span class="min-w-0 truncate">{{ bean.name }}</span>
              </template>
              <template v-if="bean.roaster?.trim() || rest(bean)" #meta>
                <span v-if="bean.roaster?.trim()" class="min-w-0 truncate">{{ bean.roaster }}</span>
                <span v-if="rest(bean)" class="shrink-0 tabular-nums">{{ rest(bean) }}</span>
              </template>
            </TwoLineRow>
          </ul>
        </AppCard>
      </FormSection>
    </div>

    <!-- 列表頁的新增入口一律是右下角浮動按鈕（§3 導覽）：
         單手持手機時拇指在下方，頂部按鈕構不到。 -->
    <NuxtLink
      to="/beans/new"
      aria-label="新增豆子"
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
/* 縮圖 64px、--radius-md（12px，照 Figma）。照片與縮圖不跟著卡片算圓角（《03》§2.3.1 例外 a），
   也沒有大於卡片的 18px（規則 2） */
.bean-row-thumb {
  border-radius: var(--radius-md);
}
/* 骨架的列之間一條分隔線，和 TwoLineRow 相同 */
.bean-skeleton-row:not(:last-child) {
  box-shadow: inset 0 -1px 0 var(--border);
}
</style>
