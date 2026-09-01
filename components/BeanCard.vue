<script setup lang="ts">
// 豆子列表頁的單欄列項（《03-介面規範》§4.5.2）。
//
// 橫式：左側 80px 見方縮圖，右側資訊。直式大圖在單欄列表上每一項都太高，
// 一個畫面看不到幾支豆子。
//
// §4.5.1 的「等高」規則不適用於這裡——那條是給首頁橫向卡片列的版面限制。

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
    class="flex gap-3 overflow-hidden rounded-md border"
    :style="{ borderColor: 'var(--border)', background: 'var(--surface)' }"
  >
    <!-- 左側縮圖：有無照片都是 80×80 -->
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

    <div class="min-w-0 flex-1 py-2 pr-3">
      <h3 class="truncate font-medium">{{ name }}</h3>

      <!-- 沒填就不顯示，不寫「未填」之類複述畫面的字（§5.6） -->
      <p v-if="roastLevel" class="mt-0.5 text-sm text-muted">{{ roastLabels[roastLevel] }}</p>

      <p class="mt-0.5 text-sm tabular-nums text-muted">
        <span v-if="days !== null" class="mr-3">養豆 {{ days }} 天</span>
        <span>沖煮 {{ brewCount }} 次</span>
      </p>

      <!-- 狀態要有視覺，不只是文字（§4.10） -->
      <p
        v-if="isFinished"
        class="mt-1 inline-block rounded-sm px-2 py-0.5 text-xs"
        :style="{ background: 'var(--accent-wash)', color: 'var(--accent)' }"
      >
        已喝完
      </p>
    </div>
  </article>
</template>
