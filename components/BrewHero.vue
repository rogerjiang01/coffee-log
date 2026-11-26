<script setup lang="ts">
// 結算頁的主圖（《03》§4.17，Figma 結算頁 v2：3626:1493、3628:1544）。
//
// **只負責版面、漸層與按鈕，不碰「沒有照片時」那張圖的內容**——那是 BrewHeroFallback 的事，之後換圖只改它。
//
// 版面：
// - 滿版：放在沒有左右內距的容器裡（結算頁的 main），手機上左右貼齊螢幕；寬螢幕時跟著容器，最多 --content-max
// - 高度以 390 寬時 470 為準，矮螢幕用 svh 限高：min(470px, 58svh)（--hero-h），iPhone 第一屏看得到比較區的標題。
//   這是最小高度：豆名很長時標題區把主圖撐高
// - 標題區（預設 slot）壓在主圖底部，左右內距 ＝ 頁面的左右內距（--form-gutter）＋ --card-pad，
//   和下面的段落標題、卡片裡的列文字同一條線（2026-11-26）
// - **標題的頂端不高於主圖的 55%**（--hero-h × 0.55）：圖的重點內容在上方 55%（《03》§4.17.1），
//   沒照片時三顆豆子都在那裡面。豆名很長時主圖往下長，不往上蓋（2026-11-26）
// - 右上角的按鈕（actions slot）：間距 12，距頂 40（和改版前的完成鈕同一個位置）、距右 20。
//   **固定在畫面上**（position: fixed，2026-11-26）：不跟著捲走，影像淡掉之後直接浮在內容上。
//   右緣用 --fixed-right（和分頁列、浮動按鈕同一條線：寬螢幕時跟著內容欄，橫向時避開安全區）
//
// 圖：
// - 有豆袋照片（hasPhoto）：用原圖（photoUrl，不用 384 的縮圖），object-fit: cover、置中。
//   網址還沒拿到、圖還沒載完時，底下先是烘焙度底色，版面不跳動。載入失敗時換成 BrewHeroFallback
// - 沒有照片：BrewHeroFallback
//
// **隨捲動淡出**（2026-11-26）：往上捲時，影像層（照片或 BrewHeroFallback，加上頂端給按鈕用的 --hero-scrim）
// 的透明度跟著捲動距離從 1 降到 0，捲過主圖基準高度的 60%（--hero-fade-end）時完全透明。
// 底部融進 --bg 的漸層、標題區背後那一層、標題區本身與下面的內容都不淡出。兩條路：
//   - 支援捲動連動動畫的瀏覽器（animation-timeline: scroll()；Chromium 115+、Safari 26+）：只用 CSS，捲動時不跑任何程式
//   - 不支援的：passive 的 scroll 事件，每一格畫面最多一次（requestAnimationFrame）把透明度寫進 --hero-fade。
//     捲動時只讀 scrollY，不讀版面；60% 的距離在掛載與視窗大小改變時量一次
// 減少動態時照樣淡出：只動透明度、沒有位移，而且是跟著手指走的，不是自己播放的動畫（《03》§6、§4.17）
//
// 漸層（顏色都取自 token）：
// - 由上往下 0–34% 透明，60% 是 --bg 的 90%，72% 以下是 --bg：照片融進頁面，標題區讀得到
// - 頂端另一層 --hero-scrim（30% 的黑）到透明（上方 22%）：按鈕在照片上看得清楚
// - **標題區背後再一層，跟著標題區走**（2026-11-26）：從標題頂端往上 --hero-title-fade（88px）由透明漸變到 --bg 的 92%，
//   再 16px 到實底。不論豆名幾行，標題都落在接近實底的位置——上面兩層是照主圖的高度算百分比，
//   豆名三行時標題的上半部會落在只有一半不透明的地方（2026-11-26 截圖確認過）

const props = defineProps<{
  /** 這支豆子有豆袋照片（photo_path）。有的話先留好位置，網址晚到也不跳動 */
  hasPhoto: boolean
  /** 原圖的簽名網址 */
  photoUrl: string | null
  roastLevel: RoastLevel | null
}>()

const loaded = ref(false)
const failed = ref(false)
watch(() => props.photoUrl, () => {
  loaded.value = false
  failed.value = false
})

const fill = computed(() => roastFill(props.roastLevel))
const showPhoto = computed(() => props.hasPhoto && !failed.value)

// ── 隨捲動淡出：不支援 animation-timeline 時的備援 ───────────────
/** 捲過主圖基準高度的這個比例時，影像層完全透明（和 CSS 的 --hero-fade-end 同一個數） */
const FADE_RATIO = 0.6
const root = ref<HTMLElement | null>(null)
let fadeEnd = 1
let frame = 0
let cleanup: (() => void) | null = null

function measure() {
  const el = root.value
  if (!el) return
  // 主圖的 min-height 就是 --hero-h（基準高度，不含豆名很長時撐高的部分），乘上同一個比例
  fadeEnd = Math.max(1, Number.parseFloat(getComputedStyle(el).minHeight) * FADE_RATIO)
  apply()
}
function apply() {
  frame = 0
  const opacity = Math.min(1, Math.max(0, 1 - window.scrollY / fadeEnd))
  root.value?.style.setProperty('--hero-fade', String(Math.round(opacity * 1000) / 1000))
}
function onScroll() {
  if (!frame) frame = requestAnimationFrame(apply)
}

onMounted(() => {
  if (CSS.supports('animation-timeline', 'scroll()')) return
  measure()
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', measure, { passive: true })
  cleanup = () => {
    window.removeEventListener('scroll', onScroll)
    window.removeEventListener('resize', measure)
    cancelAnimationFrame(frame)
  }
})
onBeforeUnmount(() => cleanup?.())
</script>

<template>
  <div ref="root" class="brew-hero">
    <!-- 影像層：隨捲動淡出的只有這一層（圖＋頂端給按鈕用的暗色漸層）。圖是裝飾：豆名就在下面，不重複唸 -->
    <div class="brew-hero__image" aria-hidden="true">
      <div v-if="showPhoto" class="absolute inset-0" :style="{ background: fill.background }">
        <img
          v-if="photoUrl"
          :src="photoUrl"
          alt=""
          class="size-full object-cover"
          :style="{ opacity: loaded ? 1 : 0 }"
          @load="loaded = true"
          @error="failed = true"
        >
      </div>
      <BrewHeroFallback v-else :roast-level="roastLevel" />
      <div class="brew-hero__scrim" />
    </div>

    <!-- 底部融進 --bg 的漸層：不淡出 -->
    <div class="brew-hero__fade" aria-hidden="true" />

    <!-- DOM 順序就是鍵盤順序：actions 在標題區之前（分享 → 完成 → 頁面內容） -->
    <div class="brew-hero__actions">
      <slot name="actions" />
    </div>

    <div class="brew-hero__title">
      <div class="brew-hero__text">
        <slot />
      </div>
    </div>
  </div>
</template>

<style scoped>
.brew-hero {
  --hero-h: min(470px, 58svh);
  --hero-title-fade: 88px;
  /* 捲過這個距離時影像層完全透明（主圖基準高度的 60%；程式裡的 FADE_RATIO 是同一個數） */
  --hero-fade-end: calc(var(--hero-h) * 0.6);
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  min-height: var(--hero-h);
  overflow: hidden;
}
.brew-hero__image {
  position: absolute;
  inset: 0;
  opacity: var(--hero-fade, 1);
}
/* 只用 CSS：捲動連動動畫。animation 的簡寫會把 animation-timeline 重設回 auto，所以 timeline 寫在後面。
   全站減少動態的規則會把 animation-duration 改成 0.01ms：捲動連動的動畫不看時間長度（整段對應捲動的範圍），不受影響 */
@supports (animation-timeline: scroll()) {
  .brew-hero__image {
    animation: brew-hero-fade linear both;
    animation-timeline: scroll(root block);
    animation-range: 0 var(--hero-fade-end);
  }
}
@keyframes brew-hero-fade {
  from { opacity: 1; }
  to { opacity: 0; }
}
.brew-hero__scrim {
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, var(--hero-scrim), color-mix(in srgb, var(--hero-scrim) 0%, transparent) 22%);
}
.brew-hero__fade {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(
      to bottom,
      color-mix(in srgb, var(--bg) 0%, transparent) 0%,
      color-mix(in srgb, var(--bg) 0%, transparent) 34%,
      color-mix(in srgb, var(--bg) 90%, transparent) 60%,
      var(--bg) 72%
    );
}
/* 固定在畫面頂端：距頂 40（主圖的頂端就是畫面頂端之下的安全區）、右緣和分頁列同一條線。疊在所有內容上面 */
.brew-hero__actions {
  position: fixed;
  z-index: 20;
  top: calc(env(safe-area-inset-top) + 40px);
  right: var(--fixed-right);
  display: flex;
  gap: 12px;
}
/* 標題的頂端不高於主圖的 55%（也一定在按鈕 40 ＋ 44 ＋ 12 之下）。isolation：背後那層漸層（z-index −1）留在標題區裡，蓋在圖上面 */
.brew-hero__title {
  position: relative;
  isolation: isolate;
  padding-top: max(96px, calc(var(--hero-h) * 0.55));
}
.brew-hero__text {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-inline: calc(var(--form-gutter) + var(--card-pad));
}
.brew-hero__text::before {
  content: "";
  position: absolute;
  inset: calc(-1 * var(--hero-title-fade)) 0 0;
  z-index: -1;
  pointer-events: none;
  background: linear-gradient(
    to bottom,
    color-mix(in srgb, var(--bg) 0%, transparent) 0,
    color-mix(in srgb, var(--bg) 92%, transparent) var(--hero-title-fade),
    var(--bg) calc(var(--hero-title-fade) + 16px)
  );
}
</style>
