/**
 * 離開流程：儲存、刪除之後的跳轉，與流程型畫面的 ‹ 離開（utils/navigation.ts 的 exitMethod）。
 * 表單頁不留在 history 裡——儲存後按返回不會回到表單，刪除後不會看到「找不到」。
 */
export function useFlowExit() {
  const router = useRouter()
  const goBack = useHistoryBack()
  return async function exitTo(target: string) {
    const previous = import.meta.client ? (window.history.state?.back as string | null | undefined) : null
    if (exitMethod(previous, target) === 'back') {
      await goBack()
      return
    }
    await navigateTo(target, { replace: true })
  }
}

/**
 * 回上一頁，但先等浮層退完。
 *
 * push 與 replace 會經過導覽守衛，守衛會等浮層那一筆退掉（plugins/overlay-history）；
 * router.back() 不經過守衛——「確認刪除 → 對話框關掉 → 回上一頁」會連發兩次後退，
 * 瀏覽器不保證兩次都照順序執行。所以這裡自己先等。
 */
export function useHistoryBack() {
  const router = useRouter()
  const overlays = import.meta.client ? useNuxtApp().$overlayHistory : null
  return async function goBack() {
    await overlays?.beforeNavigate()
    router.back()
  }
}
