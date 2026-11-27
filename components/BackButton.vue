<script setup lang="ts">
// 左上角的 ‹（《03》§3）。icon 封閉清單之一。
//
// 同一個圖示，兩種去處（2026-10-06 起一律看上一頁）：
//   檢視型（紀錄詳情、豆子詳情、設定）  「返回」：回上一頁，沒有上一頁才去 to（父層）
//   流程型（表單）                      「離開」：暫存保留；回上一頁，沒有上一頁才取代成 to
//                                                ——兩種走法都不把表單留在 history 裡
// 兩者都不丟東西。會丟東西的動作一律用「取消」文字，不用圖示（《04》）。
//
// 圖示（2026-11-27 加大）：形狀維持 ‹，線條拉長——M15.5 4 7.5 12l8 8（原本是 Lucide 的 chevron-left），
// 22px 顯示、24 格線、stroke-width 2.2（實際約 2px）。觸控範圍維持 44px。器材選擇器與分段子頁的 ‹ 同一個圖示。
//
// 外觀（2026-11-27）：頁首的圖示按鈕一律圓形——44px 的正圓、--surface 底、--float-shadow（main.css 的 .header-icon-button）。
// 圓的外緣對齊頁面內距，不用負邊距；跟頁面一起捲，不固定。
// floating：豆子詳情左上角、浮在主圖上的那一顆。同一個圓，加 --surface 的 78% 與 6px 背景模糊（.header-icon-button--on-media），
// 和結算頁主圖上的分享鈕相同。固定在畫面上的位置由頁面決定（豆子詳情的 .bean-back）。

const props = defineProps<{
  /** 沒有上一頁時的目的地：返回是父層，離開是依網址決定的目的地 */
  to: string
  label: '返回' | '離開'
  /** 離開時不看上一頁，直接去 to（編輯頁找不到那一筆：上一頁多半是它的詳情） */
  direct?: boolean
  /** 浮在主圖上的圓鈕（豆子詳情） */
  floating?: boolean
}>()

const router = useRouter()
const leaveTo = useFlowLeave()
const goBack = useHistoryBack()
const href = computed(() => router.resolve(props.to).href)

function onClick(event: MouseEvent) {
  // 另開分頁、另開視窗交給瀏覽器
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
  event.preventDefault()
  if (props.label === '離開') {
    void leaveTo(props.to, props.direct)
    return
  }
  if (historyBack(window.history.state?.back) === 'back') void goBack()
  else void navigateTo(props.to)
}
</script>

<template>
  <!-- 44px 的圓就是觸控目標；圓的外緣對齊頁面內距 -->
  <a
    :href="href"
    :aria-label="label"
    class="header-icon-button"
    :class="{ 'header-icon-button--on-media': floating }"
    @click="onClick"
  >
    <svg
      width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"
      fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"
    >
      <path d="M15.5 4 7.5 12l8 8" />
    </svg>
  </a>
</template>
