<script setup lang="ts">
// 豆子列表頁的單欄列項（《03-介面規範》§4.5.2）。
//
// 卡片的功能是「讓使用者認出這是哪支豆子」，不是呈現完整資訊，因此只有兩行。
//
// 高度由固定尺寸的縮圖決定，不由文字內容決定——有沒有標籤、名字幾個字，
// 都不該影響版面。右側資訊區鎖成與縮圖等高，超出就截斷。
//
// 烘焙度不另外寫字：縮圖的烘焙度色塊已經表達了。
// 已喝完不用標籤：整張卡片降低透明度，不佔版面高度。

const props = defineProps<{
  name: string
  photoUrl: string | null
  roastLevel: RoastLevel | null
  roastDate: string | null
  brewCount: number
  isFinished: boolean
}>()

const fill = computed(() => roastFill(props.roastLevel))
const days = computed(() => restDays(props.roastDate))
</script>

<template>
  <article
    class="flex overflow-hidden rounded-md border"
    :style="{
      borderColor: 'var(--border)',
      background: 'var(--surface)',
      opacity: isFinished ? 0.5 : 1,
    }"
  >
    <div class="size-20 shrink-0">
      <img
        v-if="photoUrl"
        :src="photoUrl"
        :alt="name"
        loading="lazy"
        class="size-20 object-cover"
      >
      <div
        v-else
        class="size-20"
        :style="{ background: fill.background }"
        aria-hidden="true"
      />
    </div>

    <!-- h-20 與縮圖同高，overflow-hidden 讓內容再多也撐不開卡片 -->
    <div class="flex h-20 min-w-0 flex-1 flex-col justify-center gap-1 overflow-hidden px-3">
      <h3 class="truncate font-medium">{{ name }}</h3>

      <p class="truncate text-sm tabular-nums text-muted">
        <span v-if="days !== null" class="mr-4">養豆 {{ days }} 天</span>
        <span>沖煮 {{ brewCount }} 次</span>
      </p>
    </div>
  </article>
</template>
