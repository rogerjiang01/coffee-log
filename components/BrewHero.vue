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
//   **固定在畫面上**（position: fixed，2026-11-26）：不跟著捲走，背景淡掉之後直接浮在內容上。陰影是 --float-shadow（按鈕自己的 floating）
//   右緣用 --fixed-right（和分頁列、浮動按鈕同一條線：寬螢幕時跟著內容欄，橫向時避開安全區）
//
// 圖：
// - 有豆袋照片（hasPhoto）：用原圖（photoUrl，不用 384 的縮圖），object-fit: cover、置中。
//   網址還沒拿到、圖還沒載完時，底下先是烘焙度底色，版面不跳動。載入失敗時換成 BrewHeroFallback
// - 沒有照片：BrewHeroFallback
//
// **固定背景＋捲動時模糊淡出**（2026-11-26 第三版，參考 iOS 健身 App 的體能訓練摘要頁）：
// - 背景層（照片或 BrewHeroFallback、頂端給按鈕用的 --hero-scrim、融進 --bg 的漸層）**看起來固定在畫面頂端**，不跟著捲動。
//   支援捲動連動動畫時是 absolute 加上抵銷捲動的平移，不是 position: fixed——iOS 26 的 Safari 會拿貼頂的 fixed 元素的底色填狀態列（見樣式）
//   這個元件本身留在版面裡當佔位（高度照舊），標題區、小數據列與下面的內容是上層，捲動時從背景上滑過去。上層不鋪底色（卡片照舊有自己的底）
// - 捲動時照片同時模糊和淡出：模糊從 0 到 --hero-blur-end（20px），**照片**的透明度從 1 到 --hero-opacity-end（0.3）。兩個都可以調。
//   **漸層的 --bg 不跟著淡出**（2026-11-26 第五版）：漸層疊在兩份照片上面、本身不動，已經是實底的地方捲到哪裡都是實底
// - **不每一幀改 filter**：兩層疊起來——上層是清楚的圖，下層是預先套好靜態模糊的同一張圖，捲動時只改兩層的透明度
//   （清楚的那層淡掉、模糊的那層接手，再一起淡出；比例怎麼算見 utils/heroFade.ts）。只動 opacity，交給合成器
// - 終點是「主圖基準高度的 60%」與「頁面能捲到的最大距離」取較小的那個：捲到底一定到終點。
//   **終點之後維持終點的樣子**（2026-11-26 第五版）：見樣式裡的 brew-hero-*-hold
// 兩條路：
//   - 支援捲動連動動畫的瀏覽器（animation-timeline: scroll()；Chromium 115+、Safari 26+）：只用 CSS，捲動時不跑任何程式
//   - 不支援的：passive 的 scroll 事件，每一格畫面最多一次（requestAnimationFrame）把兩層的透明度寫進 --hero-clear／--hero-blurred。
//     捲動時只讀 scrollY，不讀版面；終點在掛載、視窗大小改變與頁面高度改變（ResizeObserver）時量一次。進度限制在 0 到 1
// 減少動態時照樣模糊淡出：只有透明度與靜態的模糊、沒有位移，而且跟著手指走（《03》§6、§4.17）
//
// 漸層（2026-11-26 第五版：只有一條，拿掉標題區背後跟著捲動的那一層）：
// - 由上往下只會越來越不透明：照片區透明 → 標題頂端之上 --hero-fade-len（88px）開始緩和地變成 --bg →
//   標題頂端是 --bg 的 90% → 在 solidAt（結算頁傳進來的第一個段落：「和 M/D 那一杯相比」或第一杯的「沖煮參數」）的頂端剛好 100%，以下都是 100%
// - 兩個位置隨豆名長度改變，**掛載時與版面改變時量**（ResizeObserver），寫進 --hero-title-top、--hero-solid（從主圖頂端起算）
// - 背景層（兩份照片與漸層）的高度一路蓋到 --hero-solid：照片在中間不會有硬邊
// - 頂端另一層 --hero-scrim（30% 的黑）到透明（上方 22%）：按鈕在照片上看得清楚。清楚與模糊的兩層各有一份，交叉淡化時深淺不變

const props = defineProps<{
  /** 這支豆子有豆袋照片（photo_path）。有的話先留好位置，網址晚到也不跳動 */
  hasPhoto: boolean
  /** 原圖的簽名網址 */
  photoUrl: string | null
  roastLevel: RoastLevel | null
  /** 漸層剛好到實底的位置：這個元素的頂端（結算頁的第一個段落）。沒有時是主圖的底 */
  solidAt?: HTMLElement | null
}>()

const loaded = ref(false)
const failed = ref(false)
watch(() => props.photoUrl, () => {
  loaded.value = false
  failed.value = false
})

const fill = computed(() => roastFill(props.roastLevel))
const showPhoto = computed(() => props.hasPhoto && !failed.value)

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

// ── 捲動時模糊淡出：不支援 animation-timeline 時的備援 ───────────────
/** 捲過主圖基準高度的這個比例時到終點（和 CSS 的 --hero-fade-end 同一個數） */
const FADE_RATIO = 0.6
let fallback = false
let fadeEnd = 1
let opacityEnd = 0
let frame = 0
let observer: ResizeObserver | null = null
let cleanup: (() => void) | null = null

function measure() {
  measureLayout()
  const el = root.value
  if (!el || !fallback) return
  const style = getComputedStyle(el)
  // 主圖的 min-height 就是 --hero-h（基準高度，不含豆名很長時撐高的部分），乘上同一個比例；
  // 頁面能捲的距離比它短時，以捲到底為終點
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight
  fadeEnd = Math.max(1, Math.min(Number.parseFloat(style.minHeight) * FADE_RATIO, maxScroll))
  opacityEnd = Number.parseFloat(style.getPropertyValue('--hero-opacity-end')) || 0
  apply()
}
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
  // 主圖（豆名換行）、第一個段落所在的內容區（小數據列換行）、整頁（不支援時：能捲的距離）
  if (root.value) observer.observe(root.value)
  if (props.solidAt?.parentElement) observer.observe(props.solidAt.parentElement)
  if (fallback) observer.observe(document.body)
}

onMounted(() => {
  fallback = !CSS.supports('animation-timeline', 'scroll()')
  observer = new ResizeObserver(() => measure())
  observe()
  measure()
  window.addEventListener('resize', measure, { passive: true })
  if (fallback) window.addEventListener('scroll', onScroll, { passive: true })
  cleanup = () => {
    window.removeEventListener('scroll', onScroll)
    window.removeEventListener('resize', measure)
    observer?.disconnect()
    cancelAnimationFrame(frame)
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
      <!-- 下層：預先套好靜態模糊的同一張圖。底下鋪烘焙度底色：模糊的邊緣會變透明，透出來的是同一個顏色 -->
      <div class="brew-hero__layer brew-hero__layer--blurred" :style="{ background: fill.background }">
        <img
          v-if="showPhoto && photoUrl"
          :src="photoUrl"
          alt=""
          class="brew-hero__blur brew-hero__blur--photo size-full object-cover"
          :style="{ opacity: loaded ? 1 : 0 }"
        >
        <BrewHeroFallback v-else-if="!showPhoto" class="brew-hero__blur" :roast-level="roastLevel" />
        <div class="brew-hero__scrim" />
      </div>
      <!-- 上層：清楚的圖。捲動時先淡掉，模糊的那層接手 -->
      <div class="brew-hero__layer brew-hero__layer--clear">
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
      <!-- 融進 --bg 的漸層：疊在兩份照片上面，不淡出 -->
      <div class="brew-hero__fade" />
    </div>

    <!-- DOM 順序就是鍵盤順序：actions 在標題區之前（分享 → 完成 → 頁面內容） -->
    <div class="brew-hero__actions">
      <slot name="actions" />
    </div>

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
  /* 量到之前的預設（掛載時就會量，通常看不到）：標題頂端在 55%，實底在主圖底下 120px */
  --hero-title-top: max(96px, calc(var(--hero-h) * 0.55));
  --hero-solid: calc(var(--hero-h) + 120px);
  /* 捲過這個距離時到終點（主圖基準高度的 60%；程式裡的 FADE_RATIO 是同一個數）。頁面捲不到這麼遠時以捲到底為終點 */
  --hero-fade-end: calc(var(--hero-h) * 0.6);
  /* **終點的模糊與照片的透明度：在手機上看過再調**（2026-11-26）。模糊是下層預先套好的靜態模糊；
     --hero-blur-scale 把模糊的那張圖放大一點，模糊後變透明的邊緣落在框外（模糊加大時這個也要跟著加）。
     --hero-opacity-end 只管兩份照片，不管漸層的 --bg */
  --hero-blur-end: 20px;
  --hero-opacity-end: 0.3;
  --hero-blur-scale: 1.2;
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  min-height: var(--hero-h);
}
/* 背景層：看起來固定在畫面頂端。z-index 0：上層（標題區、結算頁下面的內容）是 z-index 1，從它上面滑過去。
   **高度一路蓋到漸層的實底**（--hero-solid，2026-11-26 第五版）：照片、模糊那一份、漸層都在這個高度裡，中間不會出現圖片的硬邊。
   照片照樣 object-fit: cover、置中，框比主圖高時裁切跟著框走；沒有照片時三顆豆子仍以主圖的基準高度定位（BrewHeroFallback）
   **不用 position: fixed 的寫法**（2026-11-26 第四版）：iOS 26 的 Safari 不再看 theme-color，改成拿貼著畫面頂端的
   fixed／sticky 元素的底色填狀態列——這一層（裡面鋪著烘焙度底色）會讓狀態列變成一塊深咖啡色。所以支援捲動連動動畫的瀏覽器
   （Safari 26 正是從這一版開始兩者都有）改成 absolute，跟著頁面捲走，再用捲動連動動畫往下平移同樣的距離抵銷：
   看起來不動，Safari 也不會把它當成固定在頂端的元素。只有 transform 跟著捲動，和兩層的 opacity 一樣交給合成器。
   不支援的瀏覽器（iOS 18 以前，還在用 theme-color、沒有這條取色規則）維持 fixed：用程式逐格平移一定會抖，不這樣做。
   fixed 時左右和主圖原本的位置一樣：手機上貼齊螢幕，寬螢幕時是內容欄（--fixed-left／right 是內容欄的文字線，減掉頁面內距就是欄的邊緣） */
.brew-hero__bg {
  /* 捲動連動動畫在 25%、50%、75% 的整體透明度 o ＝ 1 − t(1 − 終點)（utils/heroFade.ts） */
  --hero-o25: calc(1 - 0.25 * (1 - var(--hero-opacity-end)));
  --hero-o50: calc(1 - 0.5 * (1 - var(--hero-opacity-end)));
  --hero-o75: calc(1 - 0.75 * (1 - var(--hero-opacity-end)));
  position: fixed;
  z-index: 0;
  top: env(safe-area-inset-top);
  left: calc(var(--fixed-left) - var(--form-gutter));
  right: calc(var(--fixed-right) - var(--form-gutter));
  height: max(var(--hero-h), var(--hero-solid));
  overflow: hidden;
  pointer-events: none;
}
/* 抵銷捲動：從頂端起算的平移量 ＝ 捲動距離。範圍 0 到 --hero-follow（10000px），平移也是 0 到 10000px，所以兩者一比一；
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
.brew-hero__layer--clear {
  opacity: var(--hero-clear, 1);
}
.brew-hero__layer--blurred {
  opacity: var(--hero-blurred, 1);
}
/* 靜態的模糊：只在這一層、只算一次，捲動時不改 */
.brew-hero__blur {
  filter: blur(var(--hero-blur-end));
}
.brew-hero__blur--photo {
  scale: var(--hero-blur-scale);
}
/* 只用 CSS：捲動連動動畫。animation 的簡寫會把 animation-timeline 重設回 auto，所以 timeline 寫在後面。
   終點的 100% 是這條時間軸的全長，也就是頁面能捲到的最大距離：取較小的那個，捲到底一定到終點。
   **終點之後維持終點的樣子：不只靠 fill**（2026-11-26 第五版，iPhone 實機：比較列很多的長頁面捲過終點後，照片突然變回不模糊）。
   每一層各兩段動畫：
     1. brew-hero-clear／-blurred：0 到終點，透明度照式子變
     2. brew-hero-*-hold：終點到 --hero-follow（10000px），透明度固定是終點的值。排在後面，動畫進行中時蓋過第 1 段
   第 2 段的範圍比頁面長，從終點到捲到底一直在「進行中」，不會進入「結束之後」——
   Safari 交給合成器跑的捲動連動動畫，結束之後會從合成器上拿掉（WebKit bug 302157、310806），fill 的值不一定留得住，
   第 1 段只靠 fill: both 的話，長頁面捲過終點就變回原本的透明度（清楚的那層 1：不模糊）。
   第 2 段只有 forwards、沒有 backwards：終點之前不套用，不會蓋掉第 1 段。短頁面終點就是捲到底（100%），第 2 段的範圍從 100% 開始，捲到底時接手。
   全站減少動態的規則會把 animation-duration 改成 0.01ms：捲動連動的動畫不看時間長度（整段對應捲動的範圍），不受影響 */
@supports (animation-timeline: scroll()) {
  .brew-hero__layer--clear {
    animation: brew-hero-clear linear both, brew-hero-clear-hold linear forwards;
    animation-timeline: scroll(root block), scroll(root block);
    animation-range: 0 min(var(--hero-fade-end), 100%), min(var(--hero-fade-end), 100%) var(--hero-follow);
  }
  .brew-hero__layer--blurred {
    animation: brew-hero-blurred linear both, brew-hero-blurred-hold linear forwards;
    animation-timeline: scroll(root block), scroll(root block);
    animation-range: 0 min(var(--hero-fade-end), 100%), min(var(--hero-fade-end), 100%) var(--hero-follow);
  }
}
/* 兩層的透明度（utils/heroFade.ts 的 heroLayers，關鍵影格和 HERO_FADE_STOPS 一致）：
   清楚 c ＝ o(1 − t)；模糊 b ＝ o·t / (1 − c)。看起來的模糊程度是 t、整體透明度是 o，兩個都線性 */
@keyframes brew-hero-clear {
  0% { opacity: 1; }
  25% { opacity: calc(var(--hero-o25) * 0.75); }
  50% { opacity: calc(var(--hero-o50) * 0.5); }
  75% { opacity: calc(var(--hero-o75) * 0.25); }
  100% { opacity: 0; }
}
@keyframes brew-hero-blurred {
  0% { opacity: 1; }
  25% { opacity: calc(var(--hero-o25) * 0.25 / (1 - var(--hero-o25) * 0.75)); }
  50% { opacity: calc(var(--hero-o50) * 0.5 / (1 - var(--hero-o50) * 0.5)); }
  75% { opacity: calc(var(--hero-o75) * 0.75 / (1 - var(--hero-o75) * 0.25)); }
  100% { opacity: var(--hero-opacity-end); }
}
/* 終點之後：固定是終點的值（和上面兩組的 100% 相同） */
@keyframes brew-hero-clear-hold {
  from, to { opacity: 0; }
}
@keyframes brew-hero-blurred-hold {
  from, to { opacity: var(--hero-opacity-end); }
}
.brew-hero__scrim {
  position: absolute;
  inset: 0;
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
  --g0: calc(var(--hero-title-top) - var(--hero-fade-len));
  --g1: var(--hero-title-top);
  --g2: var(--hero-solid);
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
