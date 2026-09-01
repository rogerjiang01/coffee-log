<script setup lang="ts">
// 豆子詳情。這階段只做基本資訊顯示——比較表是階段 8 的事。

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
  regions: { name: string } | null
  processing_methods: { name: string } | null
  varieties: { name: string } | null
}

const route = useRoute()
const supabase = useSupabaseClient()
const { signedUrl, remove } = useBeanPhotos()

const bean = ref<BeanDetail | null>(null)
const photoUrl = ref<string | null>(null)
const brewCount = ref(0)
const loading = ref(true)
const notFound = ref(false)
const confirmOpen = ref(false)
const deleting = ref(false)
const actionError = ref('')

const id = computed(() => String(route.params.id))

async function load() {
  const { data } = await supabase
    .from('beans')
    .select(`
      id, name, photo_path, roaster, roast_date, roast_level, official_notes, is_finished,
      countries ( name_zh ), regions ( name ),
      processing_methods ( name ), varieties ( name )
    `)
    .eq('id', id.value)
    .maybeSingle()

  if (!data) {
    notFound.value = true
    loading.value = false
    return
  }
  bean.value = data as unknown as BeanDetail
  photoUrl.value = await signedUrl(bean.value.photo_path)

  const { count } = await supabase
    .from('brews')
    .select('id', { count: 'exact', head: true })
    .eq('bean_id', id.value)
  brewCount.value = count ?? 0
  loading.value = false
}

onMounted(load)

const days = computed(() => restDays(bean.value?.roast_date))

const rows = computed(() => {
  const b = bean.value
  if (!b) return []
  return [
    { label: '烘焙商', value: b.roaster },
    { label: '烘焙日期', value: b.roast_date },
    { label: '養豆天數', value: days.value === null ? null : `${days.value} 天` },
    { label: '烘焙度', value: b.roast_level ? roastLabels[b.roast_level] : null },
    { label: '產國', value: b.countries?.name_zh ?? null },
    { label: '產區', value: b.regions?.name ?? null },
    { label: '處理法', value: b.processing_methods?.name ?? null },
    { label: '品種', value: b.varieties?.name ?? null },
  ].filter(row => row.value)
})

async function toggleFinished() {
  if (!bean.value) return
  const next = !bean.value.is_finished
  const { error } = await supabase.from('beans').update({ is_finished: next } as never).eq('id', id.value)
  if (error) {
    actionError.value = `沒有改成功：${error.message}`
    return
  }
  bean.value.is_finished = next
}

async function destroy() {
  if (!bean.value) return
  deleting.value = true
  const path = bean.value.photo_path
  const { error } = await supabase.from('beans').delete().eq('id', id.value)
  if (error) {
    deleting.value = false
    confirmOpen.value = false
    actionError.value = `沒有刪成功：${error.message}`
    return
  }
  if (path) await remove(path)
  await navigateTo('/beans')
}
</script>

<template>
  <main class="mx-auto px-5 py-10" :style="{ maxWidth: 'var(--content-max)' }">
    <p v-if="loading" class="text-muted">讀取中</p>

    <template v-else-if="notFound">
      <h1 class="font-serif text-xl font-bold">找不到這支豆子</h1>
      <p class="mt-2 text-muted">可能已經被刪掉了。</p>
      <NuxtLink to="/beans" class="mt-6 inline-block underline" :style="{ color: 'var(--accent)' }">
        回到豆子列表
      </NuxtLink>
    </template>

    <template v-else-if="bean">
      <div class="flex items-baseline justify-between">
        <NuxtLink to="/beans" class="text-sm underline" :style="{ color: 'var(--accent)' }">豆子</NuxtLink>
        <NuxtLink :to="`/beans/${bean.id}/edit`" class="text-sm underline" :style="{ color: 'var(--accent)' }">
          編輯
        </NuxtLink>
      </div>

      <img
        v-if="photoUrl"
        :src="photoUrl"
        :alt="bean.name"
        class="mt-4 block max-h-80 w-full rounded-md object-cover"
      >
      <div
        v-else
        class="mt-4 flex h-32 items-center rounded-md px-4"
        :style="roastFill(bean.roast_level)"
      >
        <span class="font-serif text-lg font-bold">{{ bean.name }}</span>
      </div>

      <h1 class="mt-5 font-serif text-2xl font-bold">{{ bean.name }}</h1>

      <dl v-if="rows.length" class="mt-6">
        <div
          v-for="row in rows"
          :key="row.label"
          class="flex justify-between border-t py-3"
          :style="{ borderColor: 'var(--border)' }"
        >
          <dt class="text-sm text-muted">{{ row.label }}</dt>
          <dd class="tabular-nums">{{ row.value }}</dd>
        </div>
        <div class="flex justify-between border-t py-3" :style="{ borderColor: 'var(--border)' }">
          <dt class="text-sm text-muted">沖煮次數</dt>
          <dd class="tabular-nums">{{ brewCount }}</dd>
        </div>
      </dl>
      <p v-else class="mt-6 text-muted">除了豆名還沒填其他東西，想到再補就好。</p>

      <section v-if="bean.official_notes" class="mt-6">
        <h2 class="text-sm text-muted">袋上的風味描述</h2>
        <p class="mt-1 whitespace-pre-line">{{ bean.official_notes }}</p>
      </section>

      <button
        type="button"
        class="mt-8 w-full rounded-sm border px-4 py-3"
        :style="{ borderColor: 'var(--border)', background: 'var(--surface)', minHeight: '44px' }"
        @click="toggleFinished"
      >
        {{ bean.is_finished ? '標成還在喝' : '標成已喝完' }}
      </button>

      <p v-if="actionError" class="mt-4 text-sm" :style="{ color: 'var(--danger)' }">{{ actionError }}</p>

      <button
        type="button"
        class="mt-4 w-full rounded-sm px-4 py-3"
        :style="{ color: 'var(--danger)', minHeight: '44px' }"
        @click="confirmOpen = true"
      >
        刪除這支豆子
      </button>

      <ConfirmDialog
        :open="confirmOpen"
        title="刪除這支豆子？"
        :body="brewCount > 0
          ? `連同這支豆子的 ${brewCount} 筆沖煮紀錄一起刪掉，沒辦法復原。`
          : '刪掉之後沒辦法復原。'"
        confirm-label="刪除這支豆子"
        :busy="deleting"
        @cancel="confirmOpen = false"
        @confirm="destroy"
      />
    </template>
  </main>
</template>
