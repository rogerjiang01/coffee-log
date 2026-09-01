<script setup lang="ts">
// 豆子卡片（《03-介面規範》§4.5）。
//
// 卡片等高：照片區用固定的 4:3 比例裁切，不讓照片的原始比例決定卡片高度。
// 無照片時用烘焙度色階填充同樣尺寸的區塊並疊上豆名，兩者高度必須相同。

const props = defineProps<{
  name: string
  photoUrl: string | null
  roastLevel: RoastLevel | null
  roaster: string | null
  roastDate: string | null
  isFinished: boolean
}>()

const fill = computed(() => roastFill(props.roastLevel))
const days = computed(() => restDays(props.roastDate))
</script>

<template>
  <article
    class="overflow-hidden rounded-md border"
    :style="{ borderColor: 'var(--border)', background: 'var(--surface)' }"
  >
    <!-- 固定 4:3，有無照片都是同一個尺寸的區塊 -->
    <div class="aspect-[4/3] w-full">
      <img
        v-if="photoUrl"
        :src="photoUrl"
        :alt="name"
        loading="lazy"
        class="h-full w-full object-cover"
      >
      <div
        v-else
        class="flex h-full w-full items-end p-4"
        :style="{ background: fill.background, color: fill.color }"
      >
        <span class="font-serif text-lg font-bold">{{ name }}</span>
      </div>
    </div>

    <div class="px-4 py-3">
      <h3 class="font-medium">{{ name }}</h3>
      <!-- 規範第 1 節禁止中間點串接的 meta 字串，因此分行呈現 -->
      <p v-if="days !== null" class="mt-1 text-sm tabular-nums text-muted">養豆 {{ days }} 天</p>
      <p v-if="roaster" class="mt-1 text-sm text-muted">{{ roaster }}</p>
      <p v-if="!roaster && days === null" class="mt-1 text-sm text-muted">還沒填其他資訊</p>
      <p v-if="isFinished" class="mt-2 text-xs text-muted">已喝完</p>
    </div>
  </article>
</template>
