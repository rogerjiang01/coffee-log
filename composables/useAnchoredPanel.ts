/**
 * 錨定在觸發元素下方的浮層。
 *
 * 浮層 teleport 到 body，脫離父容器——分組卡片為了圓角用了 overflow hidden，
 * 絕對定位的子元素會被一起裁掉。浮層本來就不該受父容器裁切。
 *
 * 代價是它也脫離了原本的定位脈絡，所以位置要自己算，並在捲動與改變視窗
 * 大小時重算。用 position: fixed 搭配 getBoundingClientRect，兩者都是
 * 相對於視窗，不必再處理捲動位移。
 */
export interface AnchorRect {
  top: number
  bottom: number
  left: number
  width: number
}

const MAX_HEIGHT = 360
// 下方空間小於這個值時才考慮往上開，避免只差幾像素就翻面
const PREFERRED = 280
const GAP = 4
const EDGE = 8

/**
 * 浮層的位置與高度。抽成純函式是為了能單獨測試——
 * 這裡曾經有個高度下限的錯誤，讓浮層在空間不足時伸出視窗外，
 * 而 position: fixed 使頁面捲不到它，底部的動作因此永遠點不到，
 * 且不會有任何錯誤訊息。
 */
export function computePanelPlacement(rect: AnchorRect, viewportHeight: number): Record<string, string> {
  const spaceBelow = viewportHeight - rect.bottom - GAP - EDGE
  const spaceAbove = rect.top - GAP - EDGE

  // 優先往下開；只有下方明顯不夠而上方比較寬時才翻面
  const openUp = spaceBelow < PREFERRED && spaceAbove > spaceBelow
  const available = Math.max(0, openUp ? spaceAbove : spaceBelow)

  // **高度絕不超過該側的可用空間。** 沒有下限——寧可矮，不可伸出視窗。
  const height = Math.min(MAX_HEIGHT, available)

  const common = {
    position: 'fixed',
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    maxHeight: `${height}px`,
  }

  return openUp
    ? { ...common, bottom: `${viewportHeight - rect.top + GAP}px` }
    : { ...common, top: `${rect.bottom + GAP}px` }
}

export function useAnchoredPanel(
  trigger: Ref<HTMLElement | null>,
  panel: Ref<HTMLElement | null>,
  open: Ref<boolean>,
) {
  const style = ref<Record<string, string>>({})

  function update() {
    const el = trigger.value
    if (!el) return
    const rect = el.getBoundingClientRect()
    style.value = computePanelPlacement(
      { top: rect.top, bottom: rect.bottom, left: rect.left, width: rect.width },
      window.innerHeight,
    )
  }

  watch(open, async (value) => {
    if (!value) return
    await nextTick()
    update()
  })

  onMounted(() => {
    // capture 為 true 才收得到內層捲動容器的事件
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('scroll', update, true)
    window.removeEventListener('resize', update)
  })

  /** 判斷這次點擊是否落在觸發元素或浮層之外 */
  function isOutside(target: Node | null) {
    if (!target) return true
    if (trigger.value?.contains(target)) return false
    // 浮層已經 teleport 出去，不能只檢查觸發元素的父層
    if (panel.value?.contains(target)) return false
    return true
  }

  return { style, update, isOutside }
}
