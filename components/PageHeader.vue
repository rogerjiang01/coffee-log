<script setup lang="ts">
// 頁面頂部（《03》§3）。三種畫面共用同一個結構，差別只在有沒有 ‹：
//
//   瀏覽型  標題                （首頁右側多一個齒輪，放在 end）
//   檢視型  ‹                   （標題在內容裡，例如豆名）
//   流程型  ‹ 標題
//
// **右側原則上是空的。** 以前右上角同時放過導覽（回首頁、設定）、頁面動作
// （編輯）、流程進出（取消），四種東西長得一樣，使用者無法從位置判斷按下去
// 會發生什麼。編輯與刪除現在在內容區；右側只剩首頁的齒輪。

defineProps<{
  title?: string
  /** 有值就顯示 ‹ */
  back?: string
  backLabel?: '返回' | '離開'
}>()
</script>

<template>
  <header class="flex items-center gap-1" :style="{ minHeight: 'var(--touch-min)' }">
    <BackButton v-if="back" :to="back" :label="backLabel ?? '返回'" />
    <h1 v-if="title" class="min-w-0 flex-1 truncate font-serif text-xl font-bold">{{ title }}</h1>
    <div v-else class="flex-1" />
    <slot name="end" />
  </header>
</template>
