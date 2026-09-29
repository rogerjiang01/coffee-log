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
const photo = ref<{ thumb: string | null, full: string | null } | null>(null)
const photoFailed = ref(false)
const loading = ref(true)
const gone = ref(false)
const loadError = ref('')

/**
 * 豆袋照片的網址（《01》§14.5）。由伺服器端發，每次開啟重新要一次。
 * **頁面不等它**：拿到紀錄就顯示，縮圖的位置已經留好（has_photo），網址到了才填進去。
 * **也不等紀錄**：與 get_shared_brew 同時發，省掉一次手機到資料庫的來回。
 * 沒有照片的分享也會多這一次請求，伺服器回兩個 null，成本很低。
 * 要不到就把位置收掉：照片是輔助，不能讓整頁因為它出錯
 */
async function loadPhoto() {
  photo.value = null
  photoFailed.value = false
  try {
    const urls = await $fetch<{ thumb: string | null, full: string | null }>(sharedPhotoEndpoint(code.value))
    if (typeof urls?.thumb !== 'string') photoFailed.value = true
    else photo.value = { thumb: urls.thumb, full: typeof urls.full === 'string' ? urls.full : null }
  }
  catch {
    photoFailed.value = true
  }
}

// **一次開啟只呼叫一次。** 開啟事件由 get_shared_brew 自己寫（《01》§14.2），
// 多呼叫一次就多記一次開啟
async function load() {
  loading.value = true
  loadError.value = ''
  // 不 await：縮圖的位置由 has_photo 決定，網址先到、後到都一樣
  void loadPhoto()
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

    <SharedBrewView v-else-if="brew" :brew="brew" :photo="photo" :photo-failed="photoFailed" />
  </main>
</template>
