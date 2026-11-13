<script setup lang="ts">
// 底部固定的分頁列（《03》§3）。四格：總覽、紀錄、豆子、器材。
// 設定不放這裡，是總覽右上角的齒輪。
//
// 出現在哪些頁面由 app.vue 依畫面類型決定：瀏覽型與檢視型有，流程型沒有——
// 表單的底部是儲存按鈕，再壓一條分頁列會搶掉主要動作的位置。

const route = useRoute()

// 四格與亮哪一格都在 utils/navigation.ts：紀錄詳情亮「紀錄」，設定亮「總覽」（《03》§3）
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
      v-for="item in TABS"
      :key="item.to"
      :to="item.to"
      class="flex flex-1 items-center justify-center py-3 text-sm"
      :style="{
        minHeight: '52px',
        color: isActive(item.to) ? 'var(--accent)' : 'var(--text-muted)',
        fontWeight: isActive(item.to) ? 500 : 400,
        // 字重 500 要連字體一起換：內文的台北黑體沒有 500（《03》§2.4）
        fontFamily: isActive(item.to) ? 'var(--font-body-medium)' : undefined,
      }"
      :aria-current="isActive(item.to) ? 'page' : undefined"
    >
      {{ item.label }}
    </NuxtLink>
  </nav>
</template>
