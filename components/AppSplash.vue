<script setup lang="ts">
// 已登入時的開場（《03》§6.1）：首圖蓋在總覽上，資料準備好就淡出。
//
// 順序（2026-11-16 手機實測後改）：
//   1. 首圖（含 logo）整張淡出。**底下只看得到頁面底色**——這段期間總覽是藏起來的
//      （main.css 的 html.splash-app），不會和 logo 疊在一起
//   2. 首圖完全消失之後，總覽才淡入（main.css 的 html.splash-reveal）
//
// 所以分兩層：外層是不透明的頁面底色（--bg），一直蓋著；裡層是首圖、遮罩與 logo，淡出的是裡層。
//
// 最少停 0.3 秒（太短會變成閃一下），最多 0.8 秒（資料還沒到也不再擋）。
// 計時從瀏覽器接手（掛載）開始算：在那之前使用者看到的是伺服器送來的首圖。
// 淡出只動透明度，沒有位移，所以「減少動態」時也一樣（main.css 特別保留這個淡出）。
// 未登入的開場在登入頁自己演（AuthShell.vue）。

const { mode, cover, ready, revealing } = useSplash()

const MIN_MS = 300
const MAX_MS = 800
const FADE_MS = 200

const leaving = ref(false)
const minPassed = ref(false)

function leave() {
  if (leaving.value) return
  leaving.value = true
  window.setTimeout(() => {
    // 首圖完全消失了：拿掉這一層，總覽開始淡入
    revealing.value = true
    mode.value = null
    window.setTimeout(() => { revealing.value = false }, FADE_MS + 50)
  }, FADE_MS)
}

onMounted(() => {
  window.setTimeout(() => { minPassed.value = true }, MIN_MS)
  window.setTimeout(leave, MAX_MS)
})
watch(() => ready.value && minPassed.value, (go) => { if (go) leave() }, { immediate: true })
</script>

<template>
  <div class="app-splash" aria-hidden="true">
    <div class="app-splash__layer splash-fade" :class="{ 'app-splash__layer--leaving': leaving }">
      <img :src="coverUrl(cover)" alt="" class="app-splash__cover">
      <div class="app-splash__scrim" />
      <BrandLogo class="app-splash__logo" />
    </div>
  </div>
</template>

<style scoped>
.app-splash {
  position: fixed;
  inset: 0;
  z-index: 60;
  background: var(--bg);
}
/* 首圖還沒載入時是插畫的深綠（--splash-bg），所以底色放在會淡出的這一層 */
.app-splash__layer {
  position: absolute;
  inset: 0;
  background: var(--splash-bg);
  transition: opacity 200ms var(--motion-ease);
}
.app-splash__layer--leaving {
  opacity: 0;
}
.app-splash__cover {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.app-splash__scrim {
  position: absolute;
  inset: 0;
  background: var(--splash-scrim);
}
/* Cover 的 logo 在 693 高的畫面的 281 處：約 40% */
.app-splash__logo {
  position: absolute;
  top: 40%;
  left: 50%;
  translate: -50% 0;
}
</style>
