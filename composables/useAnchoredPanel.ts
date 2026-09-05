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

/**
 * 浮層要 teleport 到哪裡。
 *
 * **不能一律送 body。** 原生 <dialog> 用 showModal() 打開之後會進入
 * top layer，而 dialog 以外的所有內容都變成 inert——點不到、也收不到
 * 滑鼠事件。teleport 到 body 的浮層就落在那個「以外」，於是視覺上看得見、
 * 點下去卻毫無反應。
 *
 * 這個 bug 特別難抓：**沒有 console 錯誤、沒有例外**，而且程式呼叫
 * element.click() 還是會觸發（那條路徑不做命中測試），
 * 所以連測試都可能驗不出來。要驗得用 document.elementFromPoint。
 *
 * 解法是找出最近的 <dialog> 祖先當目標。有的話浮層跟著進 top layer；
 * 沒有的話照舊送 body。
 *
 * 用 closest('dialog') 而不是 closest('dialog[open]')：浮層存在時
 * 外層的 dialog 必然是開著的（關掉時整棵子樹不會被算繪），
 * 而 [open] 在某些時序下還沒被瀏覽器設上去。
 */
export function resolvePortalTarget(
  anchor: { closest: (selector: string) => HTMLElement | null } | null,
): HTMLElement | string {
  return anchor?.closest('dialog') ?? 'body'
}

/** 掛載後解析一次。浮層是使用者互動後才開的，那時 onMounted 早就跑完了 */
export function usePortalTarget(anchor: Ref<HTMLElement | null>) {
  const target = ref<HTMLElement | string>('body')
  onMounted(() => {
    target.value = resolvePortalTarget(anchor.value)
  })
  return target
}
