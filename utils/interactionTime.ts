// 記一筆紀錄實際花了多少時間（brews.form_duration_seconds，《01》§9）。
//
// 量的是**互動時間**：累計相鄰兩次互動之間的間隔，太長的間隔不計入。
// 舊定義是「表單開啟到送出」，把開著表單去沖咖啡、品飲、聊天的時間也算進去，
// 實測出現 3128 秒、2620 秒這種數字——那不是填表時間，整個欄位因此失去參考價值。
//
// 例：填 30 秒 → 放著 40 分鐘 → 再填 20 秒 → 記 50 秒，不是 2450 秒。

/**
 * 兩次互動之間超過這個間隔，就當作使用者離開了，那段間隔不計入。
 *
 * 要大到涵蓋「想一下再填」：回想上次的刻度、看一眼磅秤、決定要選哪個風味詞，
 * 這些停頓是記錄的一部分，常常十幾二十秒。
 * 又要小到排除「去沖咖啡」：一杯手沖從注水到滴完就要兩三分鐘，
 * 開著表單去沖的那段一定會超過這個值。
 */
export const IDLE_GAP_MS = 60_000

export interface InteractionClock {
  /** 記下一次互動。時間戳由呼叫端給，方便測試 */
  touch: (now: number) => void
  /** 目前累計的互動秒數（四捨五入到整數） */
  seconds: () => number
}

export function createInteractionClock(idleGapMs: number = IDLE_GAP_MS): InteractionClock {
  let last: number | null = null
  let totalMs = 0

  return {
    touch(now) {
      if (last !== null) {
        const gap = now - last
        // 等於門檻仍計入；時鐘倒退（gap < 0）不計
        if (gap > 0 && gap <= idleGapMs) totalMs += gap
      }
      if (last === null || now > last) last = now
    },
    seconds() {
      return Math.round(totalMs / 1000)
    },
  }
}
