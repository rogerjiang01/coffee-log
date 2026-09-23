<script setup lang="ts">
// 分享圖示（《03》§3 的封閉清單）。iOS 的方框加向上箭頭，不是三個圓點串線——
// 使用者的裝置多半是手機，方框加箭頭在 iOS 與 Android 上都認得出來。
//
// 用在紀錄詳情頁的標題列（BrewShare.vue），按下去出現分享面板。
//
// 尺寸取頂部導覽與主要動作那一級（22×22、實際線寬 2px），與 ‹ 和齒輪同級：
// 分享是頁面層級的動作，不是內容區的小標記。若改成別的尺寸，
// stroke-width 要跟著重算（《03》§3：stroke-width ＝ 實際線寬 × viewBox 寬 ÷ 顯示寬）。
//
// label 有值時圖示自己就是資訊，要讓螢幕閱讀器讀得到；沒有值時它只是按鈕裡的
// 裝飾，按鈕自己有 aria-label，圖示要藏起來。與 StirIcon 同一套規則。
defineProps<{ label?: string }>()
</script>

<template>
  <svg
    width="22" height="22" viewBox="0 0 24 24"
    :aria-hidden="label ? undefined : true"
    :role="label ? 'img' : undefined"
    :aria-label="label"
    fill="none" stroke="currentColor" stroke-width="2.18" stroke-linecap="round" stroke-linejoin="round"
  >
    <path d="M12 2v13" />
    <path d="m16 6-4-4-4 4" />
    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
  </svg>
</template>
