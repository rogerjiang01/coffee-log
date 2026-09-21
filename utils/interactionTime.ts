// 記一筆紀錄實際花了多少時間（brews.form_duration_seconds，《01》§9）。
//
// 量的是**互動時間**：累計相鄰兩次互動之間的間隔，太長的間隔不計入。
// 舊定義是「表單開啟到送出」，把開著表單去沖咖啡、品飲、聊天的時間也算進去，
// 實測出現 3128 秒、2620 秒這種數字——那不是填表時間，整個欄位因此失去參考價值。
//
// 例：填 30 秒 → 放著 40 分鐘 → 再填 20 秒 → 記 50 秒，不是 2450 秒。
//
// 同一個時鐘另外把時間分到「參數」與「品飲」兩段（params_duration_seconds、
// tasting_duration_seconds）：總耗時分不出「參數記錄一兩分鐘內完成」有沒有達成，
// 因為品飲那段本來就慢——強度要想、風味詞要挑，那不是效率問題。
// **總耗時的算法一個字都沒有變**，兩個區段是同一批間隔的再分配。

/**
 * 兩次互動之間超過這個間隔，就當作使用者離開了，那段間隔不計入。
 *
 * 要大到涵蓋「想一下再填」：回想上次的刻度、看一眼磅秤、決定要選哪個風味詞，
 * 這些停頓是記錄的一部分，常常十幾二十秒。
 * 又要小到排除「去沖咖啡」：一杯手沖從注水到滴完就要兩三分鐘，
 * 開著表單去沖的那段一定會超過這個值。
 */
export const IDLE_GAP_MS = 60_000

/** 會被分開計時的兩段 */
export type FormSection = 'params' | 'tasting'

/**
 * 一次互動發生在哪一段。
 *
 * - `params`／`tasting`：使用者正在操作那一段的欄位
 * - `other`：明確不屬於任何一段的欄位（日期、照片），只計入總耗時
 * - `null`：這次互動判斷不出區段（捲動、浮層裡的操作、送出按鈕），
 *   **沿用上一次的區段**。浮層 teleport 到 `<body>`，DOM 上不在任何一段裡，
 *   但打開它的那個觸發元素在——沿用就等於跟著使用者實際在做的事走。
 */
export type SectionMark = FormSection | 'other'

export interface InteractionClock {
  /** 記下一次互動。時間戳由呼叫端給，方便測試 */
  touch: (now: number, section?: SectionMark | null) => void
  /** 目前累計的互動秒數（四捨五入到整數） */
  seconds: () => number
  /** 某一段累計的互動秒數。兩段相加必定小於或等於 seconds()，差額是 other */
  sectionSeconds: (section: FormSection) => number
}

export function createInteractionClock(idleGapMs: number = IDLE_GAP_MS): InteractionClock {
  let last: number | null = null
  let lastSection: SectionMark | null = null
  let totalMs = 0
  const sectionMs: Record<FormSection, number> = { params: 0, tasting: 0 }

  return {
    touch(now, section = null) {
      if (last !== null) {
        const gap = now - last
        // 等於門檻仍計入；時鐘倒退（gap < 0）不計
        if (gap > 0 && gap <= idleGapMs) {
          totalMs += gap
          // 間隔算給「這段時間裡人在哪一段」，也就是區間**開始**時的那一段：
          // 在粉重打完字、過五秒點進心得筆記，那五秒是還在看參數，不是在想心得
          if (lastSection === 'params' || lastSection === 'tasting') sectionMs[lastSection] += gap
        }
      }
      if (last === null || now > last) {
        last = now
        if (section !== null) lastSection = section
      }
    },
    seconds() {
      return Math.round(totalMs / 1000)
    },
    sectionSeconds(section) {
      return Math.round(sectionMs[section] / 1000)
    },
  }
}
