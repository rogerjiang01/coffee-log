<script setup lang="ts">
// 紀錄詳情頁的分享：標題列最右端的圖示，按下去一律出現對話框（《02》§7.1、《03》§4.13）。
//
// **傳送模型**：每次分享都產生一條新連結，「分享心得筆記」跟著那一次傳送固定，
// 之後不能改。所以這裡不查、也不記任何既有的分享——對話框永遠只有一種樣子。
//
// 對話框沿用 ConfirmDialog 那一套：原生 <dialog> 的 showModal()、置中卡片、遮罩、
// 佔一筆 history、返回鍵關閉，結構是「標題 → 主體 → 動作」。
// 按下按鈕之後對話框立刻關閉，後續的回饋都顯示在頁面層級。

const props = defineProps<{
  brewId: string
  beanName: string
  brewedAt: string
  /** 這筆紀錄有心得筆記。沒有時「選項」整組不出現 */
  hasNotes: boolean
  /** 豆袋照片的 Storage 路徑。沒有照片時對話框不放縮圖、不留空框 */
  photoPath: string | null
}>()

const supabase = useSupabaseClient()
const { signedUrl } = useBeanPhotos()

const COPIED_MS = 2000

const open = ref(false)
const dialog = ref<HTMLDialogElement | null>(null)
const title = ref<HTMLElement | null>(null)
const trigger = ref<HTMLElement | null>(null)
// 頁面層級的提示送到哪裡：與其他浮層同一套規則（紀錄詳情頁上它會是 body）
const portalTarget = usePortalTarget(trigger)

// 日期格式與首頁時間軸相同（BrewTimelineItem）
const brewDate = computed(() => {
  const d = new Date(props.brewedAt)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}`
})

// 豆袋照片：簽名網址走 useBeanPhotos 的快取——從首頁或豆子列表進來時已經有了，
// 不另外發請求；快取沒有才換一次。載不到或載入失敗就當作沒有照片
const photoUrl = ref<string | null>(null)
onMounted(async () => {
  if (props.photoPath) photoUrl.value = await signedUrl(props.photoPath).catch(() => null)
})

/**
 * 瀏覽器能不能叫出系統分享選單。依能力判斷，不依桌機或手機判斷。
 * 在 onMounted 才讀：伺服器端沒有 navigator
 */
const canShare = ref(false)
onMounted(() => {
  canShare.value = typeof navigator.share === 'function'
})

// ── 「分享心得筆記」 ──────────────────────────────────────────
// 每次打開都預設不勾，不記住上次的選擇：不小心沒分享到心得只是少了一點資訊，
// 不小心公開了私人心得就收不回來，兩種錯的代價不對等
const includeNotes = ref(false)

// ── 頁面層級的回饋 ───────────────────────────────────────────
const copied = ref(false)
/** 系統分享與複製都失敗：把連結本身顯示出來讓使用者自己複製 */
const manualLink = ref<string | null>(null)
/** 建立失敗的那一次傳送。「再試一次」用同一個代碼、同一個設定重送 */
const failedSend = ref<{ code: string, notes: boolean } | null>(null)
const retrying = ref(false)

let copiedTimer: ReturnType<typeof setTimeout> | null = null
onBeforeUnmount(() => {
  if (copiedTimer) clearTimeout(copiedTimer)
})

// ── 對話框開關 ───────────────────────────────────────────────
function openDialog() {
  includeNotes.value = false
  open.value = true
}

function close() {
  open.value = false
}

useOverlayHistory(() => open.value, close)

watch(open, (value) => {
  if (!dialog.value) return
  if (value && !dialog.value.open) {
    dialog.value.showModal()
    // showModal() 會把焦點放在第一個可以聚焦的東西上（勾選框），觸控使用者因此
    // 一打開就看到一圈焦點框。改放在標題：它不是互動元素，不畫焦點框，
    // 螢幕閱讀器從標題開始讀，鍵盤使用者下一個 Tab 就到勾選框
    title.value?.focus()
  }
  if (!value && dialog.value.open) dialog.value.close()
})

// dialog 本身撐滿視窗、卡片在內層（main.css）：點到 dialog 自己就是點到遮罩
function onDialogClick(event: MouseEvent) {
  if (event.target === dialog.value) close()
}

// ── 傳送 ─────────────────────────────────────────────────────
/**
 * 寫進剪貼簿。先試 Clipboard API；不支援或被拒（Android 的內建瀏覽器，例如 LINE）
 * 退回 execCommand。暫時的 textarea 在對話框還開著時要放在對話框裡：
 * modal 開著時，dialog 以外的東西都是 inert，放在 body 上選不到文字。
 */
function copyText(text: string): Promise<void> {
  const legacy = () => {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    ;(dialog.value?.open ? dialog.value : document.body).appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    area.remove()
    return ok ? Promise.resolve() : Promise.reject(new Error('copy failed'))
  }
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text).catch(legacy)
  return legacy()
}

/**
 * 「分享」與「複製連結」共用。**這裡不能有任何 await。** navigator.share() 與
 * 寫進剪貼簿都必須在點擊的同一個事件裡同步呼叫，否則 iOS Safari 會拒絕，
 * 使用者按了沒反應（《02》§7.1）。所以代碼在這裡當場產生：
 * 交出連結 → 關閉對話框 → 發出建立請求，後者不等。
 */
function send(via: 'share' | 'copy') {
  copied.value = false
  manualLink.value = null
  const code = generateShareCode()
  const notes = includeNotes.value
  const url = shareUrl(window.location.origin, code)

  const { delivery } = startShare({
    url,
    deliver: link => deliverShareLink(link, {
      share: via === 'share' && typeof navigator.share === 'function' ? data => navigator.share(data) : undefined,
      copy: copyText,
    }),
    afterDeliver: close,
    create: () => createShare(code, notes),
  })

  // 系統分享成功：選單本身就是回饋，不另外提示
  delivery.then((result) => {
    if (result === 'copied') {
      copied.value = true
      if (copiedTimer) clearTimeout(copiedTimer)
      copiedTimer = setTimeout(() => (copied.value = false), COPIED_MS)
    }
    if (result === 'failed') manualLink.value = url
  })
}

function onShare() {
  send('share')
}

function onCopy() {
  send('copy')
}

async function createShare(code: string, notes: boolean) {
  const { data, error } = await supabase.rpc('create_brew_share' as never, {
    p_brew_id: props.brewId,
    p_code: code,
    p_include_notes: notes,
  } as never)
  if (creationSucceeded(code, { code: data as string | null, error })) {
    if (failedSend.value?.code === code) failedSend.value = null
    return
  }
  // 最新一次失敗的蓋掉前一次：提示只有一則
  failedSend.value = { code, notes }
}

/** 「再試一次」：同一個代碼、同一個設定重送建立請求，不再叫一次系統選單——連結已經送出去了 */
async function retry() {
  const failed = failedSend.value
  if (!failed || retrying.value) return
  retrying.value = true
  await createShare(failed.code, failed.notes)
  retrying.value = false
}
</script>

<template>
  <!-- 44px 觸控目標；負邊距讓圖示本身對齊頁面內距，與 ‹ 同一套做法。
       標題列對齊基線，這個按鈕自己垂直置中（《03》§4.13.1）：
       上下各 -2px 讓它的外框等於豆名一行的行高（2rem × 1.3），置中才對得準 -->
  <button
    ref="trigger"
    type="button"
    aria-label="分享"
    class="-mr-3 -my-0.5 ml-auto flex shrink-0 items-center justify-center self-center"
    :style="{ minWidth: 'var(--touch-min)', minHeight: 'var(--touch-min)', color: 'var(--text)' }"
    @click="openDialog"
  >
    <ShareIcon />
  </button>

  <!-- dialog 本身是滿版的置中容器（樣式在 main.css），卡片是內層這一個 -->
  <dialog
    ref="dialog"
    class="backdrop:bg-[var(--overlay-scrim)]"
    aria-labelledby="brew-share-title"
    @cancel.prevent="close"
    @click="onDialogClick"
  >
    <div
      class="w-full max-w-sm rounded-lg p-6"
      :style="{ background: 'var(--surface)', color: 'var(--text)', boxShadow: 'var(--overlay-shadow)' }"
    >
      <!-- 開啟時焦點在這裡。不是互動元素，不畫焦點框 -->
      <h2 id="brew-share-title" ref="title" tabindex="-1" class="text-xl font-normal text-balance outline-none">
        分享紀錄
      </h2>

      <!-- 分享的對象：讓使用者確認要送出去的是哪一筆。
           沒有照片就不放縮圖、不留空框，文字佔滿整個寬度 -->
      <div class="mt-4 flex items-start gap-3">
        <div class="min-w-0 flex-1">
          <p class="break-words text-pretty">{{ beanName }}</p>
          <p class="text-sm tabular-nums text-muted">沖煮日期：{{ brewDate }}</p>
        </div>
        <!-- 縮圖規格同豆子列表（《03》§4.5.2）。豆名就在旁邊，替代文字留空不重複唸 -->
        <img
          v-if="photoUrl"
          :src="photoUrl"
          alt=""
          class="size-24 shrink-0 rounded-md object-cover"
          @error="photoUrl = null"
        >
      </div>

      <!-- 選項：這筆沒有心得時，小標和勾選框都不出現 -->
      <fieldset v-if="hasNotes" class="mt-5">
        <legend class="text-sm text-muted">選項</legend>
        <!-- 整列是 label：點文字也能切換，觸控範圍 44px 高 -->
        <label class="mt-1 flex cursor-pointer items-center gap-3" :style="{ minHeight: 'var(--touch-min)' }">
          <input v-model="includeNotes" type="checkbox" class="peer sr-only">
          <!-- 未勾的方框是可以點的目標，用 --control-empty（《03》§2.2），不用 --border -->
          <span
            aria-hidden="true"
            class="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border-[1.5px] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2"
            :style="{
              borderColor: includeNotes ? 'var(--accent)' : 'var(--control-empty)',
              background: includeNotes ? 'var(--accent)' : 'transparent',
              outlineColor: 'var(--accent)',
            }"
          >
            <svg
              v-if="includeNotes"
              width="16" height="16" viewBox="0 0 24 24"
              fill="none" stroke="var(--on-accent)" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </span>
          分享心得筆記
        </label>
      </fieldset>

      <!-- 排列與刪除確認對話框相同：次要在左、主要在右。
           瀏覽器不支援系統分享時只有「複製連結」一顆，而且是主要按鈕 -->
      <div class="mt-6 flex gap-3">
        <template v-if="canShare">
          <button
            type="button"
            class="flex-1 rounded-sm border px-4 py-3"
            :style="{ borderColor: 'var(--border)', minHeight: 'var(--touch-min)' }"
            @click="onCopy"
          >
            複製連結
          </button>
          <button
            type="button"
            class="flex-1 rounded-sm px-4 py-3 font-medium"
            :style="{ background: 'var(--accent)', color: 'var(--on-accent)', minHeight: 'var(--touch-min)' }"
            @click="onShare"
          >
            分享
          </button>
        </template>
        <button
          v-else
          type="button"
          class="flex-1 rounded-sm px-4 py-3 font-medium"
          :style="{ background: 'var(--accent)', color: 'var(--on-accent)', minHeight: 'var(--touch-min)' }"
          @click="onCopy"
        >
          複製連結
        </button>
      </div>
    </div>
  </dialog>

  <!-- 頁面層級的回饋：對話框已經關了，這些要在頁面上看得到。
       疊在分頁列與 iPhone 底部安全區域之上（《03》§4.13.3） -->
  <Teleport :to="portalTarget">
    <div
      class="pointer-events-none fixed inset-x-0 z-40 mx-auto flex flex-col gap-2 px-5"
      :style="{ bottom: 'calc(52px + env(safe-area-inset-bottom) + 12px)', maxWidth: 'var(--content-max)' }"
    >
      <!-- 不自動消失：連結已經傳出去了，失敗一定要被看到 -->
      <div
        v-if="failedSend"
        role="alert"
        class="pointer-events-auto rounded-md p-4 text-sm"
        :style="{ background: 'var(--surface)', boxShadow: 'var(--overlay-shadow)' }"
      >
        <p :style="{ color: 'var(--danger)' }">分享建立失敗，連結目前無法開啟</p>
        <div class="mt-3 flex gap-3">
          <button
            type="button"
            class="flex-1 rounded-sm border px-4 py-2"
            :style="{ borderColor: 'var(--border)', minHeight: 'var(--touch-min)' }"
            @click="failedSend = null"
          >
            關閉
          </button>
          <button
            type="button"
            :disabled="retrying"
            class="flex-1 rounded-sm border px-4 py-2 disabled:opacity-60"
            :style="{ borderColor: 'var(--border-strong)', minHeight: 'var(--touch-min)' }"
            @click="retry"
          >
            再試一次
          </button>
        </div>
      </div>

      <div
        v-if="manualLink"
        role="alert"
        class="pointer-events-auto rounded-md p-4 text-sm"
        :style="{ background: 'var(--surface)', boxShadow: 'var(--overlay-shadow)' }"
      >
        <p>無法複製，請長按連結手動複製</p>
        <!-- 一般文字，不做成連結：點下去會離開這一頁。select-all 讓長按一次選到整串 -->
        <p class="mt-2 select-all break-all tabular-nums" :style="{ color: 'var(--text)' }">{{ manualLink }}</p>
        <button
          type="button"
          class="mt-3 w-full rounded-sm border px-4 py-2"
          :style="{ borderColor: 'var(--border)', minHeight: 'var(--touch-min)' }"
          @click="manualLink = null"
        >
          關閉
        </button>
      </div>

      <!-- 約兩秒後自己收起來。不是錯誤，不用 role="alert" -->
      <p
        v-if="copied"
        aria-hidden="true"
        class="self-center rounded-md px-4 py-2 text-sm"
        :style="{ background: 'var(--surface)', boxShadow: 'var(--overlay-shadow)' }"
      >
        已複製連結
      </p>
    </div>
    <!-- 讀給螢幕閱讀器的那一份。live region 要一直在，內容變了才會被念出來 -->
    <p aria-live="polite" class="sr-only">{{ copied ? '已複製連結' : '' }}</p>
  </Teleport>
</template>
