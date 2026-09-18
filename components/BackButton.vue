<script setup lang="ts">
// 左上角的 ‹（《03》§3）。icon 封閉清單之一。
//
// 同一個圖示，三種去處：
//   檢視型、階層式（豆子詳情、設定）  「返回」：一般連結，到上一層
//   檢視型、歷史式（紀錄詳情）        「返回」：回上一頁，沒有上一頁才去 to
//   流程型（表單）                    「離開」：暫存保留；上一頁就是目的地時退回去，
//                                              否則取代這一頁——表單不留在 history 裡
// 三者都不丟東西。會丟東西的動作一律用「取消」文字，不用圖示（《04》）。

const props = defineProps<{
  /** 目的地。歷史式時是沒有上一頁時的 fallback */
  to: string
  label: '返回' | '離開'
  /** 歷史式：回上一頁 */
  history?: boolean
}>()

const router = useRouter()
const exitTo = useFlowExit()
const goBack = useHistoryBack()
const href = computed(() => router.resolve(props.to).href)

function onClick(event: MouseEvent) {
  // 另開分頁、另開視窗交給瀏覽器
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
  event.preventDefault()
  if (props.label === '離開') {
    void exitTo(props.to)
    return
  }
  if (historyBack(window.history.state?.back) === 'back') void goBack()
  else void navigateTo(props.to)
}
</script>

<template>
  <!-- 44px 觸控目標；負邊距讓圖示本身對齊頁面內距，而不是整個觸控區 -->
  <NuxtLink
    v-if="!history && label === '返回'"
    :to="to"
    :aria-label="label"
    class="-ml-3 flex shrink-0 items-center justify-center"
    :style="{ minWidth: 'var(--touch-min)', minHeight: 'var(--touch-min)' }"
  >
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  </NuxtLink>
  <a
    v-else
    :href="href"
    :aria-label="label"
    class="-ml-3 flex shrink-0 items-center justify-center"
    :style="{ minWidth: 'var(--touch-min)', minHeight: 'var(--touch-min)' }"
    @click="onClick"
  >
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  </a>
</template>
