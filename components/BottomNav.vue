<script setup lang="ts">
// 底部固定的分頁列（《03》§3）。三項：首頁、豆子、器材。
// 設定不放這裡，是首頁右上角的齒輪。
//
// 出現在哪些頁面由 app.vue 依畫面類型決定：瀏覽型與檢視型有，流程型沒有——
// 表單的底部是儲存按鈕，再壓一條分頁列會搶掉主要動作的位置。

const route = useRoute()

const items = [
  { to: '/', label: '首頁' },
  { to: '/beans', label: '豆子' },
  { to: '/equipment', label: '器材' },
] as const

// 亮哪一項依內容階層（utils/navigation.ts）：紀錄詳情屬於豆子
const isActive = (to: string) => tabSection(route.path) === to
</script>

<template>
  <nav
    class="fixed inset-x-0 bottom-0 z-30 flex border-t"
    :style="{
      borderColor: 'var(--border)',
      background: 'var(--surface)',
      paddingBottom: 'env(safe-area-inset-bottom)',
    }"
  >
    <NuxtLink
      v-for="item in items"
      :key="item.to"
      :to="item.to"
      class="flex flex-1 items-center justify-center py-3 text-sm"
      :style="{
        minHeight: '52px',
        color: isActive(item.to) ? 'var(--accent)' : 'var(--text-muted)',
        fontWeight: isActive(item.to) ? 500 : 400,
      }"
      :aria-current="isActive(item.to) ? 'page' : undefined"
    >
      {{ item.label }}
    </NuxtLink>
  </nav>
</template>
