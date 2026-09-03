<script setup lang="ts">
// 底部固定的分頁列（《03-介面規範》§3）。三項：首頁、豆子、器材。
// 設定不放這裡，放在首頁右上角。
//
// 只出現在三個列表頁。表單頁不放——那些頁面底部是儲存按鈕，
// 再壓一條分頁列會搶掉主要動作的位置。

const route = useRoute()

const items = [
  { to: '/', label: '首頁' },
  { to: '/beans', label: '豆子' },
  { to: '/equipment', label: '器材' },
]

const isActive = (to: string) => (to === '/' ? route.path === '/' : route.path.startsWith(to))
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
