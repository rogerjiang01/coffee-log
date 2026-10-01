/**
 * 離開流程：儲存、刪除之後的跳轉（utils/navigation.ts 的 exitMethod）。
 * 表單頁不留在 history 裡——儲存後按返回不會回到表單，刪除後不會看到「找不到」。
 */
export function useFlowExit() {
  const goBack = useHistoryBack()
  return async function exitTo(target: string) {
    if (exitMethod(previousPage(), target) === 'back') {
      await goBack()
      return
    }
    await navigateTo(target, { replace: true })
  }
}

/**
 * 流程型畫面的 ‹ 離開（utils/navigation.ts 的 leaveMethod）：站內有上一頁就退回上一頁，
 * 沒有才取代成 fallback。direct 是編輯頁找不到那一筆時用的，不看上一頁。
 */
export function useFlowLeave() {
  const goBack = useHistoryBack()
  return async function leaveTo(fallback: string, direct = false) {
    if (leaveMethod(previousPage(), fallback, direct) === 'back') {
      await goBack()
      return
    }
    await navigateTo(fallback, { replace: true })
  }
}

/** 路由器記在 history.state.back 的站內上一頁；從外部連結直接打開時沒有 */
function previousPage(): string | null | undefined {
  return import.meta.client ? (window.history.state?.back as string | null | undefined) : null
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
