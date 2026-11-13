<script setup lang="ts">
// 「本週目標」卡片（《03》§4.16）：總覽與結算頁共用同一個元件。
//
// 標題在左上；標題下面左邊是 80px 的環，右邊上方是「N／M 杯」，下方是週一到週日的每日長條圖。
// 本週全部 0 杯時長條區只剩底線，不保留空白。
//
// 結算頁特有的行為由 props 開：
//   from        環從存檔前的杯數畫到存檔後的杯數（GoalRing 的動畫，減少動態效果時直接顯示最後狀態）
//   celebrate   這一筆剛好跨過目標：環補滿時的強調，「N／M 杯」下方顯示「已達成」
//               （標題已經是「本週目標」，不再寫「本週目標達成」）
// 總覽的卡片可以點（修改目標），結算頁的不行。

const props = withDefaults(defineProps<{
  count: number
  goal: number
  /** 週一到週日每天的杯數 */
  days: number[]
  from?: number | null
  celebrate?: boolean
  clickable?: boolean
}>(), { from: null, celebrate: false, clickable: false })

const emit = defineEmits<{ click: [] }>()

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']

// 有動畫時，數字等環畫完才換成存檔後的杯數
const filled = ref(props.from === null)
const shown = computed(() => (filled.value || props.from === null ? props.count : props.from))

const barMax = computed(() => Math.max(1, ...props.days))
const anyCups = computed(() => props.days.some(cups => cups > 0))
</script>

<template>
  <component
    :is="clickable ? 'button' : 'section'"
    :type="clickable ? 'button' : undefined"
    class="block w-full rounded-md border p-3 text-left shadow-light"
    :style="{ borderColor: 'var(--border)', background: 'var(--surface)' }"
    @click="clickable && emit('click')"
  >
    <h2 class="text-heading-m font-medium">本週目標</h2>

    <div class="mt-3 flex items-center gap-4">
      <GoalRing :count="count" :from="from" :goal="goal" :size="80" :celebrate="celebrate" @filled="filled = true" />
      <div class="min-w-0 flex-1">
        <p class="tabular-nums">
          <span class="text-display-s">{{ shown }}／{{ goal }}</span>
          <span class="ml-1 text-sm text-muted">杯</span>
        </p>
        <p v-if="celebrate && filled" class="text-sm font-medium" :style="{ color: 'var(--accent)' }">已達成</p>
        <!-- 每日長條圖：長條寬度固定、明顯窄於每一天的欄寬，杯數多的那天是直立的長條 -->
        <div class="mt-2 flex items-end gap-1.5" aria-hidden="true">
          <div v-for="(cups, day) in days" :key="day" class="flex flex-1 flex-col items-center gap-1">
            <div class="flex w-full items-end justify-center" :class="anyCups ? 'h-10' : 'h-0.5'">
              <div
                class="w-2 rounded-sm"
                :style="{
                  height: cups ? `${(cups / barMax) * 100}%` : '2px',
                  background: cups ? 'var(--accent)' : 'var(--border)',
                }"
              />
            </div>
            <span class="text-sm leading-none text-muted">{{ WEEKDAYS[day] }}</span>
          </div>
        </div>
      </div>
    </div>
  </component>
</template>
