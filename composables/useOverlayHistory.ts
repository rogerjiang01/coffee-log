/**
 * 浮層佔一筆 history，讓返回鍵關掉浮層而不是離開頁面（《03》§3、utils/overlayHistory.ts）。
 *
 * open 變成 true 時推一筆；變成 false（取消、點外面、Esc）或元件卸載時退掉那一筆。
 * 使用者按返回時呼叫 close——由元件自己決定「關閉」要做什麼（清搜尋字、還焦點、
 * 通知父層），跟其他關閉路徑走同一個函式。
 *
 * **flush: 'sync' 不可改成預設值。** 關掉對話框之後緊接著導向別頁（確認刪除）時，
 * 退回那一筆的動作必須在導覽開始之前就發出，導覽守衛才等得到它。
 */
export function useOverlayHistory(open: () => boolean, close: () => void) {
  const overlays = import.meta.client ? useNuxtApp().$overlayHistory : null
  if (!overlays) return

  let id: number | null = null

  function release() {
    if (id === null) return
    const current = id
    id = null
    overlays!.dismiss(current)
  }

  watch(open, (value) => {
    if (value && id === null) {
      id = overlays.open(() => {
        // 返回鍵或導覽關掉的：history 那邊已經處理好，只剩畫面
        id = null
        close()
      })
    }
    else if (!value) {
      release()
    }
  }, { flush: 'sync', immediate: true })

  onBeforeUnmount(release)
}
