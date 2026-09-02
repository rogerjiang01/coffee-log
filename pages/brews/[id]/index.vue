<script setup lang="ts">
// 沖煮紀錄詳情。
//
// 這階段只做內容顯示：差異區塊與「照這次再沖一次」屬於階段 6。
// 衍生值在此頁完整顯示，全部即時計算，不存資料庫（§8）。

const route = useRoute()
const supabase = useSupabaseClient()

const id = computed(() => String(route.params.id))

interface BrewDetail {
  id: string
  dose: number | null
  water_temp: number | null
  grind_setting: number | null
  total_time: number | null
  brewed_at: string
  rating: number | null
  is_favorite: boolean
  tasting_notes: string | null
  intensity: Intensity | null
  beans: { id: string; name: string; roast_date: string | null } | null
  brew_methods: { name: string } | null
  grinder: EquipmentNameRow | null
  dripper: EquipmentNameRow | null
  kettle: EquipmentNameRow | null
}
interface EquipmentNameRow {
  custom_name: string | null
  equipment_catalog: { brand: string; model: string; variant: string | null } | null
}

const brew = ref<BrewDetail | null>(null)
const steps = ref<StepInput[]>([])
const tags = ref<string[]>([])
const loading = ref(true)
const loadError = ref('')
const notFound = ref(false)
const confirmOpen = ref(false)
const deleting = ref(false)
const actionError = ref('')

async function load() {
  try {
    const { data } = await supabase
      .from('brews')
      .select(`
        id, dose, water_temp, grind_setting, total_time, brewed_at,
        rating, is_favorite, tasting_notes, intensity,
        beans ( id, name, roast_date ),
        brew_methods ( name ),
        grinder:grinder_id ( custom_name, equipment_catalog ( brand, model, variant ) ),
        dripper:dripper_id ( custom_name, equipment_catalog ( brand, model, variant ) ),
        kettle:kettle_id ( custom_name, equipment_catalog ( brand, model, variant ) )
      `)
      .eq('id', id.value)
      .maybeSingle()

    if (!data) {
      notFound.value = true
      return
    }
    brew.value = data as unknown as BrewDetail

    const { data: stepRows } = await supabase
      .from('brew_steps')
      .select('step_index, time_offset, cumulative_water, step_type, note')
      .eq('brew_id', id.value)
      .order('step_index')
    steps.value = toStepInputs((stepRows ?? []) as unknown as StepRow[], brew.value.total_time)

    const { data: tagRows } = await supabase
      .from('brew_flavor_tags')
      .select('flavor_tags ( name )')
      .eq('brew_id', id.value)
    tags.value = ((tagRows ?? []) as unknown as { flavor_tags: { name: string } | null }[])
      .map(row => row.flavor_tags?.name)
      .filter((name): name is string => !!name)

    loading.value = false
  }
  catch (e) {
    loadError.value = e instanceof Error ? `讀不到資料：${e.message}` : '讀不到資料'
  }
  finally {
    // finally：任何失敗都不能讓頁面停在「讀取中」
    loading.value = false
  }
}
onMounted(load)

const water = computed(() => totalWater(steps.value))
const ratio = computed(() => brewRatioLabel(water.value, brew.value?.dose ?? null))
const increments = computed(() => incrementalWater(steps.value))
const restedDays = computed(() =>
  restDays(brew.value?.beans?.roast_date, brew.value ? new Date(brew.value.brewed_at) : undefined),
)

const intensityRows = computed(() => {
  const source = brew.value?.intensity ?? {}
  return ([
    ['acidity', '酸質'], ['sweetness', '甜感'], ['body', '醇厚'], ['bitterness', '苦味'],
  ] as const)
    .map(([key, label]) => ({ label, value: source[key] }))
    .filter(row => row.value !== undefined)
})

const params = computed(() => {
  const b = brew.value
  if (!b) return []
  return [
    { label: '粉重', value: b.dose === null ? null : `${b.dose} g` },
    { label: '總水量', value: water.value === null ? null : `${water.value} g` },
    { label: '粉水比', value: ratio.value },
    { label: '水溫', value: b.water_temp === null ? null : `${b.water_temp} °C` },
    { label: '研磨刻度', value: b.grind_setting === null ? null : String(b.grind_setting) },
    { label: '總沖煮時間', value: b.total_time === null ? null : secondsToClock(b.total_time) },
    { label: '養豆天數', value: restedDays.value === null ? null : `${restedDays.value} 天` },
    { label: '磨豆機', value: b.grinder ? equipmentOptionName(b.grinder) : null },
    { label: '濾杯', value: b.dripper ? equipmentOptionName(b.dripper) : null },
    { label: '手沖壺', value: b.kettle ? equipmentOptionName(b.kettle) : null },
    { label: '沖煮手法', value: b.brew_methods?.name ?? null },
  ].filter(row => row.value)
})

function formatDate(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

async function destroy() {
  deleting.value = true
  const { error } = await supabase.from('brews').delete().eq('id', id.value)
  deleting.value = false
  confirmOpen.value = false
  if (error) {
    actionError.value = `沒有刪成功：${error.message}`
    return
  }
  await navigateTo('/')
}
</script>

<template>
  <main class="mx-auto px-5 pt-10 pb-16" :style="{ maxWidth: 'var(--content-max)' }">
    <p v-if="loadError" role="alert" class="text-sm" :style="{ color: 'var(--danger)' }">{{ loadError }}</p>
    <p v-if="loading" class="text-muted">讀取中</p>

    <template v-else-if="notFound">
      <h1 class="font-serif text-xl font-bold">找不到這筆紀錄</h1>
      <NuxtLink to="/" class="mt-4 inline-block underline" :style="{ color: 'var(--accent)' }">回首頁</NuxtLink>
    </template>

    <template v-else-if="brew">
      <div class="flex items-baseline justify-between">
        <NuxtLink to="/" class="text-sm underline" :style="{ color: 'var(--accent)' }">首頁</NuxtLink>
        <NuxtLink :to="`/brews/${brew.id}/edit`" class="text-sm underline" :style="{ color: 'var(--accent)' }">
          編輯
        </NuxtLink>
      </div>

      <h1 class="mt-4 font-serif text-2xl font-bold">
        {{ brew.beans?.name ?? '沒有指定豆子' }}
      </h1>
      <p class="mt-1 text-sm tabular-nums text-muted">{{ formatDate(brew.brewed_at) }}</p>
      <!-- 評分與收藏是兩個獨立欄位，分開顯示 -->
      <div v-if="brew.rating !== null || brew.is_favorite" class="mt-3 flex items-center gap-3">
        <span v-if="brew.rating !== null" class="flex" :aria-label="`評分 ${brew.rating} 顆星`">
          <svg
            v-for="level in 5" :key="level"
            width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"
          >
            <path
              d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z"
              :fill="brew.rating >= level ? 'var(--favorite)' : 'transparent'"
              :stroke="brew.rating >= level ? 'var(--favorite)' : 'var(--border)'"
              stroke-width="1.5" stroke-linejoin="round"
            />
          </svg>
        </span>
        <span v-if="brew.is_favorite" class="flex items-center gap-1 text-sm" :style="{ color: 'var(--favorite)' }">
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M12 20s-7-4.5-7-9.5A3.5 3.5 0 0112 8a3.5 3.5 0 017 2.5C19 15.5 12 20 12 20z"
              fill="var(--favorite)" stroke="var(--favorite)" stroke-width="1.5" stroke-linejoin="round"
            />
          </svg>
          收藏
        </span>
      </div>

      <dl class="mt-6">
        <div
          v-for="row in params"
          :key="row.label"
          class="flex justify-between border-t py-3"
          :style="{ borderColor: 'var(--border)' }"
        >
          <dt class="text-sm text-muted">{{ row.label }}</dt>
          <dd class="tabular-nums">{{ row.value }}</dd>
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
              <span class="block">
                {{ step.stepType === 'bloom' ? '悶蒸' : `第 ${index} 段` }}<template v-if="step.stepType === 'stir'">・攪拌</template>
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

      <section v-if="tags.length" class="mt-8">
        <h2 class="font-serif text-lg font-bold">風味</h2>
        <div class="mt-3 flex flex-wrap gap-2">
          <span
            v-for="tag in tags"
            :key="tag"
            class="rounded-sm border px-3 py-1 text-sm"
            :style="{ borderColor: 'var(--border)' }"
          >
            {{ tag }}
          </span>
        </div>
      </section>

      <section v-if="brew.tasting_notes" class="mt-8">
        <h2 class="font-serif text-lg font-bold">心得</h2>
        <p class="mt-2 whitespace-pre-line">{{ brew.tasting_notes }}</p>
      </section>

      <p v-if="actionError" role="alert" class="mt-6 text-sm" :style="{ color: 'var(--danger)' }">
        {{ actionError }}
      </p>

      <button
        type="button"
        class="mt-8 w-full rounded-sm px-4 py-3"
        :style="{ color: 'var(--danger)', minHeight: '44px' }"
        @click="confirmOpen = true"
      >
        刪除
      </button>

      <ConfirmDialog
        :open="confirmOpen"
        title="刪除這筆紀錄？"
        body="連同分段一起刪掉，沒辦法復原。豆子不會被刪。"
        confirm-label="刪除這筆紀錄"
        :busy="deleting"
        @cancel="confirmOpen = false"
        @confirm="destroy"
      />
    </template>
  </main>
</template>
