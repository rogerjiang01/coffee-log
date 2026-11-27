<script setup lang="ts">
// 頁面頂部（《03》§3）。三種畫面共用同一個結構，差別只在有沒有 ‹：
//
//   瀏覽型  標題                （總覽右側多一個人頭佔位，放在 end）
//   檢視型  ‹                   （標題在內容裡，例如豆名；‹ 回上一頁，沒有上一頁回父層）
//   流程型  ‹ 標題
//
// **右側原則上是空的。** 以前右上角同時放過導覽（回首頁、設定）、頁面動作
// （編輯）、流程進出（取消），四種東西長得一樣，使用者無法從位置判斷按下去
// 會發生什麼。編輯與刪除現在在內容區；右側只剩總覽的人頭佔位（通往設定）。
//
// 頁首的圖示按鈕一律是 44px 的圓（2026-11-27，main.css 的 .header-icon-button），外緣對齊頁面內距；
// 跟頁面一起捲，不固定（只有主圖頁面的按鈕固定在頂端）。‹ 和標題之間 12px

defineProps<{
  title?: string
  /** 有值就顯示 ‹ */
  back?: string
  backLabel?: '返回' | '離開'
  /** ‹ 離開不看上一頁，直接去 back（編輯頁找不到那一筆） */
  backDirect?: boolean
}>()
</script>

<template>
  <header class="flex items-center gap-3" :style="{ minHeight: 'var(--touch-min)' }">
    <BackButton v-if="back" :to="back" :label="backLabel ?? '返回'" :direct="backDirect" />
    <h1 v-if="title" class="min-w-0 flex-1 truncate text-display-s font-medium">{{ title }}</h1>
    <div v-else class="flex-1" />
    <slot name="end" />
  </header>
</template>
