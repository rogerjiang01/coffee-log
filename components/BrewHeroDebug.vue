<script setup lang="ts">
// **診斷用，上線前整段拿掉**（2026-11-27）：這個檔案，加上 BrewHero.vue 裡標「診斷」的幾行。
// 結算頁網址加 ?hero-debug=1 時，在畫面左下角顯示主圖淡出的實際數值，給 iPhone 實機截圖用：
//   scrollY、淡出終點（px）、進度（0–1）、清楚層與模糊層的 opacity（getComputedStyle 讀出來的實際值）、
//   透明度與位移各走哪一條路。按鈕一次捲 50px，方便停在固定的位置截圖。
// 只給開發者看，不是介面文案，不受詞彙表管。

const props = defineProps<{
  /** BrewHero 的根元素：從裡面找兩層圖 */
  root: HTMLElement | null
  /** 淡出終點（px），BrewHero 量好的 */
  fadeEnd: number
  /** 背景的位移走哪一條路 */
  follow: string
}>()

const values = ref({ y: 0, progress: 0, clear: '', blurred: '' })
let frame = 0

function read() {
  frame = 0
  const layer = (name: string) => props.root?.querySelector(`.brew-hero__layer--${name}`)
  const opacity = (el: Element | null | undefined) => (el ? Number(getComputedStyle(el).opacity).toFixed(3) : '—')
  const y = window.scrollY
  values.value = {
    y: Math.round(y * 10) / 10,
    progress: props.fadeEnd > 0 ? Math.min(1, Math.max(0, y / props.fadeEnd)) : 0,
    clear: opacity(layer('clear')),
    blurred: opacity(layer('blurred')),
  }
}
function schedule() {
  if (!frame) frame = requestAnimationFrame(read)
}
function step(dy: number) {
  window.scrollBy({ top: dy, behavior: 'instant' })
}

onMounted(() => {
  read()
  window.addEventListener('scroll', schedule, { passive: true })
  window.addEventListener('resize', schedule, { passive: true })
})
watch(() => props.fadeEnd, schedule)
onBeforeUnmount(() => {
  window.removeEventListener('scroll', schedule)
  window.removeEventListener('resize', schedule)
  cancelAnimationFrame(frame)
})
</script>

<template>
  <div class="hero-debug" aria-hidden="true">
    <div>scrollY {{ values.y }}</div>
    <div>終點 {{ Math.round(fadeEnd * 10) / 10 }} px</div>
    <div>進度 {{ values.progress.toFixed(3) }}</div>
    <div>清楚層 {{ values.clear }}</div>
    <div>模糊層 {{ values.blurred }}</div>
    <div>透明度：JS</div>
    <div>位移：{{ follow }}</div>
    <div class="hero-debug__buttons">
      <button type="button" tabindex="-1" @click="step(-50)">−50</button>
      <button type="button" tabindex="-1" @click="step(50)">＋50</button>
    </div>
  </div>
</template>

<style scoped>
.hero-debug {
  position: fixed;
  z-index: 100;
  left: 8px;
  bottom: calc(env(safe-area-inset-bottom) + 8px);
  padding: 8px 10px;
  border-radius: 8px;
  background: rgb(0 0 0 / 0.92);
  color: #fff;
  font: 12px/1.45 ui-monospace, Menlo, monospace;
  pointer-events: auto;
}
.hero-debug__buttons {
  display: flex;
  gap: 6px;
  margin-top: 6px;
}
.hero-debug__buttons button {
  min-width: 44px;
  min-height: 32px;
  border-radius: 6px;
  background: rgb(255 255 255 / 0.2);
  color: #fff;
}
</style>
