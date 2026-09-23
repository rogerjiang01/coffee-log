<script setup lang="ts">
// 分享頁（《02》§7.2、《03》§4.13.4）。任何拿到連結的人都能看，不需要登入。
//
// 讀取只有 get_shared_brew 一個入口：它只吃網址上的代碼、只回傳分享頁實際顯示的欄位
// （《01》§14.2）。這一頁只管讀取、讀取中與失效；內容在 SharedBrewView，
// 失效畫面在 SharedBrewGone。沒有 ‹、沒有任何寫入的入口。
// 分頁列由登入狀態決定（app.vue、utils/navigation.ts）。

definePageMeta({ screen: 'share' })

// 連結是猜不到的亂數，但不需要讓搜尋引擎替它建索引
useHead({ meta: [{ name: 'robots', content: 'noindex, nofollow' }] })

const route = useRoute()
const supabase = useSupabaseClient()
const userId = useCurrentUserId()

const code = computed(() => String(route.params.code))

const brew = ref<SharedBrew | null>(null)
const loading = ref(true)
const gone = ref(false)
const loadError = ref('')

// **一次開啟只呼叫一次。** 開啟事件由 get_shared_brew 自己寫（《01》§14.2），
// 多呼叫一次就多記一次開啟
async function load() {
  loading.value = true
  loadError.value = ''
  const { data, error } = await supabase.rpc('get_shared_brew' as never, { share_code: code.value } as never)
  loading.value = false
  if (error) {
    loadError.value = `讀不到資料：${errorText(error)}`
    return
  }
  if (!data) {
    gone.value = true
    return
  }
  brew.value = data as SharedBrew
}

onMounted(load)
</script>

<template>
  <!-- 失效畫面：紀錄已刪除、代碼不存在，同一個畫面、不分原因 -->
  <SharedBrewGone v-if="gone" :signed-in="userId !== null" />

  <main v-else class="mx-auto px-5 pt-6 pb-16" :style="{ maxWidth: 'var(--content-max)' }">
    <!-- 讓朋友知道自己在看什麼。不是連結：未登入的人點下去只會被帶到登入頁 -->
    <p class="text-sm text-muted">手沖咖啡紀錄</p>

    <p v-if="loadError" role="alert" class="mt-4 text-sm" :style="{ color: 'var(--danger)' }">{{ loadError }}</p>
    <button
      v-if="loadError && !loading"
      type="button"
      class="mt-4 w-full rounded-sm border px-4 py-3"
      :style="{ borderColor: 'var(--border-strong)', minHeight: 'var(--touch-min)' }"
      @click="load"
    >
      重試
    </button>

    <div v-if="loading" aria-busy="true" aria-label="讀取中">
      <SkeletonBlock width="60%" height="1.75rem" class="mt-6" />
      <SkeletonBlock width="9rem" height="0.875rem" class="mt-2" />
      <div class="mt-8 space-y-3">
        <SkeletonBlock v-for="n in 6" :key="n" height="1.25rem" />
      </div>
    </div>

    <SharedBrewView v-else-if="brew" :brew="brew" />
  </main>
</template>
