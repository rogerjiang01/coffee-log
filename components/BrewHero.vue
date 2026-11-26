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
// - 右上角的按鈕（actions slot）：間距 12，距頂 40（和改版前的完成鈕同一個位置）、距右 20。疊在標題區上面
//
// 圖：
// - 有豆袋照片（hasPhoto）：用原圖（photoUrl，不用 384 的縮圖），object-fit: cover、置中。
//   網址還沒拿到、圖還沒載完時，底下先是烘焙度底色，版面不跳動。載入失敗時換成 BrewHeroFallback
// - 沒有照片：BrewHeroFallback
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
</script>

<template>
  <div class="brew-hero">
    <!-- 圖是裝飾：豆名就在下面，不重複唸 -->
    <div v-if="showPhoto" class="absolute inset-0" :style="{ background: fill.background }" aria-hidden="true">
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
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  min-height: var(--hero-h);
  overflow: hidden;
}
.brew-hero__fade {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(to bottom, var(--hero-scrim), color-mix(in srgb, var(--hero-scrim) 0%, transparent) 22%),
    linear-gradient(
      to bottom,
      color-mix(in srgb, var(--bg) 0%, transparent) 0%,
      color-mix(in srgb, var(--bg) 0%, transparent) 34%,
      color-mix(in srgb, var(--bg) 90%, transparent) 60%,
      var(--bg) 72%
    );
}
.brew-hero__actions {
  position: absolute;
  z-index: 1;
  top: 40px;
  right: 20px;
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
