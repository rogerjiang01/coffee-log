// 表單的互動時間（計算規則見 utils/interactionTime.ts）。
//
// 「互動」＝輸入、選擇、點擊、捲動。監聽掛在 window 的 capture 階段：
// 器材選單與確認框透過 teleport 掛在 body 底下，不在表單的 DOM 裡；
// 捲動事件不冒泡，但 capture 階段一樣會經過 window。
//
// 表單掛上的那一刻也算一次互動：打開表單後先看一下再開始填，那段也是記錄的一部分；
// 打開之後放著不管，間隔超過門檻，同樣不計入。

const EVENTS = ['input', 'change', 'pointerdown', 'keydown', 'scroll'] as const

export function useInteractionTime() {
  const clock = createInteractionClock()
  const touch = () => clock.touch(Date.now())

  onMounted(() => {
    touch()
    for (const name of EVENTS) window.addEventListener(name, touch, { capture: true, passive: true })
  })

  onBeforeUnmount(() => {
    for (const name of EVENTS) window.removeEventListener(name, touch, { capture: true })
  })

  /** 送出當下的累計秒數。按下送出本身也是一次互動 */
  function seconds() {
    touch()
    return clock.seconds()
  }

  return { seconds }
}
