// 表單的互動時間（計算規則見 utils/interactionTime.ts）。
//
// 「互動」＝輸入、選擇、點擊、捲動。監聽掛在 window 的 capture 階段：
// 器材選單與確認框透過 teleport 掛在 body 底下，不在表單的 DOM 裡；
// 捲動事件不冒泡，但 capture 階段一樣會經過 window。
//
// 表單掛上的那一刻也算一次互動：打開表單後先看一下再開始填，那段也是記錄的一部分；
// 打開之後放著不管，間隔超過門檻，同樣不計入。
//
// 區段由事件目標往上找 data-section 決定（參數／品飲／other）。找不到的就沿用
// 上一次的區段——捲動的目標是 document，浮層的 DOM 在 body 底下，
// 兩者都不在任何一段裡，但使用者當下在做的事沒有變。

const EVENTS = ['input', 'change', 'pointerdown', 'keydown', 'scroll'] as const

/** 事件發生在哪一段。判斷不出來回 null＝沿用上一段 */
function sectionOf(event: Event): SectionMark | null {
  const target = event.target
  const host = target instanceof Element ? target.closest('[data-section]') : null
  const value = host?.getAttribute('data-section')
  return value === 'params' || value === 'tasting' || value === 'other' ? value : null
}

export function useInteractionTime() {
  const clock = createInteractionClock()
  const touch = (event?: Event) => clock.touch(Date.now(), event ? sectionOf(event) : null)

  onMounted(() => {
    touch()
    for (const name of EVENTS) window.addEventListener(name, touch, { capture: true, passive: true })
  })

  onBeforeUnmount(() => {
    for (const name of EVENTS) window.removeEventListener(name, touch, { capture: true })
  })

  /**
   * 送出當下的秒數：總耗時，以及參數與品飲各自的秒數。按下送出本身也是一次互動。
   *
   * 三個值一起回傳而不是分成三支：每呼叫一次就 touch 一次，分開拿會多記幾毫秒到
   * 最後那一段身上。使用者看不到這三個值（《01》§9）。
   */
  function measure() {
    touch()
    return {
      total: clock.seconds(),
      params: clock.sectionSeconds('params'),
      tasting: clock.sectionSeconds('tasting'),
    }
  }

  return { measure }
}
