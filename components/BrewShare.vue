<script setup lang="ts">
// 紀錄詳情頁的分享：標題列最右端的圖示，按下去一律出現對話框（《02》§7.1、《03》§4.13）。
//
// 對話框沿用 ConfirmDialog 那一套：原生 <dialog> 的 showModal()、置中卡片、遮罩、
// 佔一筆 history、返回鍵關閉，結構同樣是「標題 → 主體 → 動作」。
// 按下「分享」之後對話框立刻關閉，後續的回饋（已複製、建立失敗、無法複製）
// 都顯示在頁面層級，不留在對話框裡。

const props = defineProps<{
  brewId: string
  beanName: string
  brewedAt: string
  /** 這筆紀錄有心得筆記。沒有時不出現「包含心得筆記」 */
  hasNotes: boolean
}>()

const supabase = useSupabaseClient()

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

// ── 分享的狀態 ───────────────────────────────────────────────
/** 生效中的連結。null ＝ 還沒分享過 */
const shareCode = ref<string | null>(null)
/**
 * 已經送出去、但還沒建立成功的代碼。「再試一次」與再按一次「分享」都沿用它——
 * 重新產生的話，已經傳出去的那個連結會永遠是死的（《02》§7.1）
 */
const pendingCode = ref<string | null>(null)
const creating = ref(false)
/** failed：可以再試一次；mismatch：別的裝置先分享過，送出去的連結不會動 */
const createError = ref<'failed' | 'mismatch' | null>(null)

// ── 「包含心得筆記」 ──────────────────────────────────────────
const includeNotes = ref(false)
/** 資料庫裡目前的值（已經分享過時） */
const savedNotes = ref(false)
const savingNotes = ref(false)
const notesError = ref(false)

// ── 頁面層級的回饋 ───────────────────────────────────────────
const copied = ref(false)
/** 系統分享與複製都失敗：把連結本身顯示出來讓使用者自己複製 */
const manualLink = ref<string | null>(null)

let copiedTimer: ReturnType<typeof setTimeout> | null = null
onBeforeUnmount(() => {
  if (copiedTimer) clearTimeout(copiedTimer)
})

// 頁面一載入就先讀：按「分享」是同步的，那時不能再等一趟查詢。
// 讀不到就當作沒分享過——按下去時資料庫會回傳既有的代碼，走 mismatch 那條路
async function loadShare() {
  const { data } = await supabase
    .from('brew_shares')
    .select('code, include_notes')
    .eq('brew_id', props.brewId)
    .is('revoked_at', null)
    .maybeSingle()
  const row = data as { code: string, include_notes: boolean } | null
  if (!row) return
  shareCode.value = row.code
  savedNotes.value = row.include_notes
}
onMounted(loadShare)

// ── 對話框開關 ───────────────────────────────────────────────
function openDialog() {
  // 還沒分享過時預設關閉，每次打開都重來：「包含心得筆記」的兩種錯代價不對等
  includeNotes.value = shareCode.value ? savedNotes.value : false
  notesError.value = false
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
    // showModal() 會把焦點放在第一個可以聚焦的東西上（開關），觸控使用者因此
    // 一打開就看到一圈焦點框。改放在標題：它不是互動元素，不畫焦點框，
    // 螢幕閱讀器從標題開始讀，鍵盤使用者下一個 Tab 就到開關
    title.value?.focus()
  }
  if (!value && dialog.value.open) dialog.value.close()
})

// dialog 本身撐滿視窗、卡片在內層（main.css）：點到 dialog 自己就是點到遮罩
function onDialogClick(event: MouseEvent) {
  if (event.target === dialog.value) close()
}

// ── 分享 ─────────────────────────────────────────────────────
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
 * **這個 handler 裡不能有任何 await。** navigator.share() 必須在點擊的同一個事件裡
 * 同步呼叫，否則 iOS Safari 會拒絕，使用者按了沒反應（《02》§7.1）。
 * 所以代碼在這裡當場產生，建立請求發出去之後不等它。
 * 交出連結之後立刻關掉對話框：系統分享選單本身就是回饋。
 */
function onShare() {
  createError.value = null
  copied.value = false
  manualLink.value = null
  const code = shareCode.value ?? pendingCode.value ?? generateShareCode()
  const alreadyCreated = shareCode.value !== null || creating.value
  if (!alreadyCreated) pendingCode.value = code
  const url = shareUrl(window.location.origin, code)

  const { delivery } = startShare({
    url,
    alreadyCreated,
    deliver: link => deliverShareLink(link, {
      share: typeof navigator.share === 'function' ? data => navigator.share(data) : undefined,
      copy: copyText,
    }),
    create: () => createShare(code, includeNotes.value),
  })
  close()

  delivery.then((result) => {
    if (result === 'copied') {
      copied.value = true
      if (copiedTimer) clearTimeout(copiedTimer)
      copiedTimer = setTimeout(() => (copied.value = false), COPIED_MS)
    }
    if (result === 'failed') manualLink.value = url
  })
}

async function createShare(code: string, notes: boolean) {
  creating.value = true
  const { data, error } = await supabase.rpc('create_brew_share' as never, {
    p_brew_id: props.brewId,
    p_code: code,
    p_include_notes: notes,
  } as never)
  creating.value = false

  const outcome = creationOutcome(code, { code: data as string | null, error })
  if (outcome.kind === 'failed') {
    createError.value = 'failed'
    return
  }
  createError.value = null
  pendingCode.value = null
  shareCode.value = outcome.code
  if (outcome.kind === 'mismatch') {
    // 別的裝置先分享過：送出去的連結不會動。改用既有的連結與它的設定，
    // 再打開對話框按一次「分享」送出的就是會動的連結
    createError.value = 'mismatch'
    await loadShare()
    return
  }
  savedNotes.value = notes
}

/** 「再試一次」：同一個代碼重送建立請求，不再叫一次系統選單——連結已經送出去了 */
function retry() {
  if (!pendingCode.value || creating.value) return
  createError.value = null
  void createShare(pendingCode.value, includeNotes.value)
}

// ── 「包含心得筆記」 ──────────────────────────────────────────
// 還沒分享過：只是對話框上的狀態，按「分享」時跟著建立請求送出。
// 已經分享過：一切換就立即儲存——使用者可能只是打開對話框把心得關掉就走了，
// 那時設定必須已經存好。成功不顯示任何文字，開關的狀態本身就是回饋；
// 失敗時改回原狀，不能讓畫面顯示開著、資料庫沒開。
async function onNotesChange(value: boolean) {
  includeNotes.value = value
  notesError.value = false
  if (!shareCode.value) return

  savingNotes.value = true
  const { error } = await supabase.rpc('set_brew_share_notes' as never, {
    p_brew_id: props.brewId,
    p_include: value,
  } as never)
  savingNotes.value = false

  if (error) {
    includeNotes.value = savedNotes.value
    notesError.value = true
    return
  }
  savedNotes.value = value
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
      <h2 id="brew-share-title" ref="title" tabindex="-1" class="font-serif text-lg font-bold outline-none">
        分享紀錄
      </h2>

      <!-- 分享的對象：讓使用者確認要送出去的是哪一筆 -->
      <p class="mt-3 font-medium">{{ beanName }}</p>
      <p class="text-sm tabular-nums text-muted">{{ brewDate }}</p>

      <div v-if="hasNotes" class="mt-4">
        <ToggleSwitch
          :model-value="includeNotes"
          label="包含心得筆記"
          :busy="savingNotes || creating"
          @update:model-value="onNotesChange"
        />
        <p v-if="notesError" role="alert" class="mt-2 text-sm" :style="{ color: 'var(--danger)' }">
          修改未成功，請再試一次
        </p>
      </div>

      <!-- 排列與刪除確認對話框相同：次要在左、主要在右 -->
      <div class="mt-6 flex gap-3">
        <button
          type="button"
          class="flex-1 rounded-sm border px-4 py-3"
          :style="{ borderColor: 'var(--border)', minHeight: 'var(--touch-min)' }"
          @click="close"
        >
          <!-- 已分享過時設定是即時儲存的，按下去不是在放棄什麼 -->
          {{ shareCode ? '完成' : '取消' }}
        </button>
        <button
          type="button"
          class="flex-1 rounded-sm px-4 py-3 font-medium"
          :style="{ background: 'var(--accent)', color: 'var(--on-accent)', minHeight: 'var(--touch-min)' }"
          @click="onShare"
        >
          分享
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
      <div
        v-if="createError"
        role="alert"
        class="pointer-events-auto rounded-md p-4 text-sm"
        :style="{ background: 'var(--surface)', boxShadow: 'var(--overlay-shadow)' }"
      >
        <p :style="{ color: 'var(--danger)' }">分享沒有建立成功，剛才那個連結還不能用</p>
        <div class="mt-3 flex gap-3">
          <button
            type="button"
            class="flex-1 rounded-sm border px-4 py-2"
            :style="{ borderColor: 'var(--border)', minHeight: 'var(--touch-min)' }"
            @click="createError = null"
          >
            關閉
          </button>
          <button
            v-if="createError === 'failed'"
            type="button"
            :disabled="creating"
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
