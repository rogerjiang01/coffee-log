<script setup lang="ts">
// 首頁上區的橫向卡片（《03-介面規範》§4.5.1）。
//
// **等寬等高。** 橫向排列時高度不一致會直接破版，這是版面限制不是美學偏好，
// 所以照片區與資訊區都是固定高度，不讓內容決定尺寸。
//
// 養豆天數是這張卡片上最有價值的資訊——它會變化，而且影響風味——
// 因此視覺權重高於其他數值。

const props = defineProps<{
  name: string
  photoUrl: string | null
  roastLevel: RoastLevel | null
  roastDate: string | null
  brewCount: number
  favoriteCount: number
}>()

const fill = computed(() => roastFill(props.roastLevel))
const days = computed(() => restDays(props.roastDate))
</script>

<template>
  <article
    class="w-40 shrink-0 overflow-hidden rounded-md border"
    :style="{ borderColor: 'var(--border)', background: 'var(--surface)' }"
  >
    <!-- 照片區是 160×160 正方形，與裁切比例一致：使用者裁的就是這裡看到的。
         object-cover 只為了裁切上線前存的非正方形舊照片。 -->
    <div class="size-40">
      <img
        v-if="photoUrl"
        :src="photoUrl"
        :alt="name"
        loading="lazy"
        class="block size-40 object-cover"
      >
      <!-- 無照片時用烘焙度色塊填同樣尺寸，疊上豆名——等高 -->
      <div
        v-else
        class="flex size-40 items-end p-3"
        :style="{ background: fill.background, color: fill.color }"
      >
        <span class="line-clamp-2 font-serif text-sm font-bold">{{ name }}</span>
      </div>
    </div>

    <div class="flex h-24 flex-col justify-between px-3 py-2">
      <h3 class="truncate text-sm font-medium">{{ name }}</h3>

      <p v-if="days !== null" class="tabular-nums" :style="{ color: 'var(--text)' }">
        養豆 <span class="text-lg font-medium">{{ days }}</span> 天
      </p>
      <p v-else class="text-sm text-muted">&nbsp;</p>

      <p class="text-xs tabular-nums text-muted">
        沖過 {{ brewCount }} 次<span v-if="favoriteCount > 0" class="ml-2">收藏 {{ favoriteCount }}</span>
      </p>
    </div>
  </article>
</template>
