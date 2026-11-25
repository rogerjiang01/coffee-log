<script setup lang="ts">
// 底部分頁列的四個圖示（《03》§3「分頁列」，2026-11-25）。從 Figma 匯出（檔案 TJl75B6UGFD5bv7f6nKIwL，
// Page 3 的 Component 區：home 3578:1051、brew 3578:1046、bean 3578:1058、equippment 3578:1063），
// 形狀不改，顏色改成 currentColor：跟著分頁那一格的文字顏色（選中 --accent、未選 --text-muted）一起淡入淡出。
//
// 有填色也有描邊，兩種都用 currentColor：
//   總覽  home   填色   Google Material Symbols 的 home（Apache 2.0，NOTICE.md）
//   紀錄  brew   填色   Google Material Symbols（Apache 2.0，NOTICE.md）
//   豆子  bean   描邊   Streamline 的 Plump free icons（Iconify 的 streamline-plump:coffee-bean，CC BY 4.0，NOTICE.md）。
//                     Figma 匯出的 viewBox 是 17，平移到 24 格線裡 Figma 的位置
//   器材  equip  描邊＋填色  使用者自己畫的。Figma 匯出的 viewBox 是 20×19，同樣平移到 24 格線裡
//
// 描邊的實際線寬 2px（24 格線、24px 顯示、stroke-width 2），是「頂部導覽與主要動作」那一級。
// **器材是平頭直角**（stroke-linecap butt、stroke-linejoin miter），照 Figma：
// 這一組不套用 Lucide 的圓頭規則（《03》§3 的例外）。
//
// 一律是裝飾：分頁那一格旁邊就有文字，連結的名稱由文字提供。
export type TabIconName = 'home' | 'brew' | 'bean' | 'equip'

defineProps<{ name: TabIconName }>()
</script>

<template>
  <svg
    width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"
    class="shrink-0"
    fill="none"
  >
    <path
      v-if="name === 'home'"
      fill="currentColor"
      d="M6 19H9V13H15V19H18V10L12 5.5L6 10V19ZM4 21V9L12 3L20 9V21H13V15H11V21H4Z"
    />
    <path
      v-else-if="name === 'brew'"
      fill="currentColor"
      d="M6 19V6L3 2H18V5H20C20.5533 5 21.0233 5.19667 21.41 5.59C21.8033 5.98333 22 6.45333 22 7V12C22 12.5467 21.8033 13.0167 21.41 13.41C21.0167 13.8033 20.5467 14 20 14H18V19H6ZM8 17H16V4H7L8 5.3V17ZM18 12H20V7H18V12ZM12 16H15V5H12V16ZM3 22V20H21V22H3Z"
    />
    <g
      v-else-if="name === 'bean'"
      transform="translate(4 4)"
      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
    >
      <path d="M12.5728 13.1795C9.89328 15.8377 5.9583 17.1891 3.17182 14.6433C2.88772 14.3839 2.61554 14.1117 2.35609 13.8276C-0.189636 11.0411 1.16178 7.10616 3.81989 4.4266C4.02131 4.22361 4.22352 4.02141 4.4265 3.81999C7.10607 1.16151 11.041 -0.189541 13.8275 2.35619C14.1116 2.61563 14.3838 2.88782 14.6432 3.17192C17.189 5.9584 15.8376 9.89337 13.1795 12.5729C12.978 12.7759 12.7758 12.9781 12.5728 13.1795Z" />
      <path d="M14.5686 3.08072C11.6032 3.39821 9.3815 5.08821 8.49886 8.49949C7.61622 11.9108 5.39489 13.6008 2.42875 13.9183" />
    </g>
    <g
      v-else
      transform="translate(3 3)"
    >
      <g stroke="currentColor" stroke-width="2" stroke-linecap="butt" stroke-linejoin="miter">
        <rect x="1" y="4" width="7" height="10" />
        <rect x="1" y="14" width="7" height="4" />
        <path d="M4.5 3V1H10.5001L13.5001 5H17" />
      </g>
      <path fill="currentColor" d="M14 0H20L18.5 3H15.5L14 0Z" />
    </g>
  </svg>
</template>
