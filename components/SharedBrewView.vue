<script setup lang="ts">
// 分享頁的內容（pages/s/[code].vue）。與紀錄詳情頁一致，另外多一小塊豆子資訊。
//
// **這裡顯示的欄位與 get_shared_brew 回傳的欄位必須完全一致**（《01》§14.2）。
// 回傳了卻沒顯示的，開發者工具裡看得到，等於不知不覺多公開了資料。
// tests/unit/share-wiring.test.mjs 逐一確認 SHARED_BREW_KEYS 的每一個 key 在這裡都有用到。
//
// 抽成元件、只吃一個 prop，是為了讓頁面本身只管讀取與失效——
// 也讓這一塊能不經過資料庫就算繪出來檢查。

const props = defineProps<{ brew: SharedBrew }>()

const brew = computed(() => props.brew)

const steps = computed(() => toStepInputs(brew.value.steps))
const water = computed(() => totalWater(steps.value))
const ratio = computed(() => brewRatioLabel(water.value, brew.value.dose))
const increments = computed(() => incrementalWater(steps.value))
const restedDays = computed(() =>
  restDays(brew.value.bean.roast_date, new Date(brew.value.brewed_at)),
)

// 詳情頁沒有、朋友需要的那一塊。排在參數列表最上面，同一種 dl 列（《03》§4.13.4）
const beanRows = computed(() => {
  const bean = brew.value.bean
  return [
    { label: '咖啡店名', value: bean.roaster },
    { label: '烘焙度', value: bean.roast_level ? roastLabels[bean.roast_level] : null },
    { label: '烘焙日期', value: bean.roast_date },
  ].filter(row => row.value)
})

// 與紀錄詳情頁同一組、同一個順序。刻度只在有磨豆機時才會回傳（函式裡就決定了）
const params = computed(() => {
  const b = brew.value
  return [
    { label: '粉重', value: b.dose === null ? null : `${b.dose} g` },
    { label: '總水量', value: water.value === null ? null : `${water.value} g` },
    { label: '粉水比', value: ratio.value },
    { label: '水溫', value: b.water_temp === null ? null : `${b.water_temp} °C` },
    { label: '研磨刻度', value: b.grind_setting === null ? null : String(b.grind_setting) },
    { label: '沖煮時間', value: b.total_time === null ? null : secondsToClock(b.total_time) },
    { label: '養豆天數', value: restedDays.value === null ? null : `${restedDays.value} 天` },
    { label: '磨豆機', value: b.grinder },
    { label: '濾杯', value: b.dripper },
    { label: '手沖壺', value: b.kettle },
    { label: '沖煮手法', value: b.method },
  ].filter(row => row.value)
})

const intensityRows = computed(() => {
  const source = brew.value.intensity ?? {}
  return ([
    ['acidity', '酸質'], ['sweetness', '甜感'], ['body', '醇厚'], ['bitterness', '苦味'],
  ] as const)
    .map(([key, label]) => ({ label, value: source[key] }))
    .filter(row => row.value !== undefined)
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

    <h1 class="mt-6 font-serif text-2xl font-bold">{{ brew.bean.name }}</h1>
    <p class="mt-1 text-sm tabular-nums text-muted">{{ formatDate(brew.brewed_at) }}</p>
    <div v-if="brew.rating !== null || brew.is_favorite" class="mt-3 flex items-center gap-3">
      <span v-if="brew.rating !== null" class="flex" :aria-label="`評分 ${brew.rating} 顆星`">
        <svg
          v-for="level in 5" :key="level"
          width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"
          stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
          :fill="brew.rating >= level ? 'var(--favorite)' : 'transparent'"
          :stroke="brew.rating >= level ? 'var(--favorite)' : 'var(--control-empty)'"
        >
          <path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" />
        </svg>
      </span>
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

    <dl class="mt-6">
      <div
        v-for="row in [...beanRows, ...params]"
        :key="row.label"
        class="flex justify-between gap-3 border-t py-3"
        :style="{ borderColor: 'var(--border)' }"
      >
        <dt class="shrink-0 text-sm text-muted">{{ row.label }}</dt>
        <dd class="min-w-0 text-right tabular-nums">{{ row.value }}</dd>
      </div>
    </dl>

    <section v-if="steps.length" class="mt-8">
      <h2 class="font-serif text-lg font-bold">分段</h2>
      <ul class="mt-3">
        <li
          v-for="(step, index) in steps"
          :key="index"
          class="flex items-baseline justify-between border-t py-3"
          :style="{ borderColor: 'var(--border)' }"
        >
          <span class="min-w-0 flex-1 text-sm">
            <span class="flex items-center gap-1.5">
              {{ stepLabel(steps, index) }}
              <StirIcon
                v-if="step.stepType === 'stir'"
                label="這一段有攪拌"
                :style="{ color: 'var(--accent)' }"
              />
            </span>
            <span v-if="step.note" class="block text-xs text-muted">{{ step.note }}</span>
          </span>
          <span class="tabular-nums">
            注到 {{ step.cumulativeWater }}g
            <span v-if="increments[index] !== null" class="ml-2 text-sm text-muted">
              +{{ increments[index] }}g
            </span>
            <span v-if="step.holdSeconds !== null" class="ml-3 text-sm text-muted">
              停 {{ step.holdSeconds }} 秒
            </span>
          </span>
        </li>
      </ul>
    </section>

    <section v-if="intensityRows.length" class="mt-8">
      <h2 class="font-serif text-lg font-bold">強度</h2>
      <dl class="mt-3">
        <div
          v-for="row in intensityRows"
          :key="row.label"
          class="flex justify-between border-t py-3"
          :style="{ borderColor: 'var(--border)' }"
        >
          <dt class="text-sm text-muted">{{ row.label }}</dt>
          <dd class="tabular-nums">{{ row.value }} / 5</dd>
        </div>
      </dl>
    </section>

    <section v-if="brew.flavor_tags.length" class="mt-8">
      <h2 class="font-serif text-lg font-bold">風味</h2>
      <div class="mt-3 flex flex-wrap gap-2">
        <span
          v-for="tag in brew.flavor_tags"
          :key="tag"
          class="rounded-sm border px-3 py-1 text-sm"
          :style="{ borderColor: 'var(--border)' }"
        >
          {{ tag }}
        </span>
      </div>
    </section>

    <!-- 沒勾「包含心得筆記」時，函式根本不回傳這個 key：整段不出現，不留佔位 -->
    <section v-if="brew.tasting_notes" class="mt-8">
      <h2 class="font-serif text-lg font-bold">心得</h2>
      <p class="mt-2 whitespace-pre-line">{{ brew.tasting_notes }}</p>
    </section>
  </div>
</template>
