// 單選群組的鍵盤操作（《03》§4.3）：強度圓點與星等共用。
//
// role="radiogroup" 的慣例是整組只佔一個 Tab 停駐點，組內用方向鍵移動、移到哪裡就選哪裡。
// 原本五顆是各自獨立的按鈕：Tab 要逐顆經過，方向鍵沒有反應。
//
// 這裡的單選可以留空，所以多兩件事：
//   - 還沒選的時候，Tab 停在第一顆
//   - 再按一次已選的那顆（點擊、空白鍵、Enter）會清掉，這由元件自己的 click 處理

export function useRadioKeys(levels: readonly number[]) {
  /** 這一顆該不該是 Tab 停駐點 */
  function tabindex(level: number, current: number | null | undefined) {
    const stop = current ?? levels[0]
    return level === stop ? 0 : -1
  }

  /**
   * 方向鍵、Home、End。回傳要選的那一級；不是這幾個鍵就回 null。
   * 焦點跟著移到那一顆。
   */
  function onKeydown(event: KeyboardEvent, current: number | null | undefined): number | null {
    const index = current == null ? -1 : levels.indexOf(current)
    let next: number
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        next = index < 0 ? 0 : Math.min(index + 1, levels.length - 1)
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        next = index < 0 ? 0 : Math.max(index - 1, 0)
        break
      case 'Home':
        next = 0
        break
      case 'End':
        next = levels.length - 1
        break
      default:
        return null
    }
    event.preventDefault()
    const group = (event.currentTarget as HTMLElement | null)
    const target = group?.querySelectorAll<HTMLElement>('[role="radio"]')[next]
    target?.focus()
    return levels[next]!
  }

  return { tabindex, onKeydown }
}
