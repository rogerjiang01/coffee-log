<script setup lang="ts">
// 豆子詳情（《02-功能規格》§8）。
//
// 此頁的重點是該豆子所有沖煮紀錄的並排比較——這是本產品「幫助使用者進步」
// 的核心價值落點。
//
// 檢視型畫面（《03》§3）：左上 ‹ 回上一頁（歷史式），分頁列保留，編輯與刪除在內容區。
//
// 版面（2026-11-27 改版，Figma「豆子詳情（草稿）－A 主圖版」3649:1552；《03》§4.23）：
//   主圖（BrewHero，和結算頁共用）  豆袋照片滿版，點照片放大；沒有照片時是 BrewHeroFallback。
//                                   左上角是浮動的返回鈕（固定在畫面頂端），右上角不放按鈕。
//                                   標題區：咖啡店名 → 豆名 → 小數據（養豆、沖煮、收藏）
//   豆子資訊                        唯讀列，照新增豆子表單的順序；有填才有
//   每次怎麼沖的                    比較表
//   頁尾                            照上次再沖一次（或用這支豆子沖一杯）、已喝完、編輯、刪除

definePageMeta({ screen: 'view' })

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
/** 最新一筆紀錄，「照上次再沖一次」要複製的對象 */
const latestBrew = ref<{ id: string, date: string } | null>(null)
const loading = ref(true)
const loadError = ref('')
const notFound = ref(false)
const confirmOpen = ref(false)
// 第一個段落（豆子資訊，沒有的話是下一段）：主圖的漸層在它的頂端剛好到實底（BrewHero 的 solidAt）
const sections = ref<HTMLElement | null>(null)
const deleting = ref(false)
const actionError = ref('')

const id = computed(() => String(route.params.id))

const cache = useQueryCache()
const exitTo = useFlowExit()

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
  // fetchBrews 依 brewed_at、id 由舊到新排，最後一筆就是最新的
  const latest = rows.at(-1)
  latestBrew.value = latest ? { id: latest.id, date: compareDate(latest.brewed_at) } : null
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

const roaster = computed(() => bean.value?.roaster?.trim() || null)

// ── 小數據（標題區裡、豆名下面）：有值才出現，三項都沒有時整排拿掉 ──────────
// 養豆是「今天」離烘焙日幾天（豆子詳情沒有沖煮日期），寫法和結算頁同一個（restDayValue：「N 天」，0 是「烘焙當天」）。
// 已喝完的豆子不顯示：從今天起算的天數對喝完的豆子沒有意義（2026-11-27）
const stats = computed(() => {
  const items: { label: string, value: string }[] = []
  const rest = bean.value?.is_finished ? null : restDayValue(restDays(bean.value?.roast_date))
  if (rest) items.push({ label: '養豆', value: rest })
  if (brewCount.value > 0) items.push({ label: '沖煮', value: `${brewCount.value} 次` })
  if (favoriteCount.value > 0) items.push({ label: '收藏', value: `${favoriteCount.value} 次` })
  return items
})

// ── 豆子資訊：照新增豆子表單的順序，有填才有（咖啡店名在標題區，官方風味描述是最後一列，另外放） ──
const infoRows = computed(() => {
  const b = bean.value
  if (!b) return []
  return [
    // 共用的日期寫法 YYYY/MM/DD（utils/formDate.ts），不是資料庫的 YYYY-MM-DD
    { label: '烘焙日期', value: pillDate(b.roast_date) },
    { label: '烘焙度', value: b.roast_level ? roastLabels[b.roast_level] : null },
    { label: '產國', value: b.countries?.name_zh ?? null },
    { label: '產區', value: b.region },
    { label: '處理法', value: b.processing_methods?.name ?? null },
    { label: '品種', value: b.varieties?.name ?? null },
  ].filter((row): row is { label: string, value: string } => !!row.value)
})
const officialNotes = computed(() => bean.value?.official_notes?.trim() || null)
// 全部沒填就連段落標題一起不顯示；從列表帶進來的半成品還不知道，先留著（骨架列）
const showInfo = computed(() => infoRows.value.length > 0 || !!officialNotes.value || partial.value)

async function toggleFinished(next: boolean) {
  if (!bean.value) return
  const { error } = await supabase.from('beans').update({ is_finished: next } as never).eq('id', id.value)
  if (error) {
    actionError.value = `更新失敗：${errorText(error)}`
    return
  }
  bean.value.is_finished = next
  // 影響列表的分組與總覽「沖煮中的豆子」的收錄。不清的話回上一頁還看得到它在「沖煮中」
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
  // 不留在 history 裡：刪除後按返回不會看到「找不到」（useFlowExit）
  await exitTo(BEAN_BACK_FALLBACK)
}
</script>

<template>
  <!-- 沒有左右內距：主圖要滿版（手機上貼齊螢幕，寬螢幕時就是這一欄的寬度）。下面的內容自己留 --form-gutter -->
  <!-- overflow: clip：主圖的背景層用平移抵銷捲動（BrewHero），平移出去的部分不能撐大頁面的捲動範圍，否則越捲越長 -->
  <main class="mx-auto overflow-clip" :style="{ maxWidth: 'var(--content-max)' }">
    <!-- ‹ 在所有狀態判斷之外：讀取中、讀取失敗、找不到都要看得到。
         浮在主圖上的圓鈕，固定在畫面頂端（和結算頁右上角的按鈕同一個高度）。
         歷史式：回到使用者實際來的地方（總覽的最近沖煮、豆子列表、紀錄詳情的豆名），
         沒有上一頁（外部連結直接打開）才回豆子列表（《03》§3、BEAN_BACK_FALLBACK） -->
    <div class="bean-back">
      <BackButton floating :to="BEAN_BACK_FALLBACK" label="返回" />
    </div>

    <!-- 讀取中：主圖的位置先留好（同一個高度），標題區與段落是骨架 -->
    <div v-if="loading" aria-busy="true" aria-label="讀取中">
      <div class="bean-hero-placeholder flex flex-col justify-end gap-2">
        <SkeletonBlock width="30%" height="1.25rem" />
        <SkeletonBlock width="80%" height="2.25rem" />
        <div class="mt-1 flex gap-7">
          <SkeletonBlock v-for="n in 3" :key="n" width="2.75rem" height="2.75rem" />
        </div>
      </div>
      <div class="mt-5 flex flex-col" :style="{ paddingInline: 'var(--form-gutter)', gap: 'var(--gap-group)' }">
        <SkeletonBlock width="6rem" height="1.5rem" :style="{ marginLeft: 'var(--card-pad)' }" />
        <SkeletonBlock height="14rem" radius="var(--radius-lg)" />
      </div>
    </div>

    <!-- 整頁都讀不到、或找不到：沒有主圖，內容從返回鈕下方開始 -->
    <div v-else-if="notFound || !bean" class="bean-plain" :style="{ paddingInline: 'var(--form-gutter)' }">
      <h1 v-if="notFound" class="text-display-s font-medium">找不到這支豆子</h1>
      <template v-else-if="loadError">
        <p role="alert" class="text-sm" :style="{ color: 'var(--danger)' }">{{ loadError }}</p>
        <AppButton variant="outline" block class="mt-4" @click="load">
          重試
        </AppButton>
      </template>
    </div>

    <template v-else-if="bean">
      <BrewHero
        :has-photo="!!bean.photo_path"
        :photo-url="photoUrl"
        :roast-level="bean.roast_level"
        :solid-at="sections"
        :alt="bean.name"
      >
        <p v-if="roaster" class="text-heading-s font-medium">{{ roaster }}</p>
        <!-- 換行不截斷。範例豆子的標示寫在豆名裡（「範例-…」，《01》§13.2），不另外放標籤 -->
        <h1 class="text-display-l font-medium break-words">{{ bean.name }}</h1>
        <!-- 小數據：豆名下面 12px（標題區的間距 6 再加 6），項目間距 28，放不下就換行。
             值在上、標籤在下（dt 在 DOM 裡先，畫面上在下），和結算頁的小數據列同一種寫法 -->
        <dl v-if="stats.length" class="mt-1.5 flex flex-wrap gap-x-7 gap-y-3">
          <div v-for="item in stats" :key="item.label" class="flex flex-col-reverse gap-0.5">
            <dt class="text-body-m text-muted">{{ item.label }}</dt>
            <dd class="text-heading-l font-medium tabular-nums">{{ item.value }}</dd>
          </div>
        </dl>
      </BrewHero>

      <!-- 左右是頁面的內距（--form-gutter），和主圖的標題區、段落用同一組 token。
           上層（relative、z-index 1）：捲動時從固定的主圖背景上滑過去，本身不鋪底色（卡片有自己的底） -->
      <div class="relative z-1 pt-5" :style="{ paddingInline: 'var(--form-gutter)' }">
        <!-- 豆子已經顯示、只有紀錄讀不到時：紅字就夠了 -->
        <p v-if="loadError" role="alert" class="mb-5 text-sm" :style="{ color: 'var(--danger)' }">{{ loadError }}</p>

        <div ref="sections" class="flex flex-col" :style="{ gap: 'var(--gap-section)' }">
          <FormSection v-if="showInfo" title="豆子資訊">
            <FormCard>
              <dl>
                <ReadonlyRow v-for="row in infoRows" :key="row.label" :label="row.label">{{ row.value }}</ReadonlyRow>
                <!-- 長內容、保留換行：值靠左，標籤對齊第一行 -->
                <ReadonlyRow v-if="officialNotes" label="官方風味描述" start>{{ officialNotes }}</ReadonlyRow>
                <!-- 從列表帶進來的資料沒有產國、產區、處理法、品種、官方風味描述。
                     留一列骨架告訴使用者「還有東西在路上」，
                     不然那幾列會無預警地冒出來，看起來像畫面在跳。
                     它是卡片最後一列，兩塊骨架落在下方的兩個轉角：圓角 8px（卡片 24 − 內距 16，《03》§2.3.1），剛好是高度的一半 -->
                <div v-if="partial" class="sheet-row sheet-row--text card-pad-x" aria-hidden="true">
                  <SkeletonBlock width="4rem" height="1rem" radius="8px" />
                  <SkeletonBlock width="6rem" height="1rem" radius="8px" />
                </div>
              </dl>
            </FormCard>
          </FormSection>

          <!-- 比較表。這張表必須在手機上好用——Excel 在電腦上做得比這好，
               但在手機上做得極差，而喝咖啡的當下人都在手機上。 -->
          <!-- 沒有紀錄時整區不出現，不寫文案也不留空標題：
               下方的「用這支豆子沖一杯」就是下一步（《03》§5.6） -->
          <FormSection v-if="compareRows.length" title="每次怎麼沖的">
            <div>
              <p v-if="compareRows.length === 1" class="card-pad-x mb-3 text-muted">
                記錄第二筆後可以比較，改動的數值會標示出來。
              </p>
              <BeanCompareTable :rows="compareRows" />
            </div>
          </FormSection>

          <!--
            只有一個主要動作，依有沒有紀錄二選一，不並列兩顆（《02》§8）。
            空白表單在這裡幾乎沒有價值：想換手法、換粉重，複製之後改那幾格
            比從空白填快，而水溫、刻度、器材多半不會變。並列兩顆的成本是
            每次都要做一個沒必要的選擇。

            永遠複製最新那筆，不做「有收藏就複製收藏的」：畫面上看不出來的規則
            違反可預測性。想複製收藏那筆，從比較表點進去再複製。
          -->
          <div>
            <div>
              <AppButton block
                :to="latestBrew ? `/brews/new?copy=${latestBrew.id}` : `/brews/new?bean=${bean.id}`"
              >
                {{ latestBrew ? '照上次再沖一次' : '用這支豆子沖一杯' }}
              </AppButton>
              <!-- 帶入哪一筆寫在按鈕下方，按鈕文字不塞資訊。日期格式與比較表一致 -->
              <p v-if="latestBrew" class="mt-1 text-center text-sm tabular-nums text-muted">
                帶入 {{ latestBrew.date }} 那次的參數
              </p>
            </div>

            <!-- 狀態不是動作，用 role="switch" 的開關而不是按鈕。
                 只有一列、獨立成一張卡片：和表單裡的單列卡片同一個元件（56px、膠囊形 28px，2026-11-19；列高 2026-11-23） -->
            <FormCard pill class="mt-4">
              <FormRow>
                <ToggleSwitch
                  :model-value="bean.is_finished"
                  label="已喝完"
                  row
                  @update:model-value="toggleFinished"
                />
              </FormRow>
            </FormCard>

            <p v-if="actionError" class="mt-4 text-sm" :style="{ color: 'var(--danger)' }">{{ actionError }}</p>

            <!-- 編輯與刪除在內容區，不在頂部角落（《03》§3）：頂部角落只留給 ‹。
                 權重依頻率排：再沖一次（主要）→ 編輯（次要，有框）→ 刪除（最低，無框） -->
            <AppButton variant="outline" block
              :to="`/beans/${bean.id}/edit`"
              class="mt-4"
            >
              編輯
            </AppButton>

            <AppButton variant="text" tone="danger" block
              class="mt-3"
              @click="confirmOpen = true"
            >
              刪除
            </AppButton>
          </div>
        </div>
      </div>

      <ConfirmDialog
        :open="confirmOpen"
        :title="`刪除「${bean.name}」`"
        :body="brewCount > 0
          ? `刪除後無法復原。這支豆子的 ${brewCount} 筆沖煮紀錄會一併刪除。`
          : '刪除後無法復原。'"
        confirm-label="刪除"
        :busy="deleting"
        @cancel="confirmOpen = false"
        @confirm="destroy"
      />
    </template>
  </main>
</template>

<style scoped>
/* 浮動的返回鈕：固定在畫面頂端，和結算頁右上角的按鈕同一個高度（BrewHero 的 .brew-hero__actions：距頂 40），
   左緣和分頁列同一條線（--fixed-left：手機上距左 20，寬螢幕時跟著內容欄，橫向時避開安全區）。疊在所有內容上面 */
.bean-back {
  position: fixed;
  z-index: 20;
  top: calc(env(safe-area-inset-top) + 40px);
  left: var(--fixed-left);
}
/* 讀取中：和 BrewHero 同一個高度，標題區同一條線 */
.bean-hero-placeholder {
  min-height: min(470px, 58svh);
  padding-inline: calc(var(--form-gutter) + var(--card-pad));
}
/* 沒有主圖時：內容從返回鈕下方開始（距頂 40 ＋ 44 ＋ 間距 20） */
.bean-plain {
  padding-top: calc(env(safe-area-inset-top) + 104px);
}
</style>
