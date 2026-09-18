// 浮層與返回鍵的接線（utils/overlayHistory.ts）。
//
// 後退走路由器的 go(-n, false)：直接呼叫 history.back() 的話，路由器會把那次
// popstate 當成一次導覽（同網址，但守衛與 middleware 都會再跑一次）。

const SETTLE_TIMEOUT_MS = 600

export default defineNuxtPlugin(() => {
  const router = useRouter()
  const overlays = createOverlayHistory({
    state: () => window.history.state,
    push: state => window.history.pushState(state, ''),
    replace: state => window.history.replaceState(state, ''),
    back: steps => router.options.history.go(-steps, false),
    onPop: listener => window.addEventListener('popstate', listener),
  })

  router.beforeEach(async (to, from) => {
    // 同網址：返回鍵在關浮層，popstate 那邊處理
    if (to.fullPath === from.fullPath) return
    // popstate 沒來的話（理論上不會）不能讓導覽卡住
    await Promise.race([
      overlays.beforeNavigate(),
      new Promise(resolve => setTimeout(resolve, SETTLE_TIMEOUT_MS)),
    ])
  })

  return { provide: { overlayHistory: overlays } }
})
