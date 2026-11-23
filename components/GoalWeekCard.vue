<script setup lang="ts">
// 「本週目標」卡片（《03》§4.16，Figma 的「Card / 本週目標」）：總覽與結算頁共用同一個元件。
//
// 標題列在上（AppCard）；下面一排三塊：左邊 100px 的環（線寬 22px），中間是「記錄」（14px、500）與
// 「N／M」（28px Bold）加「杯」（16px、500），右邊是週一到週日的每日長條圖（10px 寬，星期 13px）。
// 字級是 2026-11-17 照 Figma 更新過的值（使用者第二次反映字太小）。每一天都有一條全高的底軌（--accent-wash），杯數的長條疊在上面；
// 沒有紀錄的日子只看得到底軌（照 Figma）。
//
// 結算頁特有的行為由 props 開：
//   from        環從存檔前的杯數畫到存檔後的杯數（GoalRing 的動畫，減少動態效果時直接顯示最後狀態）
//   celebrate   這一筆剛好跨過目標：環補滿時的強調，「N／M 杯」下方顯示「已達成」
// 總覽的卡片可以點（修改目標，標題列右端有 ›），結算頁的不行。
//
// 超過目標時兩頁都一樣（《02》§4.1、§5，2026-11-16）：環停在一圈、不畫第二圈，數字下方寫「超過 N 杯」。
// 結算頁上已經超過目標之後的紀錄，環的起點與終點都是滿的一圈，所以沒有動畫，數字直接是存檔後的杯數。

const props = withDefaults(defineProps<{
  count: number
  goal: number
  /** 週一到週日每天的杯數 */
  days: number[]
  from?: number | null
  celebrate?: boolean
  clickable?: boolean
  /** 卡片圓角（AppCard 的 radius）。預設 md（結算頁）；總覽明確傳 ml，之後新用到的地方不會不小心變成 18px */
  radius?: 'ml' | 'md'
}>(), { from: null, celebrate: false, clickable: false, radius: 'md' })

const emit = defineEmits<{ click: [] }>()

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']
const BAR_HEIGHT = 54

// 環最多畫到一圈
const ringCount = computed(() => Math.min(props.count, props.goal))
const ringFrom = computed(() => (props.from === null ? null : Math.min(props.from, props.goal)))

// 有動畫時，數字等環畫完才換成存檔後的杯數。起點和終點相同（已經超過目標）就沒有動畫
const filled = ref(ringFrom.value === null || ringFrom.value === ringCount.value)
const shown = computed(() => (filled.value || props.from === null ? props.count : props.from))

const barMax = computed(() => Math.max(1, ...props.days))

// 放不下時的退讓（2026-11-17，自己判斷的，見 第三批.md 第八節）。Figma 的值只算過 350px 寬、一位數的「1 / 3」：
// 28px 的「12／21 杯」約 118px 寬，390px 下中間只剩 84px，375px 下連「2／3 杯」都放不下，會壓到長條。
//   1. 長條的間距先讓：8px 縮到最少 4px（長條本身維持 10px），整組 118 → 94px
//   2. 還放不下才把數字縮小：字級 = min(28px, 剩下的寬度 ÷ 這串字的寬度)。一位數在 375px 以上都是 28px
// 剩下的寬度 = 這一排的寬度（100cqi）− 環 100 − 兩個間距 24 − 長條最窄 94 − 「杯」與前面的空隙 24 = 100cqi − 242px。
// 這串字的寬度以 em 計：台北黑體 Bold 的數字約 0.59em，全形斜線 1em（實際量過：28px 的「2／3」是 61px）
const numberFontSize = computed(() => {
  const digits = String(shown.value).length + String(props.goal).length
  const em = Math.round((digits * 0.59 + 1) * 100) / 100
  return `min(var(--text-display-m), calc((100cqi - 242px) / ${em}))`
})

const status = computed(() => {
  if (props.celebrate) return filled.value ? '已達成' : ''
  if (props.count > props.goal) return `超過 ${props.count - props.goal} 杯`
  return ''
})
</script>

<template>
  <AppCard
    :as="clickable ? 'button' : 'section'"
    :type="clickable ? 'button' : undefined"
    title="本週目標"
    :radius="radius"
    :arrow="clickable"
    class="flex w-full flex-col text-left"
    :style="{ minHeight: 'var(--overview-card-h)' }"
    @click="clickable && emit('click')"
  >
    <!-- container：數字的字級用這一排的寬度（cqi）算，見 numberFontSize -->
    <span class="goal-row flex items-end gap-3 px-3 pt-3.25 pb-2">
      <GoalRing :count="ringCount" :from="ringFrom" :goal="goal" :size="100" :celebrate="celebrate" @filled="filled = true" />
      <span class="flex shrink-0 flex-col justify-center self-stretch pb-2.5">
        <span class="text-body-m font-medium">記錄</span>
        <!-- 數字是台北黑體 Bold（text-display-m 自帶 700），「杯」是 Noto Sans TC Medium；同一行、基線對齊 -->
        <span class="whitespace-nowrap tabular-nums" :style="{ color: 'var(--accent-text)' }">
          <span class="text-display-m" :style="{ fontSize: numberFontSize }">{{ shown }}／{{ goal }}</span>
          <span class="ml-2 text-heading-s font-medium">杯</span>
        </span>
        <span v-if="status" class="text-body-s font-medium" :style="{ color: 'var(--accent-text)' }">{{ status }}</span>
      </span>
      <!-- 每日長條圖：10px 寬、圓頭。底軌全高 54px，杯數的長條疊在上面，最多的那一天頂到最高。
           整組靠右；間距 8px，空間不夠時縮到最少 4px（長條平均分開，寬度 94–118px） -->
      <span class="ml-auto flex min-w-[94px] max-w-[118px] flex-1 justify-between" aria-hidden="true">
        <span v-for="(cups, day) in days" :key="day" class="flex w-2.5 flex-col items-center gap-0.5">
          <span class="corner-bar relative w-full rounded-full" :style="{ height: `${BAR_HEIGHT}px`, background: 'var(--accent-wash)' }">
            <span
              v-if="cups"
              class="corner-bar absolute inset-x-0 bottom-0 rounded-full"
              :style="{ height: `${Math.max(8, (cups / barMax) * BAR_HEIGHT)}px`, background: 'var(--accent)' }"
            />
          </span>
          <span class="text-body-s whitespace-nowrap text-muted">{{ WEEKDAYS[day] }}</span>
        </span>
      </span>
    </span>
  </AppCard>
</template>

<style scoped>
.goal-row {
  container-type: inline-size;
}
</style>
