<script setup lang="ts">
// 豆子列表。未喝完的排前面，其餘依建立時間倒序。

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
const { signedUrls } = useBeanPhotos()

const beans = ref<BeanRow[]>([])
const photoUrls = ref<Map<string, string>>(new Map())
const loading = ref(true)

async function load() {
  const { data } = await supabase
    .from('beans')
    .select('id, name, photo_path, roaster, roast_date, roast_level, is_finished')
    .order('is_finished')
    .order('created_at', { ascending: false })
  beans.value = (data ?? []) as unknown as BeanRow[]
  photoUrls.value = await signedUrls(beans.value.map(bean => bean.photo_path))
  loading.value = false
}

onMounted(load)
</script>

<template>
  <main class="mx-auto px-5 py-10" :style="{ maxWidth: 'var(--content-max)' }">
    <div class="flex items-baseline justify-between">
      <h1 class="font-serif text-xl font-bold">豆子</h1>
      <NuxtLink to="/" class="text-sm underline" :style="{ color: 'var(--accent)' }">回首頁</NuxtLink>
    </div>

    <p v-if="loading" class="mt-8 text-muted">讀取中</p>

    <!-- 空狀態是邀請行動的時機，不是說明現況的時機（《02》§9） -->
    <section v-else-if="!beans.length" class="mt-10">
      <h2 class="font-serif text-lg font-bold">先建一支豆子</h2>
      <p class="mt-2 text-muted">
        拍一張豆袋、打個豆名就能存。其他欄位想填再填，之後隨時可以補。
      </p>
      <NuxtLink
        to="/beans/new"
        class="mt-6 block w-full rounded-sm px-4 py-3 text-center font-medium"
        :style="{ background: 'var(--accent)', color: '#FFFFFF', minHeight: '44px' }"
      >
        新增豆子
      </NuxtLink>
    </section>

    <template v-else>
      <NuxtLink
        to="/beans/new"
        class="mt-6 block w-full rounded-sm px-4 py-3 text-center font-medium"
        :style="{ background: 'var(--accent)', color: '#FFFFFF', minHeight: '44px' }"
      >
        新增豆子
      </NuxtLink>

      <ul class="mt-6 space-y-4">
        <li v-for="bean in beans" :key="bean.id">
          <NuxtLink :to="`/beans/${bean.id}`" class="block">
            <BeanCard
              :name="bean.name"
              :photo-url="bean.photo_path ? (photoUrls.get(bean.photo_path) ?? null) : null"
              :roast-level="bean.roast_level"
              :roaster="bean.roaster"
              :roast-date="bean.roast_date"
              :is-finished="bean.is_finished"
            />
          </NuxtLink>
        </li>
      </ul>
    </template>
  </main>
</template>
