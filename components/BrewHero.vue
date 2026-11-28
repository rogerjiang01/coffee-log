<script setup lang="ts">
// 主圖（《03》§4.17、§4.17.1，Figma 結算頁 v2：3626:1493、3628:1544；豆子詳情 3649:1552）。
// **結算頁與豆子詳情共用這一份**（2026-11-27）：兩頁的行為、數值完全相同，差別只在 slot 裡放什麼。
//
// **只負責版面、漸層、按鈕的位置與照片放大，不碰「沒有照片時」那張圖的內容**——那是 BrewHeroFallback 的事，之後換圖只改它。
//
// 版面：
// - 滿版：放在沒有左右內距的容器裡（結算頁、豆子詳情的 main），手機上左右貼齊螢幕；寬螢幕時跟著容器，最多 --content-max
// - 高度以 390 寬時 470 為準，矮螢幕用 svh 限高：min(470px, 58svh)（--hero-h），iPhone 第一屏看得到比較區的標題。
//   這是最小高度：豆名很長時標題區把主圖撐高
// - 標題區（預設 slot）壓在主圖底部，左右內距 ＝ 頁面的左右內距（--form-gutter）＋ --card-pad，
//   和下面的段落標題、卡片裡的列文字同一條線（2026-11-26）
// - **標題的頂端不高於主圖的 55%**（--hero-h × 0.55）：圖的重點內容在上方 55%（《03》§4.17.1），
//   豆名很長時主圖往下長，不往上蓋（2026-11-26）。沒照片時是滿版的豆子圖樣（2026-11-28，BrewHeroFallback），跟著鋪滿
// - 右上角的按鈕（actions slot，結算頁的分享＋完成；豆子詳情沒有）：間距 12，距頂 40（和改版前的完成鈕同一個位置）、距右 20。
//   **固定在畫面上**（position: fixed，2026-11-26）：不跟著捲走，背景淡掉之後直接浮在內容上。陰影是 --header-button-shadow（按鈕自己的 floating；2026-11-28）
//   右緣用 --fixed-right（和分頁列、浮動按鈕同一條線：寬螢幕時跟著內容欄，橫向時避開安全區）
//   豆子詳情左上角的返回鈕不在這裡：讀取中、找不到時也要有，由頁面自己放在同一個高度（距頂 40）
//
// 照片放大（2026-11-27）：有照片、而且照片已經載入時，影像區（標題區上方、不含右上角與頁面放的返回鈕）是一顆按鈕，
// 名稱「放大豆袋照片」，點下去開 PhotoViewer（和紀錄詳情的縮圖同一個檢視器），看的是原圖。
// 沒有照片（BrewHeroFallback）、網址還沒拿到、圖還沒載完、載入失敗時沒有這顆按鈕：不能點、也不能聚焦
//
// 圖：
// - 有豆袋照片（hasPhoto）：用原圖（photoUrl，不用 384 的縮圖），放在正方形的照片框裡（寬＝主圖寬，貼齊頂端，2026-11-27 第二版），
//   object-fit: cover、置中。框以下到漸層的實底是 --bg：照片的大小不跟著背景層的高度變（見樣式的 .brew-hero__photo）。
//   網址還沒拿到、圖還沒載完時，底下先是烘焙度底色，版面不跳動。載入失敗時換成 BrewHeroFallback
// - 沒有照片：BrewHeroFallback
//
// **固定背景＋捲動時模糊淡出**（2026-11-26 第三版，參考 iOS 健身 App 的體能訓練摘要頁）：
// - 背景層（照片或 BrewHeroFallback、頂端給按鈕用的 --hero-scrim、融進 --bg 的漸層）**看起來固定在畫面頂端**，不跟著捲動。
//   支援捲動連動動畫時是 absolute 加上抵銷捲動的平移，不是 position: fixed——iOS 26 的 Safari 會拿貼頂的 fixed 元素的底色填狀態列（見樣式）
//   這個元件本身留在版面裡當佔位（高度照舊），標題區、小數據列與下面的內容是上層，捲動時從背景上滑過去。上層不鋪底色（卡片照舊有自己的底）
// - 捲動時照片同時模糊和淡出：模糊從 0 到 --hero-blur-end（20px），**照片**的透明度從 1 到 --hero-opacity-end（0：捲到終點時照片完全淡掉，2026-11-27）。兩個都可以調。
//   **漸層的 --bg 不跟著淡出**（2026-11-26 第五版）：漸層疊在兩份照片上面、本身不動，已經是實底的地方捲到哪裡都是實底
// - **不每一幀改 filter**：兩層疊起來——上層是清楚的圖，下層是預先套好靜態模糊的同一張圖，捲動時只改兩層的透明度
//   （清楚的那層淡掉、模糊的那層接手，再一起淡出；比例怎麼算見 utils/heroFade.ts）。只動 opacity，交給合成器
// - 終點是「主圖基準高度的 60%」與「頁面能捲到的最大距離」取較小的那個：捲到底一定到終點
// - **透明度在合成器上跑**（2026-11-27 第二版）。iPhone 實機的經過：
//   1. CSS 的捲動連動動畫（範圍用 min(終點, 100%)、fill、hold）：不是隨捲動漸進，捲過終點時一次跳到結尾
//   2. 改成程式逐格寫透明度：數值正確，但 iOS 捲動期間主執行緒被節流（錄影逐格看：有時連續約 6 格、100ms 不更新再跳一大格），有段落感
//   背景的抵銷平移（範圍 0–10000px 的捲動時間軸）在實機上完全平順，所以透明度改用同一個模式：
//   時間軸一樣是 0 到 10000px（頁面捲不到，動畫永遠不會結束、不靠 fill），淡出終點依頁面不同，
//   關鍵影格的 offset 由程式換算（終點 ÷ 10000，utils/heroFade.ts 的 heroKeyframes，照 heroLayers 的曲線取樣），終點之後到 1 都是終點的值。
//   range 裡沒有 min() 也沒有 CSS 變數運算。三條路，依序挑第一條可用的：
//     WAAPI              element.animate ＋ ScrollTimeline，rangeStart 0px、rangeEnd 10000px
//     CSS 動態 keyframes  沒有 ScrollTimeline 的 JS 介面（或不支援 rangeStart）但支援 animation-timeline：程式產生 @keyframes 插進 <style>，
//                        用和平移相同的 animation-timeline: scroll(root block)、animation-range: 0px 10000px 套上去
//     JS                 都不支援：passive 的 scroll 事件，每一格畫面最多一次（requestAnimationFrame）把兩層的透明度寫進 --hero-clear／--hero-blurred，進度限制在 0 到 1
//   終點只在掛載、視窗大小與頁面高度改變（ResizeObserver）時量，量到不同的值才重建動畫；前兩條路捲動期間不跑任何程式
// - 背景的「固定」（抵銷捲動的平移）維持 CSS 的捲動連動動畫：實機上正常，而且位移晚一幀會抖（見樣式）
// 減少動態時照樣模糊淡出：只有透明度與靜態的模糊、沒有位移，而且跟著手指走（《03》§6、§4.17）
//
// 漸層（2026-11-26 第五版：只有一條，拿掉標題區背後跟著捲動的那一層）：
// - **試看版，2026-11-27，待 iPhone 確認**：整條往下平移 --hero-fade-shift（50px），下面三個位置都再加 50px（見樣式的 .brew-hero__fade）
// - 由上往下只會越來越不透明：照片區透明 → 標題頂端之上 --hero-fade-len（88px）開始緩和地變成 --bg →
//   標題頂端是 --bg 的 90% → 在 solidAt（頁面傳進來的第一個段落）的頂端剛好 100%，以下都是 100%。
//   結算頁是「和 M/D 那一杯相比」或第一杯的「沖煮參數」；豆子詳情是「豆子資訊」（沒有的話是下一段）
// - 兩個位置隨豆名長度改變，**掛載時與版面改變時量**（ResizeObserver），寫進 --hero-title-top、--hero-solid（從主圖頂端起算）
// - 背景層（兩份照片與漸層）的高度一路蓋到 --hero-solid。照片本身是正方形的框（寬＝主圖寬），框的下緣落在漸層幾乎不透明的地方，看不到硬邊
// - 頂端另一層 --hero-scrim（30% 的黑）到透明（上方 22%）：按鈕在照片上看得清楚。清楚與模糊的兩層各有一份，交叉淡化時深淺不變

const props = defineProps<{
  /** 這支豆子有豆袋照片（photo_path）。有的話先留好位置，網址晚到也不跳動 */
  hasPhoto: boolean
  /** 原圖的簽名網址 */
  photoUrl: string | null
  roastLevel: RoastLevel | null
  /** 漸層剛好到實底的位置：這個元素的頂端（頁面的第一個段落）。沒有時是主圖的底 */
  solidAt?: HTMLElement | null
  /** 放大檢視時照片的替代文字：豆名 */
  alt: string
}>()

const loaded = ref(false)
const failed = ref(false)
const zoomOpen = ref(false)
watch(() => props.photoUrl, () => {
  loaded.value = false
  failed.value = false
})

const fill = computed(() => roastFill(props.roastLevel))
const showPhoto = computed(() => props.hasPhoto && !failed.value)
/** 照片放大：有照片、而且原圖已經載入（佔位圖、還沒載完、載入失敗時沒有按鈕） */
const zoomable = computed(() => showPhoto.value && !!props.photoUrl && loaded.value)

// ── 漸層的兩個位置：標題頂端與實底的位置（兩條路都要）───────────────
const root = ref<HTMLElement | null>(null)
const text = ref<HTMLElement | null>(null)

function measureLayout() {
  const el = root.value
  if (!el || !text.value) return
  // 兩個都是相對於主圖頂端的距離：兩邊一起捲，捲到哪裡量都一樣
  const top = el.getBoundingClientRect().top
  const titleTop = text.value.getBoundingClientRect().top - top
  const solid = (props.solidAt ? props.solidAt.getBoundingClientRect().top : el.getBoundingClientRect().bottom) - top
  el.style.setProperty('--hero-title-top', `${Math.round(titleTop)}px`)
  el.style.setProperty('--hero-solid', `${Math.round(Math.max(solid, titleTop))}px`)
}

// ── 捲動時模糊淡出 ─────────────────────────────────────
/** 捲過主圖基準高度的這個比例時到終點 */
const FADE_RATIO = 0.6
type FadePath = 'WAAPI' | 'CSS 動態 keyframes' | 'JS'
type ScrollTimelineCtor = new (options: { source: Element, axis: 'block' }) => AnimationTimeline
let path: FadePath = 'JS'
let fadeEnd = 1
let opacityEnd = 0
let built = ''
let animations: Animation[] = []
let styleEl: HTMLStyleElement | null = null
let keyframesId = 0
let frame = 0
let observer: ResizeObserver | null = null
let cleanup: (() => void) | null = null

function pickPath(): FadePath {
  const ctor = (globalThis as { ScrollTimeline?: ScrollTimelineCtor }).ScrollTimeline
  if (typeof ctor === 'function' && 'rangeStart' in Animation.prototype) return 'WAAPI'
  if (CSS.supports('animation-timeline', 'scroll()')) return 'CSS 動態 keyframes'
  return 'JS'
}

function layers() {
  const el = root.value
  return {
    clear: el?.querySelector<HTMLElement>('.brew-hero__layer--clear') ?? null,
    blurred: el?.querySelector<HTMLElement>('.brew-hero__layer--blurred') ?? null,
  }
}

function teardown() {
  for (const animation of animations) animation.cancel()
  animations = []
  styleEl?.remove()
  styleEl = null
  const { clear, blurred } = layers()
  for (const el of [clear, blurred]) {
    el?.style.removeProperty('animation')
    el?.style.removeProperty('animation-timeline')
    el?.style.removeProperty('animation-range')
  }
}

/** 照量到的終點建兩層的動畫（合成器的兩條路）。終點沒變就不重建 */
function build() {
  const key = `${path}|${fadeEnd.toFixed(1)}|${opacityEnd}`
  if (key === built) return
  const { clear, blurred } = layers()
  if (!clear || !blurred) return
  teardown()
  built = key
  const frames = heroKeyframes(fadeEnd, opacityEnd)
  if (path === 'WAAPI') {
    const Timeline = (globalThis as { ScrollTimeline?: ScrollTimelineCtor }).ScrollTimeline!
    const timeline = new Timeline({ source: document.documentElement, axis: 'block' })
    const options = { timeline, rangeStart: '0px', rangeEnd: `${HERO_TIMELINE_RANGE}px`, fill: 'both', easing: 'linear' } as KeyframeAnimationOptions
    animations = [
      clear.animate(frames.map(f => ({ offset: f.offset, opacity: f.clear })), options),
      blurred.animate(frames.map(f => ({ offset: f.offset, opacity: f.blurred })), options),
    ]
    return
  }
  // CSS 動態 keyframes：名稱每次換新，重建時從新的關鍵影格開始
  const id = ++keyframesId
  const css = (name: string, key: 'clear' | 'blurred') =>
    `@keyframes ${name}{${frames.map(f => `${(f.offset * 100).toFixed(5)}%{opacity:${f[key].toFixed(4)}}`).join('')}}`
  styleEl = document.createElement('style')
  styleEl.textContent = css(`brew-hero-clear-${id}`, 'clear') + css(`brew-hero-blurred-${id}`, 'blurred')
  document.head.append(styleEl)
  for (const [el, name] of [[clear, `brew-hero-clear-${id}`], [blurred, `brew-hero-blurred-${id}`]] as const) {
    // animation 的簡寫會把 timeline 重設回 auto：timeline 寫在後面
    el.style.setProperty('animation', `${name} linear both`)
    el.style.setProperty('animation-timeline', 'scroll(root block)')
    el.style.setProperty('animation-range', `0px ${HERO_TIMELINE_RANGE}px`)
  }
}

function measure() {
  measureLayout()
  const el = root.value
  if (!el) return
  const style = getComputedStyle(el)
  // 主圖的 min-height 就是 --hero-h（基準高度，不含豆名很長時撐高的部分），乘上同一個比例；
  // 頁面能捲的距離比它短時，以捲到底為終點
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight
  fadeEnd = Math.max(1, Math.min(Number.parseFloat(style.minHeight) * FADE_RATIO, maxScroll))
  opacityEnd = Number.parseFloat(style.getPropertyValue('--hero-opacity-end')) || 0
  if (path === 'JS') apply()
  else build()
}
/** JS 路徑：每一格畫面最多一次 */
function apply() {
  frame = 0
  // 進度限制在 0 到 1：過了終點維持終點的樣子（回彈時的負值也是起點）
  const t = Math.min(1, Math.max(0, window.scrollY / fadeEnd))
  const { clear, blurred } = heroLayers(t, opacityEnd)
  root.value?.style.setProperty('--hero-clear', String(Math.round(clear * 1000) / 1000))
  root.value?.style.setProperty('--hero-blurred', String(Math.round(blurred * 1000) / 1000))
}
function onScroll() {
  if (!frame) frame = requestAnimationFrame(apply)
}

function observe() {
  if (!observer) return
  observer.disconnect()
  // 主圖（豆名換行）、第一個段落所在的內容區（小數據列換行）、整頁（能捲的距離）
  if (root.value) observer.observe(root.value)
  if (props.solidAt?.parentElement) observer.observe(props.solidAt.parentElement)
  observer.observe(document.body)
}

onMounted(() => {
  path = pickPath()
  observer = new ResizeObserver(() => measure())
  observe()
  measure()
  window.addEventListener('resize', measure, { passive: true })
  // 只有 JS 路徑要聽捲動
  if (path === 'JS') window.addEventListener('scroll', onScroll, { passive: true })
  cleanup = () => {
    window.removeEventListener('scroll', onScroll)
    window.removeEventListener('resize', measure)
    observer?.disconnect()
    cancelAnimationFrame(frame)
    teardown()
  }
})
watch(() => props.solidAt, () => {
  observe()
  measure()
})
onBeforeUnmount(() => cleanup?.())
</script>

<template>
  <div ref="root" class="brew-hero">
    <!-- 背景層：固定在畫面頂端，不跟著捲動。圖是裝飾：豆名就在下面，不重複唸 -->
    <div class="brew-hero__bg" aria-hidden="true">
      <!-- 下層：預先套好靜態模糊的同一張圖。
           有照片：照片框（正方形、寬度＝主圖寬）底下鋪烘焙度底色，框以下是 --bg；模糊的邊緣因為放大落在框外、被框裁掉。
           沒有照片：整層鋪烘焙度底色，模糊後變透明的邊緣透出來的是同一個顏色 -->
      <div class="brew-hero__layer brew-hero__layer--blurred" :style="{ background: showPhoto ? 'var(--bg)' : fill.background }">
        <div v-if="showPhoto" class="brew-hero__photo" :style="{ background: fill.background }">
          <img
            v-if="photoUrl"
            :src="photoUrl"
            alt=""
            class="brew-hero__blur brew-hero__blur--photo size-full object-cover"
            :style="{ opacity: loaded ? 1 : 0 }"
          >
        </div>
        <BrewHeroFallback v-else class="brew-hero__blur" :roast-level="roastLevel" />
        <div class="brew-hero__scrim" />
      </div>
      <!-- 上層：清楚的圖。捲動時先淡掉，模糊的那層接手 -->
      <div class="brew-hero__layer brew-hero__layer--clear" :style="{ background: showPhoto ? 'var(--bg)' : undefined }">
        <!-- 照片框：正方形、寬度＝主圖寬，貼齊背景層頂端（和上傳時的裁切比例一致）。框以下到 --hero-solid 是 --bg，漸層蓋在上面 -->
        <div v-if="showPhoto" class="brew-hero__photo" :style="{ background: fill.background }">
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
      <!-- 融進 --bg 的漸層：疊在兩份照片上面，不淡出 -->
      <div class="brew-hero__fade" />
    </div>

    <!-- DOM 順序就是鍵盤順序：actions、放大照片在標題區之前
         （結算頁：分享 → 完成 → 放大照片 → 頁面內容；豆子詳情：頁面的返回鈕 → 放大照片 → 頁面內容） -->
    <div v-if="$slots.actions" class="brew-hero__actions">
      <slot name="actions" />
    </div>

    <!-- 照片放大：影像區（標題區上方）整塊是一顆按鈕。看不到的按鈕：照片就是它的外觀，名稱只給螢幕閱讀器 -->
    <button
      v-if="zoomable"
      type="button"
      class="brew-hero__zoom"
      aria-label="放大豆袋照片"
      @click="zoomOpen = true"
    />
    <PhotoViewer v-if="showPhoto && photoUrl" v-model:open="zoomOpen" :src="photoUrl" :alt="alt" />

    <!-- 上層的第一段：標題區。跟著頁面捲動，從背景上滑過去 -->
    <div class="brew-hero__title">
      <div ref="text" class="brew-hero__text">
        <slot />
      </div>
    </div>
  </div>
</template>

<style scoped>
.brew-hero {
  --hero-h: min(470px, 58svh);
  /* 漸層：標題頂端之上這段距離開始變成 --bg（2026-11-26 第五版；和拿掉的那層墊底同一個距離） */
  --hero-fade-len: 88px;
  /* 漸層整條往下平移的距離（**試看版，2026-11-27，待 iPhone 確認**）。
     透明的起點、標題頂端的 90%、--hero-solid 的 100% 三個位置都加上這個值，中間各點照比例跟著移；曲線、長度、各點的不透明度不變。
     背景層的高度也多這麼多，漸層不會在背景層底部被切掉。照片框、照片下緣的遮罩、頂端的 scrim、按鈕、標題區的位置都不動。
     這一版不以對比為條件：標題區每一行背後的不透明度比原本低（原本標題頂端是 90%） */
  --hero-fade-shift: 50px;
  /* 量到之前的預設（掛載時就會量，通常看不到）：標題頂端在 55%，實底在主圖底下 120px */
  --hero-title-top: max(96px, calc(var(--hero-h) * 0.55));
  --hero-solid: calc(var(--hero-h) + 120px);
  /* **終點的模糊與照片的透明度：在手機上看過再調**（2026-11-26）。模糊是下層預先套好的靜態模糊；
     --hero-blur-scale 把模糊的那張圖放大一點，模糊後變透明的邊緣落在框外（模糊加大時這個也要跟著加）。
     --hero-opacity-end 只管兩份照片，不管漸層的 --bg。0（2026-11-27）：0.3 不符合文字對比，0.04 已經看不出來 */
  --hero-blur-end: 20px;
  --hero-opacity-end: 0;
  --hero-blur-scale: 1.2;
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  min-height: var(--hero-h);
}
/* 背景層：看起來固定在畫面頂端。z-index 0：上層（標題區、結算頁下面的內容）是 z-index 1，從它上面滑過去。
   **高度一路蓋到漸層的實底**（--hero-solid，2026-11-26 第五版）。照片不跟著這個高度放大：正方形的照片框（.brew-hero__photo，寬＝主圖寬）貼齊頂端，
   框以下是 --bg（2026-11-27 第二版）。沒有照片時是滿版的豆子圖樣，跟著背景層一路鋪下去（BrewHeroFallback，2026-11-28）
   **不用 position: fixed 的寫法**（2026-11-26 第四版）：iOS 26 的 Safari 不再看 theme-color，改成拿貼著畫面頂端的
   fixed／sticky 元素的底色填狀態列——這一層（裡面鋪著烘焙度底色）會讓狀態列變成一塊深咖啡色。所以支援捲動連動動畫的瀏覽器
   （Safari 26 正是從這一版開始兩者都有）改成 absolute，跟著頁面捲走，再用捲動連動動畫往下平移同樣的距離抵銷：
   看起來不動，Safari 也不會把它當成固定在頂端的元素。只有 transform 跟著捲動，和兩層的 opacity 一樣交給合成器。
   不支援的瀏覽器（iOS 18 以前，還在用 theme-color、沒有這條取色規則）維持 fixed：用程式逐格平移一定會抖，不這樣做。
   fixed 時左右和主圖原本的位置一樣：手機上貼齊螢幕，寬螢幕時是內容欄（--fixed-left／right 是內容欄的文字線，減掉頁面內距就是欄的邊緣） */
.brew-hero__bg {
  position: fixed;
  z-index: 0;
  top: env(safe-area-inset-top);
  left: calc(var(--fixed-left) - var(--form-gutter));
  right: calc(var(--fixed-right) - var(--form-gutter));
  /* + --hero-fade-shift：漸層往下平移之後，100% 的點在 --hero-solid 之下這麼遠（試看版，2026-11-27，待 iPhone 確認） */
  height: calc(max(var(--hero-h), var(--hero-solid)) + var(--hero-fade-shift));
  overflow: hidden;
  pointer-events: none;
}
/* 抵銷捲動（樣式裡唯一的捲動連動動畫；兩層的透明度用同一個 0–10000px 的時間軸，但動畫由程式建，見 script）：從頂端起算的平移量 ＝ 捲動距離。範圍 0 到 --hero-follow（10000px），平移也是 0 到 10000px，所以兩者一比一；
   這段範圍比頁面能捲的距離長得多，捲到底也不會走完（不會進入「結束之後」，不靠 fill 維持）。
   平移出去的部分會撐大頁面的捲動範圍、越捲越長，所以結算頁的 main 是 overflow: clip（summary.vue），這一層不會撐到 main 外面 */
@supports (animation-timeline: scroll()) {
  .brew-hero__bg {
    --hero-follow: 10000px;
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    will-change: transform;
    animation: brew-hero-follow linear both;
    animation-timeline: scroll(root block);
    animation-range: 0 var(--hero-follow);
  }
}
@keyframes brew-hero-follow {
  from { transform: translateY(0); }
  to { transform: translateY(var(--hero-follow)); }
}
.brew-hero__layer {
  position: absolute;
  inset: 0;
  overflow: hidden;
  will-change: opacity;
}
/* 兩層的透明度：合成器的兩條路由程式建的捲動動畫決定（WAAPI 或動態 @keyframes，見 script）；
   JS 路徑由程式寫進 --hero-clear／--hero-blurred（utils/heroFade.ts）。動畫建好、變數寫進去之前是捲動 0 的樣子 */
.brew-hero__layer--clear {
  opacity: var(--hero-clear, 1);
}
.brew-hero__layer--blurred {
  opacity: var(--hero-blurred, 1);
}
/* 照片框（2026-11-27 第二版）：**大小以主圖的寬度為準，不跟著背景層的高度放大**。
   背景層一路蓋到 --hero-solid（豆名、小數據越多越高），原本照片 cover 整個背景層：正方形照片被放大到背景層的高度、左右裁掉一大段，
   清楚看得到的只剩上方約三分之一。改成正方形的框（寬＝主圖寬、高＝寬，和上傳時的裁切比例一致），貼齊背景層頂端，
   cover、置中（舊的非正方形照片也這樣裁）；框以下是圖層自己的 --bg，漸層照舊蓋在上面，照片下緣落在漸層幾乎不透明的地方。
   overflow: hidden：模糊那一份放大 --hero-blur-scale 倍，邊緣落在框外、被框裁掉。
   **下緣淡出**（2026-11-27 第三版）：漸層在照片下緣只有 95.7–99.5% 不透明，照片與 --bg 的交界看得到一條線。
   不改頁面的漸層，改成照片框自己的下緣淡出：遮罩上方完全不透明，最下面 --hero-photo-fade 的高度用 smoothstep 變成透明（交界看不出來）。
   清楚與模糊兩份各在自己的圖層裡（兩層的透明度各自有動畫），兩個框是同一個 class，所以是同一個遮罩；模糊那份超出框的部分先被裁掉、再一起淡出。
   遮罩是靜態的，不碰透明度的動畫。遮罩只看透明度，顏色寫 black／rgb(0 0 0 / a) 沒有意義上的差別 */
.brew-hero__photo {
  --hero-photo-fade: 20%;
  --g: calc(100% - var(--hero-photo-fade));
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  aspect-ratio: 1;
  overflow: hidden;
  -webkit-mask-image: linear-gradient(
    to bottom,
    black var(--g),
    rgb(0 0 0 / 0.844) calc(var(--g) + var(--hero-photo-fade) * 0.25),
    rgb(0 0 0 / 0.5) calc(var(--g) + var(--hero-photo-fade) * 0.5),
    rgb(0 0 0 / 0.156) calc(var(--g) + var(--hero-photo-fade) * 0.75),
    transparent 100%
  );
  mask-image: linear-gradient(
    to bottom,
    black var(--g),
    rgb(0 0 0 / 0.844) calc(var(--g) + var(--hero-photo-fade) * 0.25),
    rgb(0 0 0 / 0.5) calc(var(--g) + var(--hero-photo-fade) * 0.5),
    rgb(0 0 0 / 0.156) calc(var(--g) + var(--hero-photo-fade) * 0.75),
    transparent 100%
  );
}
/* 靜態的模糊：只在這一層、只算一次，捲動時不改 */
.brew-hero__blur {
  filter: blur(var(--hero-blur-end));
}
.brew-hero__blur--photo {
  scale: var(--hero-blur-scale);
}
.brew-hero__scrim {
  position: absolute;
  /* 底部讓出 --hero-fade-shift：scrim 的漸層是框高的 22%，背景層多出來的那一段不能把它拉長（試看版，2026-11-27，待 iPhone 確認） */
  inset: 0 0 var(--hero-fade-shift);
  background: linear-gradient(to bottom, var(--hero-scrim), color-mix(in srgb, var(--hero-scrim) 0%, transparent) 22%);
}
/* 漸層（2026-11-26 第五版）：一條，由上往下只會越來越不透明。位置都從背景層頂端（＝主圖頂端）起算：
     --hero-title-top − --hero-fade-len  之前透明（照片露出來的部分）
     到 --hero-title-top                緩和地（smoothstep：3t² − 2t³）到 --bg 的 90%
     到 --hero-solid                    減速（1 − (1 − t)²）到 100%，以下都是 100%（背景層的高度就到這裡）
   兩段都是 0、25、50、75、100% 五個點，中間線性內插。標題頂端的 90% 與 88px 照拆掉的那層墊底（92%、88px），
   捲動前的文字對比量過（《03》§4.17）。不淡出：已經是實底的地方捲到哪裡都是實底。
   will-change：和兩份照片一樣自成一層（長頁面捲到底時，背景層本身的位置早就在畫面外） */
.brew-hero__fade {
  /* 三個位置都加上 --hero-fade-shift：整條往下平移（**試看版，2026-11-27，待 iPhone 確認**） */
  --g0: calc(var(--hero-title-top) - var(--hero-fade-len) + var(--hero-fade-shift));
  --g1: calc(var(--hero-title-top) + var(--hero-fade-shift));
  --g2: calc(var(--hero-solid) + var(--hero-fade-shift));
  position: absolute;
  inset: 0;
  will-change: opacity;
  background:
    linear-gradient(
      to bottom,
      color-mix(in srgb, var(--bg) 0%, transparent) var(--g0),
      color-mix(in srgb, var(--bg) 14%, transparent) calc(var(--g0) + (var(--g1) - var(--g0)) * 0.25),
      color-mix(in srgb, var(--bg) 45%, transparent) calc(var(--g0) + (var(--g1) - var(--g0)) * 0.5),
      color-mix(in srgb, var(--bg) 76%, transparent) calc(var(--g0) + (var(--g1) - var(--g0)) * 0.75),
      color-mix(in srgb, var(--bg) 90%, transparent) var(--g1),
      color-mix(in srgb, var(--bg) 94.4%, transparent) calc(var(--g1) + (var(--g2) - var(--g1)) * 0.25),
      color-mix(in srgb, var(--bg) 97.5%, transparent) calc(var(--g1) + (var(--g2) - var(--g1)) * 0.5),
      color-mix(in srgb, var(--bg) 99.4%, transparent) calc(var(--g1) + (var(--g2) - var(--g1)) * 0.75),
      var(--bg) var(--g2)
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
/* 照片放大的按鈕：主圖頂端到標題區頂端（和 .brew-hero__title 的 padding-top 同一個值），左右滿版。
   z-index 2：標題區（z-index 1）的上內距和它重疊，要在它上面才點得到；右上角的按鈕與頁面的返回鈕是 20，在它上面。
   跟著頁面捲動（背景不動）：捲動之後可以點的範圍是標題區上方還留在畫面上的那一段。
   焦點框畫在內側：外側是螢幕邊緣，看不到 */
.brew-hero__zoom {
  position: absolute;
  z-index: 2;
  top: 0;
  left: 0;
  right: 0;
  height: max(96px, calc(var(--hero-h) * 0.55));
  cursor: zoom-in;
  -webkit-tap-highlight-color: transparent;
}
.brew-hero__zoom:focus-visible {
  outline-offset: -4px;
}
/* 標題的頂端不高於主圖的 55%（也一定在按鈕 40 ＋ 44 ＋ 12 之下）。
   z-index 1：上層，捲動時從固定的背景上滑過去。背後沒有自己的墊底（2026-11-26 第五版拿掉）：可讀性靠背景層的漸層 */
.brew-hero__title {
  position: relative;
  z-index: 1;
  padding-top: max(96px, calc(var(--hero-h) * 0.55));
}
.brew-hero__text {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-inline: calc(var(--form-gutter) + var(--card-pad));
}
</style>
