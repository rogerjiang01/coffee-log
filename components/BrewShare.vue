<script setup lang="ts">
// 紀錄詳情頁的分享：標題列最右端的圖示，按下去一律出現面板（《02》§7.1、《03》§4.13）。
//
// 面板沿用 ConfirmDialog 那一套浮層：原生 <dialog> 的 showModal()、遮罩、
// 佔一筆 history、返回鍵關閉。不另做一種新的彈窗。
// 與 ConfirmDialog 不同的是點遮罩也會關：這個面板沒有要回答的問題，
// 也沒有「取消」——加到主畫面之後沒有瀏覽器的返回鍵，遮罩是手機上唯一的出口。

const props = defineProps<{
  brewId: string
  /** 這筆紀錄有心得筆記。沒有時不出現「包含心得筆記」 */
  hasNotes: boolean
}>()

const supabase = useSupabaseClient()

const FLASH_MS = 4000

const open = ref(false)
const dialog = ref<HTMLDialogElement | null>(null)

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
const notesMessage = ref<{ text: string, error: boolean } | null>(null)

const copied = ref(false)

const timers = new Set<ReturnType<typeof setTimeout>>()
function flash(apply: () => void, clear: () => void) {
  apply()
  const timer = setTimeout(() => {
    timers.delete(timer)
    clear()
  }, FLASH_MS)
  timers.add(timer)
}
onBeforeUnmount(() => timers.forEach(clearTimeout))

// 頁面一載入就先讀：面板打開之後按「分享」是同步的，那時不能再等一趟查詢。
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

// ── 面板開關 ─────────────────────────────────────────────────
function openPanel() {
  // 還沒分享過時預設不勾，每次打開都重來：「包含心得筆記」的兩種錯代價不對等
  includeNotes.value = shareCode.value ? savedNotes.value : false
  notesMessage.value = null
  copied.value = false
  open.value = true
}

function close() {
  open.value = false
}

useOverlayHistory(() => open.value, close)

watch(open, (value) => {
  if (!dialog.value) return
  if (value && !dialog.value.open) dialog.value.showModal()
  if (!value && dialog.value.open) dialog.value.close()
})

// dialog 本身撐滿視窗、卡片在內層（main.css）：點到 dialog 自己就是點到遮罩
function onDialogClick(event: MouseEvent) {
  if (event.target === dialog.value) close()
}

// ── 分享 ─────────────────────────────────────────────────────
/**
 * 寫進剪貼簿。先試 Clipboard API；不支援或被拒（Android 的內建瀏覽器，例如 LINE）
 * 退回 execCommand。暫時的 textarea 要放在 dialog 裡：modal 開著時，
 * dialog 以外的東西都是 inert，放在 body 上選不到文字。
 */
function copyText(text: string): Promise<void> {
  const legacy = () => {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    ;(dialog.value ?? document.body).appendChild(area)
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
 */
function onShare() {
  createError.value = null
  copied.value = false
  const code = shareCode.value ?? pendingCode.value ?? generateShareCode()
  const alreadyCreated = shareCode.value !== null || creating.value
  if (!alreadyCreated) pendingCode.value = code

  const { delivery } = startShare({
    url: shareUrl(window.location.origin, code),
    alreadyCreated,
    deliver: url => deliverShareLink(url, {
      share: typeof navigator.share === 'function' ? data => navigator.share(data) : undefined,
      copy: copyText,
    }),
    create: () => createShare(code, includeNotes.value),
  })
  delivery.then((result) => {
    if (result === 'copied') flash(() => (copied.value = true), () => (copied.value = false))
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
  pendingCode.value = null
  shareCode.value = outcome.code
  if (outcome.kind === 'mismatch') {
    // 別的裝置先分享過：面板改用既有的連結與它的設定，再按一次「分享」就對了
    createError.value = 'mismatch'
    await loadShare()
    includeNotes.value = savedNotes.value
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
// 還沒分享過：只是面板上的狀態，按「分享」時跟著建立請求送出。
// 已經分享過：一變更就立即儲存——使用者可能只是打開面板把心得關掉就走了，
// 那時設定必須已經存好。失敗時改回原狀，不能讓畫面顯示勾了、資料庫沒勾。
async function onNotesChange(event: Event) {
  const value = (event.target as HTMLInputElement).checked
  includeNotes.value = value
  notesMessage.value = null
  if (!shareCode.value) return

  savingNotes.value = true
  const { error } = await supabase.rpc('set_brew_share_notes' as never, {
    p_brew_id: props.brewId,
    p_include: value,
  } as never)
  savingNotes.value = false

  if (error) {
    includeNotes.value = savedNotes.value
    notesMessage.value = { text: '修改未成功，請再試一次', error: true }
    return
  }
  savedNotes.value = value
  const text = notesToggleFeedback(value)
  flash(() => (notesMessage.value = { text, error: false }), () => {
    if (notesMessage.value?.text === text) notesMessage.value = null
  })
}
</script>

<template>
  <!-- 44px 觸控目標；負邊距讓圖示本身對齊頁面內距，與 ‹ 同一套做法。
       標題列對齊基線，這個按鈕自己垂直置中（《03》§4.13.1）：
       上下各 -2px 讓它的外框等於豆名一行的行高（2rem × 1.3），置中才對得準 -->
  <button
    type="button"
    aria-label="分享"
    class="-mr-3 -my-0.5 ml-auto flex shrink-0 items-center justify-center self-center"
    :style="{ minWidth: 'var(--touch-min)', minHeight: 'var(--touch-min)', color: 'var(--text)' }"
    @click="openPanel"
  >
    <ShareIcon />
  </button>

  <!-- dialog 本身是滿版的置中容器（樣式在 main.css），卡片是內層這一個 -->
  <dialog
    ref="dialog"
    class="backdrop:bg-[var(--overlay-scrim)]"
    aria-label="分享"
    @cancel.prevent="close"
    @click="onDialogClick"
  >
    <div
      class="w-full max-w-sm rounded-lg p-6"
      :style="{ background: 'var(--surface)', color: 'var(--text)', boxShadow: 'var(--overlay-shadow)' }"
    >
      <p class="text-sm text-muted">朋友不用登入也能看，只能看、不能改</p>

      <div v-if="hasNotes" class="mt-3">
        <label
          class="flex cursor-pointer items-center gap-3"
          :style="{ minHeight: 'var(--touch-min)' }"
        >
          <input
            type="checkbox"
            class="peer sr-only"
            :checked="includeNotes"
            :disabled="savingNotes || creating"
            @change="onNotesChange"
          >
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
          包含心得筆記
        </label>
        <!-- 放在勾選框下方、對齊文字：回饋比「已儲存」長，375px 下擠不進勾選框那一列 -->
        <p
          aria-live="polite"
          class="pl-8 text-sm"
          :style="{ color: notesMessage?.error ? 'var(--danger)' : 'var(--text-muted)' }"
        >
          {{ notesMessage?.text }}
        </p>
      </div>

      <button
        type="button"
        class="mt-6 w-full rounded-sm px-4 py-3 font-medium"
        :style="{ background: 'var(--accent)', color: 'var(--on-accent)', minHeight: 'var(--touch-min)' }"
        @click="onShare"
      >
        分享
      </button>

      <p aria-live="polite" class="text-sm text-muted" :class="{ 'mt-3': copied }">
        {{ copied ? '已複製連結' : '' }}
      </p>

      <template v-if="createError">
        <p role="alert" class="mt-3 text-sm" :style="{ color: 'var(--danger)' }">
          分享沒有建立成功，剛才那個連結還不能用
        </p>
        <button
          v-if="createError === 'failed'"
          type="button"
          :disabled="creating"
          class="mt-3 w-full rounded-sm border px-4 py-3 disabled:opacity-60"
          :style="{ borderColor: 'var(--border-strong)', minHeight: 'var(--touch-min)' }"
          @click="retry"
        >
          再試一次
        </button>
      </template>
    </div>
  </dialog>
</template>
