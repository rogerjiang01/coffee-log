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
const loadError = ref('')

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const { data, error } = await supabase
      .from('beans')
      .select('id, name, photo_path, roaster, roast_date, roast_level, is_finished')
      .order('is_finished')
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)

    beans.value = (data ?? []) as unknown as BeanRow[]
    // 簽名網址失敗不該讓整頁停在讀取中，照片缺了還是要看得到清單
    try {
      photoUrls.value = await signedUrls(beans.value.map(bean => bean.photo_path))
    }
    catch {
      photoUrls.value = new Map()
    }
  }
  catch (e) {
    loadError.value = e instanceof Error ? `讀不到豆子：${e.message}` : '讀不到豆子'
  }
  finally {
    // 放在 finally，任何失敗都不會讓頁面停在「讀取中」而看不到新增入口
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <main class="mx-auto px-5 py-10" :style="{ maxWidth: 'var(--content-max)' }">
    <div class="flex items-baseline justify-between">
      <h1 class="font-serif text-xl font-bold">豆子</h1>
      <NuxtLink to="/" class="text-sm underline" :style="{ color: 'var(--accent)' }">回首頁</NuxtLink>
    </div>

    <!-- 新增入口放在所有分支之外，讀取中或讀取失敗時一樣看得到 -->
    <NuxtLink
      to="/beans/new"
      class="mt-6 block w-full rounded-sm px-4 py-3 text-center font-medium"
      :style="{ background: 'var(--accent)', color: '#FFFFFF', minHeight: '44px' }"
    >
      新增
    </NuxtLink>

    <p v-if="loadError" role="alert" class="mt-4 text-sm" :style="{ color: 'var(--danger)' }">
      {{ loadError }}
    </p>

    <p v-if="loading" class="mt-6 text-muted">讀取中</p>

    <!-- 空狀態是邀請行動的時機，不是說明現況的時機（《02》§9）。
         新增入口就在上方，這裡只說第一步怎麼做。 -->
    <p v-else-if="!beans.length && !loadError" class="mt-6 text-muted">
      拍一張豆袋、打個豆名就能存。
    </p>

    <ul v-else class="mt-6 space-y-4">
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
  </main>
</template>
