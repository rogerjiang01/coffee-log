<script setup lang="ts">
// 分享頁的內容（pages/s/[code].vue）。與紀錄詳情頁一致，另外多一小塊豆子資訊。
//
// **這裡顯示的欄位與 get_shared_brew 回傳的欄位必須完全一致**（《01》§14.2）。
// 回傳了卻沒顯示的，開發者工具裡看得到，等於不知不覺多公開了資料。
// tests/unit/share-wiring.test.mjs 逐一確認 SHARED_BREW_KEYS 的每一個 key 在這裡都有用到。
//
// 器材、沖煮、品飲三段和紀錄詳情頁是同一個元件（BrewReadonlySections，《03》§4.22），順序與樣式只有一份。
// 和詳情頁的差別：最上面多一個「豆子」段；沒有比較區、沒有動作按鈕；豆名不是連結。
// 讀取函式沒有回傳濾紙與分享壺（要改函式，2026-11-25 這一輪沒做），所以器材段沒有這兩列。
//
// 抽成元件，是為了讓頁面本身只管讀取與失效——
// 也讓這一塊能不經過資料庫就算繪出來檢查。
//
// 豆袋照片的網址不在 get_shared_brew 的回傳值裡：那支函式在資料庫裡，產生不了圖片網址，
// 它只回傳 bean.has_photo。有照片時縮圖的位置先留好，網址由伺服器端另外發
// （server/api/shared-photo，《01》§14.5），頁面拿到之後傳進來。

const props = defineProps<{
  brew: SharedBrew
  /** 縮圖與原圖的網址。還在要的時候是 null */
  photo?: { thumb: string | null, full: string | null } | null
  /** 網址要不到（或這支豆子其實沒有照片了）：縮圖的位置收掉 */
  photoFailed?: boolean
}>()

const brew = computed(() => props.brew)

const steps = computed(() => toStepInputs(brew.value.steps))
// 顯示用：舊紀錄的攪拌段併進相鄰的段（utils/brewSteps.ts）
const displaySteps = computed(() => withoutStir(steps.value))
// 養豆天數的寫法（烘焙當天／養豆第 N 天，算不出來是 null）
const restLabel = computed(() => restDayLabel(
  restDays(brew.value.bean.roast_date, new Date(brew.value.brewed_at)),
))

// 詳情頁沒有、朋友需要的那一段：「豆子」，排在器材之前（《03》§4.13.4）
const beanRows = computed(() => {
  const bean = brew.value.bean
  return [
    { label: '咖啡店名', value: bean.roaster },
    { label: '烘焙度', value: bean.roast_level ? roastLabels[bean.roast_level] : null },
    { label: '烘焙日期', value: bean.roast_date },
  ].filter((row): row is { label: string, value: string } => !!row.value)
})

function formatDate(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
</script>

<template>
  <div>
    <!-- 只有分享者本人看得到。橫幅以下與朋友看到的完全一樣——那正是他要確認的東西 -->
    <div
      v-if="brew.is_owner && brew.brew_id"
      class="mt-4 flex items-center justify-between gap-3 rounded-md pl-4 text-sm"
      :style="{ background: 'var(--accent-wash)', color: 'var(--on-accent-wash)' }"
    >
      <span>你分享的紀錄</span>
      <NuxtLink
        :to="`/brews/${brew.brew_id}`"
        class="flex shrink-0 items-center px-4 font-medium underline underline-offset-4"
        :style="{ minHeight: 'var(--touch-min)' }"
      >
        前往紀錄
      </NuxtLink>
    </div>

    <!-- 標題是整頁的定位點，維持全寬、不為照片讓出寬度 -->
    <h1 class="mt-6 text-display-m font-medium">{{ brew.bean.name }}</h1>
    <!-- 日期與星等在左、豆袋照片在右，垂直置中（《03》§4.13.4）。
         有照片時縮圖的位置一開始就在（has_photo），網址晚到也不跳動。
         沒有照片時只剩左邊一欄，與加入照片之前的版面相同 -->
    <div class="mt-1 flex items-center gap-4">
      <div class="min-w-0 flex-1">
        <!-- 日期時間一行、養豆天數一行，和紀錄詳情頁一樣；算不出養豆天數時只有日期 -->
        <p class="text-sm tabular-nums text-muted">{{ formatDate(brew.brewed_at) }}</p>
        <p v-if="restLabel" class="text-sm tabular-nums text-muted">{{ restLabel }}</p>
        <div v-if="brew.rating !== null || brew.is_favorite" class="mt-3 flex items-center gap-3">
          <StarDisplay v-if="brew.rating !== null" :rating="brew.rating" />
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
      </div>
      <PhotoZoom
        v-if="brew.bean.has_photo && !photoFailed"
        :thumb="photo?.thumb ?? null"
        :full="photo?.full ?? null"
        :alt="brew.bean.name"
      />
    </div>

    <!-- 豆子、器材、沖煮、品飲：每一段是 FormSection ＋ 一張卡片，段落之間是 --gap-section -->
    <div class="mt-8 flex flex-col" :style="{ gap: 'var(--gap-section)' }">
      <FormSection v-if="beanRows.length" title="豆子">
        <FormCard>
          <dl>
            <ReadonlyRow v-for="row in beanRows" :key="row.label" :label="row.label">{{ row.value }}</ReadonlyRow>
          </dl>
        </FormCard>
      </FormSection>

      <!-- 刻度只在有磨豆機時才會回傳（函式裡就決定了）。
           心得筆記沒勾「包含心得筆記」時，函式根本不回傳這個 key：那一列不出現，不留佔位 -->
      <BrewReadonlySections
        :grinder="brew.grinder"
        :grind-setting="brew.grind_setting"
        :dripper="brew.dripper"
        :kettle="brew.kettle"
        :dose="brew.dose"
        :water-temp="brew.water_temp"
        :total-time="brew.total_time"
        :method-name="brew.method"
        :steps="displaySteps"
        :intensity="brew.intensity"
        :flavor-tags="brew.flavor_tags"
        :notes="brew.tasting_notes ?? null"
      />
    </div>
  </div>
</template>
