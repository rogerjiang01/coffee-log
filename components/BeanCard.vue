<script setup lang="ts">
// 豆子列表頁的單欄列項（《03-介面規範》§4.5.2）。
//
// 卡片的功能是「讓使用者認出這是哪支豆子」，不是呈現完整資訊。
// 三行：豆名、咖啡店名、養豆天數。沒填的那行整行不顯示。
//
// 沖煮次數不放這裡——大多數時候是 0，佔一整行卻沒有資訊價值，放詳情頁。
// 已喝完也不放這裡，由列表的分組表達。
//
// 高度由 96px 的縮圖決定，不由文字內容決定。

const props = defineProps<{
  name: string
  photoUrl: string | null
  roastLevel: RoastLevel | null
  roaster: string | null
  roastDate: string | null
}>()

const fill = computed(() => roastFill(props.roastLevel))
const days = computed(() => restDays(props.roastDate))
</script>

<template>
  <article
    class="flex overflow-hidden rounded-md border"
    :style="{ borderColor: 'var(--border)', background: 'var(--surface)' }"
  >
    <div class="size-24 shrink-0">
      <img
        v-if="photoUrl"
        :src="photoUrl"
        :alt="name"
        loading="lazy"
        class="size-24 object-cover"
      >
      <div
        v-else
        class="size-24"
        :style="{ background: fill.background }"
        aria-hidden="true"
      />
    </div>

    <!-- h-24 與縮圖同高，overflow-hidden 讓內容再多也撐不開卡片 -->
    <div class="flex h-24 min-w-0 flex-1 flex-col justify-center gap-1 overflow-hidden px-3">
      <h3 class="truncate font-medium">{{ name }}</h3>
      <p v-if="roaster" class="truncate text-sm text-muted">{{ roaster }}</p>
      <p v-if="days !== null" class="truncate text-sm tabular-nums text-muted">養豆 {{ days }} 天</p>
    </div>
  </article>
</template>
