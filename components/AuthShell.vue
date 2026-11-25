<script setup lang="ts">
// 登入與註冊共用的版面（Figma 的 login，綠底模式）。
//
// 由下到上：首圖（填滿、置中裁切，上面一層 10% 的黑）→ 綠色漸層（上面透明、到 53% 變成 --bg）→ logo 與表單。
// 表單撐滿內容寬度，左右是表單頁的 --form-gutter（20px，Figma 的 login 新版：390 寬的畫面裡卡片 350）；
// 寬螢幕最多 --content-max-narrow（2026-11-23；原本固定 300px，手機上長的電子郵件看不完）。
//
// **未登入時的開場**（《03》§6.1 的開場動畫，useSplash 的 'login'）：
// 先只看到首圖與置中的 logo，接著漸層升上來、logo 移到上方，最後表單淡入。兩個時機會演：
//   - 打開 App 落在登入頁：伺服器就把 mode 設好了
//   - 在設定頁按「登出」之後（2026-11-25）：設定頁導向前呼叫 prepareLoginIntro()，這裡掛上時接手
// 其他站內導覽過來的（從註冊頁回來、登入過期被導回來）不演，直接是完成的樣子。
// 「減少動態」時不做位移，只淡入淡出（main.css）。

const { mode, cover, loginIntroPending } = useSplash()

// 登出後的開場：只在登入頁接手（註冊頁也用這個版面）
if (loginIntroPending.value && useRoute().path === '/login') {
  loginIntroPending.value = false
  mode.value = 'login'
}

// intro：開場還沒演完。打開 App 時伺服器送來的 HTML 就是這個狀態，瀏覽器接手之後才開始演
const intro = ref(mode.value === 'login')

const HOLD_MS = 600

let timer: number | undefined

onMounted(() => {
  if (!intro.value) return
  timer = window.setTimeout(() => {
    intro.value = false
    mode.value = null
  }, HOLD_MS)
})

// 開場還沒演完就離開（例如按了返回）：mode 要收回來，不然 <html> 留著 splash-on
onBeforeUnmount(() => {
  window.clearTimeout(timer)
  if (intro.value) mode.value = null
})
</script>

<template>
  <main class="auth" :class="{ 'auth--intro': intro }">
    <img :src="coverUrl(cover)" alt="" class="auth__cover">
    <div class="auth__scrim" />
    <div class="auth__gradient splash-fade" />

    <div class="auth__body">
      <BrandLogo class="auth__logo" />
      <div class="auth__form splash-fade">
        <slot />
      </div>
    </div>
  </main>
</template>

<style scoped>
/* 首圖鋪滿整個畫面，連安全區（狀態列、橫向的瀏海）底下也是：抵銷 body 為安全區留的 padding（main.css），
   logo 與表單再自己往內縮（.auth__body） */
.auth {
  margin: calc(-1 * env(safe-area-inset-top)) calc(-1 * env(safe-area-inset-right)) 0 calc(-1 * env(safe-area-inset-left));
  position: relative;
  min-height: 100dvh;
  overflow: hidden;
  background: var(--splash-bg);
}
.auth__cover {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.auth__scrim {
  position: absolute;
  inset: 0;
  background: var(--splash-scrim);
}
/* 漸層：上面透明，到 53% 變成頁面底色（綠底模式下是 green-500）。
   透明的那一端用 --bg 自己的零透明度，不是 transparent——那是透明的黑，中段會發灰 */
.auth__gradient {
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, color-mix(in srgb, var(--bg) 0%, transparent), var(--bg) 53%);
  transition: opacity 500ms var(--motion-ease), translate 500ms var(--motion-ease);
}
.auth__body {
  position: relative;
  display: flex;
  min-height: 100dvh;
  flex-direction: column;
  align-items: center;
  /* Figma：844 高的畫面，logo 在 154、表單在 414 */
  padding:
    calc(18dvh + env(safe-area-inset-top))
    calc(var(--form-gutter) + env(safe-area-inset-right))
    calc(2rem + env(safe-area-inset-bottom))
    calc(var(--form-gutter) + env(safe-area-inset-left));
}
.auth__logo {
  transition: translate 500ms var(--motion-ease);
}
.auth__form {
  width: 100%;
  max-width: var(--content-max-narrow);
  margin-top: clamp(3rem, 21dvh, 11.25rem);
  transition: opacity 300ms var(--motion-ease) 300ms;
}

/* 開場：只有首圖與置中的 logo（Cover 的 logo 在 40% 的位置） */
.auth--intro .auth__gradient {
  opacity: 0;
  translate: 0 20%;
}
.auth--intro .auth__logo {
  translate: 0 22dvh;
}
.auth--intro .auth__form {
  opacity: 0;
  pointer-events: none;
  transition: none;
}

/* 減少動態：不做位移，只淡入淡出 */
@media (prefers-reduced-motion: reduce) {
  .auth__gradient,
  .auth--intro .auth__gradient,
  .auth--intro .auth__logo {
    translate: none;
  }
}
</style>
