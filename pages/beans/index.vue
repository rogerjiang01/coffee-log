<script setup lang="ts">
// 豆子列表。未喝完的排前面，同組內依建立時間倒序。

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
    // 排序全部寫死：未喝完在前，再依建立時間倒序，最後用 id 當決勝鍵。
    // 少了決勝鍵時，created_at 相同的兩筆每次載入的順序可能不同。
    const { data, error } = await supabase
      .from('beans')
      .select('id, name, photo_path, roaster, roast_date, roast_level, is_finished')
      .order('is_finished', { ascending: true })
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
    if (error) throw new Error(error.message)

    beans.value = (data ?? []) as unknown as BeanRow[]

    // 清單可以出來了。簽名網址得等 photo_path，避不掉第二趟，
    // 但豆名與烘焙資訊不必陪著等——照片欄先留白，回來再填。
    loading.value = false

    // 照片取不到不該拖垮清單
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
    loading.value = false
  }
}

// 已喝完用分組表達，不用透明度。
// 透明度讓文字讀不了，無照片時也看不出差別，而且語意錯了——
// 透明度表達「不重要」，但已喝完的豆子使用者可能正要回頭找它。
const active = computed(() => beans.value.filter(bean => !bean.is_finished))
const finished = computed(() => beans.value.filter(bean => bean.is_finished))

onMounted(load)
</script>

<template>
  <!-- 底部留白避開浮動按鈕，否則最後一筆會被永久遮住 -->
  <main class="mx-auto px-5 pt-10 pb-32" :style="{ maxWidth: 'var(--content-max)' }">
    <div class="flex items-baseline justify-between">
      <h1 class="font-serif text-xl font-bold">豆子</h1>
      <NuxtLink to="/" class="text-sm underline" :style="{ color: 'var(--accent)' }">回首頁</NuxtLink>
    </div>

    <p v-if="loadError" role="alert" class="mt-4 text-sm" :style="{ color: 'var(--danger)' }">
      {{ loadError }}
    </p>

    <ul v-if="loading" aria-busy="true" aria-label="讀取中" class="mt-6 space-y-3">
      <li v-for="n in 4" :key="n">
        <SkeletonBlock height="5.5rem" radius="4px" />
      </li>
    </ul>

    <p v-else-if="!beans.length && !loadError" class="mt-6 text-muted">
      拍一張豆袋、打個豆名就能存。
    </p>

    <template v-else>
      <ul class="mt-6 space-y-3">
        <li v-for="bean in active" :key="bean.id">
          <NuxtLink :to="`/beans/${bean.id}`" class="block">
            <BeanCard
              :name="bean.name"
              :photo-url="bean.photo_path ? (photoUrls.get(bean.photo_path) ?? null) : null"
              :roast-level="bean.roast_level"
              :roaster="bean.roaster"
              :roast-date="bean.roast_date"
            />
          </NuxtLink>
        </li>
      </ul>

      <!-- 沒有已喝完的豆子時，分隔線與標題都不顯示 -->
      <template v-if="finished.length">
        <h2 class="mt-8 border-t pt-4 text-sm text-muted" :style="{ borderColor: 'var(--border)' }">
          已喝完
        </h2>
        <ul class="mt-3 space-y-3">
          <li v-for="bean in finished" :key="bean.id">
            <NuxtLink :to="`/beans/${bean.id}`" class="block">
              <BeanCard
                :name="bean.name"
                :photo-url="bean.photo_path ? (photoUrls.get(bean.photo_path) ?? null) : null"
                :roast-level="bean.roast_level"
                :roaster="bean.roaster"
                :roast-date="bean.roast_date"
              />
            </NuxtLink>
          </li>
        </ul>
      </template>
    </template>

    <!-- 列表頁的新增入口一律是右下角浮動按鈕（§3 導覽）：
         單手持手機時拇指在下方，頂部按鈕構不到。 -->
    <NuxtLink
      to="/beans/new"
      aria-label="新增豆子"
      class="fixed right-5 bottom-20 z-30 flex size-14 items-center justify-center rounded-lg"
      :style="{ background: 'var(--accent)', color: 'var(--on-accent)', boxShadow: 'var(--overlay-shadow)' }"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      </svg>
    </NuxtLink>

    <BottomNav />
  </main>
</template>
