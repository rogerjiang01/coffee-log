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
export function useAnchoredPanel(
  trigger: Ref<HTMLElement | null>,
  panel: Ref<HTMLElement | null>,
  open: Ref<boolean>,
) {
  const style = ref<Record<string, string>>({})

  const MAX_HEIGHT = 360
  // 下限要放得下搜尋框、幾列選項與底部的新增動作；太小的話底部動作
  // 會被 overflow hidden 裁掉，看起來像「點不到」
  const MIN_HEIGHT = 240
  const GAP = 4
  const EDGE = 8

  function update() {
    const el = trigger.value
    if (!el) return
    const rect = el.getBoundingClientRect()
    const below = window.innerHeight - rect.bottom
    const above = rect.top

    // 下方空間不足且上方比較寬敞時往上開
    const openUp = below < 200 && above > below

    style.value = openUp
      ? {
          position: 'fixed',
          left: `${rect.left}px`,
          width: `${rect.width}px`,
          bottom: `${window.innerHeight - rect.top + GAP}px`,
          maxHeight: `${Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, above - GAP - EDGE))}px`,
        }
      : {
          position: 'fixed',
          left: `${rect.left}px`,
          width: `${rect.width}px`,
          top: `${rect.bottom + GAP}px`,
          maxHeight: `${Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, below - GAP - EDGE))}px`,
        }
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
