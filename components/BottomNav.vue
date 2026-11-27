<script setup lang="ts">
// 底部的分頁列（《03》§3「分頁列」）。四格：總覽、紀錄、豆子、器材。
// 設定不放這裡，是總覽右上角的人頭佔位（2026-11-27 以前是齒輪）。
//
// 出現在哪些頁面由 app.vue 依畫面類型決定：瀏覽型與檢視型有，流程型沒有——
// 表單的底部是儲存按鈕，再壓一條分頁列會搶掉主要動作的位置。
//
// 外觀（2026-11-25，Figma 的「Tab Bar 草稿」3580:1037／3580:1060）：浮動的膠囊，高 64、圓角 32，
// 左右和內容欄對齊，下緣離螢幕底 iPhone 20、其他 12，對齊 iOS 原生的浮動分頁列（tokens.css 的 --tab-bar-*）。
// 四格等寬，icon 24 在上、文字 Body S 在下、間距 2。選中的那一格墊一個沙色膠囊（56 高、圓角 28，和外層同心）。
//
// 切換分頁時那個膠囊**滑過去**：它是一個獨立的元素，位置只由 index 決定（transform），不是每格各自的底色。
//   - 伺服器算繪就把 transform 寫進 HTML，重新整理或直接打開某一頁時第一次畫出來就在正確位置；
//     CSS transition 只在值改變時才跑，所以不會從第一格滑過去
//   - 分頁列在 app.vue、NuxtPage 外面，換頁時不重新掛載：詳情頁返回列表是同一格，膠囊不動
//   - 從表單回來（表單沒有分頁列）是重新掛載，直接在位置上
//   - 減少動態時 main.css 全站的規則把 transition 壓到 0.01ms，等於直接切換
//   - 不亮任何一格的（已登入看分享頁）不畫膠囊；離開時新掛上的膠囊直接在位置上
//
// preview：/dev/corners 的預覽用。不固定在畫面底部，點了只換選中的格子、不導覽。

const props = withDefaults(defineProps<{ preview?: boolean }>(), { preview: false })

const route = useRoute()
const previewTab = ref<TabPath>('/')

// 四格與亮哪一格都在 utils/navigation.ts：紀錄詳情亮「紀錄」，設定亮「總覽」（《03》§3）
const current = computed<TabPath | null>(() => props.preview ? previewTab.value : tabSection(route.path))
const index = computed(() => TABS.findIndex(item => item.to === current.value))

// 焦點框只在鍵盤操作時畫（和 SelectField 同一個做法，不靠原生的 :focus-visible）
const modality = useInputModality()

function onClick(event: MouseEvent, to: TabPath) {
  if (!props.preview) return
  event.preventDefault()
  previewTab.value = to
}
</script>

<template>
  <nav
    class="tab-bar"
    :class="{ 'tab-bar--preview': preview }"
    :data-keyboard-focus="modality === 'keyboard' ? 'true' : undefined"
  >
    <span
      v-if="index >= 0"
      class="tab-bar__indicator"
      aria-hidden="true"
      :style="{ transform: `translateX(${index * 100}%)` }"
    />
    <NuxtLink
      v-for="item in TABS"
      :key="item.to"
      :to="item.to"
      class="tab-bar__item"
      :class="{ 'tab-bar__item--active': current === item.to }"
      :aria-current="current === item.to ? 'page' : undefined"
      @click="onClick($event, item.to)"
    >
      <TabIcon :name="item.icon" />
      <span class="text-body-s">{{ item.label }}</span>
    </NuxtLink>
  </nav>
</template>

<style scoped>
.tab-bar {
  position: fixed;
  z-index: 30;
  left: var(--fixed-left);
  right: var(--fixed-right);
  bottom: var(--tab-bar-bottom);
  display: flex;
  height: var(--tab-bar-h);
  padding: var(--tab-bar-pad);
  border-radius: var(--radius-tab-bar);
  corner-shape: var(--corner-tab-bar);
  background: var(--surface);
  /* 內側 1px 的框：inset 陰影不佔版面，4px 的內距照樣從外緣算（和 Figma 一致） */
  box-shadow: inset 0 0 0 1px var(--border), var(--shadow-light);
}

.tab-bar--preview {
  position: relative;
  left: auto;
  right: auto;
  bottom: auto;
  z-index: auto;
}

.tab-bar__indicator {
  position: absolute;
  top: var(--tab-bar-pad);
  bottom: var(--tab-bar-pad);
  left: var(--tab-bar-pad);
  width: calc((100% - 2 * var(--tab-bar-pad)) / 4);
  border-radius: var(--radius-tab-indicator);
  corner-shape: var(--corner-tab-indicator);
  background: var(--surface-muted);
  transition: transform var(--motion-duration) var(--motion-ease);
}

.tab-bar__item {
  position: relative; /* 疊在膠囊上面 */
  display: flex;
  flex: 1 1 0;
  min-width: 0;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  border-radius: var(--radius-tab-indicator);
  corner-shape: var(--corner-tab-indicator);
  color: var(--text-muted);
  /* 選中與未選都是 400（照 Figma）：字重不變，顏色淡入淡出時字寬不會跳 */
  font-weight: 400;
  transition: color var(--motion-duration) var(--motion-ease);
  -webkit-tap-highlight-color: transparent;
}

.tab-bar__item--active {
  color: var(--accent);
}

/* 焦點框：只在鍵盤操作時畫，畫在格子內側——格子之間沒有間距，往外畫會壓到隔壁 */
.tab-bar__item:focus-visible {
  outline: none;
}
.tab-bar[data-keyboard-focus="true"] .tab-bar__item:focus {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}
</style>
