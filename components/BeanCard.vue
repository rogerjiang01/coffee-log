<script setup lang="ts">
// 豆子列表卡片（《03-介面規範》§4.5）。
// 有照片與無照片必須等高——混合高度會讓整列版面破碎。
// 無照片時以烘焙度色階填充並疊上豆名，文字色依烘焙度切換。

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
    <!-- 固定高度是等高的關鍵，有照片走 object-cover，無照片走色塊 -->
    <div class="relative h-32">
      <img
        v-if="photoUrl"
        :src="photoUrl"
        :alt="name"
        loading="lazy"
        class="h-32 w-full object-cover"
      >
      <div
        v-else
        class="flex h-32 w-full items-center px-4"
        :style="{ background: fill.background, color: fill.color }"
      >
        <span class="font-serif text-lg font-bold">{{ name }}</span>
      </div>
    </div>

    <div class="px-4 py-3">
      <h3 class="font-medium">{{ name }}</h3>
      <!-- 規範第 1 節禁止中間點串接的 meta 字串，因此分行呈現 -->
      <p v-if="roaster" class="mt-1 text-sm text-muted">{{ roaster }}</p>
      <p v-if="days !== null" class="mt-1 text-sm tabular-nums text-muted">養豆 {{ days }} 天</p>
      <p v-if="!roaster && days === null" class="mt-1 text-sm text-muted">還沒填其他資訊</p>
      <p v-if="isFinished" class="mt-2 text-xs text-muted">已喝完</p>
    </div>
  </article>
</template>
