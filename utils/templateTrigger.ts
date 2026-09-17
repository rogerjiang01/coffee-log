// 什麼時候依手法模板重算分段（《02》§5「手法帶入分段的邏輯」）。
//
// 規則只有一條：**使用者改了手法或粉重才重算；程式把值寫回表單時不重算。**
//
//   使用者換手法                → 套用模板（新增、複製、編輯都一樣）
//   使用者改粉重（已選手法）    → 整組重算（段數被改過就不動，見 shouldRegenerateSteps）
//   表單初次掛上（複製、編輯）  → 不算：分段就是來源紀錄的實際分段
//   暫存還原                    → 不算：分段就是暫存裡的分段
//   全部清除                    → 不算：那是還原，不是改參數；分段退回初始值
//                                 （複製流程就是來源紀錄的實際分段）
//
// 為什麼要包一層：watch 分不出值是誰改的。原本兩個 watcher 是預設的 pre flush，
// 會在下一個 tick 才執行——「全部清除」先把 values 寫回、再把分段寫回初始值，
// watcher 晚一步看到手法或粉重跟暫存裡不同，就拿模板把剛寫回的分段蓋掉。
// 暫存還原是同一條路徑，暫存裡改過的分段也會被蓋掉。
//
// 這裡改成 sync flush，寫回期間的觸發當場就被擋下，不依賴 tick 的先後順序。

import { watch } from 'vue'

export function watchTemplateTriggers(options: {
  method: () => string | null
  dose: () => number | null
  onMethodChange: () => void
  onDoseChange: () => void
}) {
  let writingBack = false

  watch(options.method, () => {
    if (!writingBack) options.onMethodChange()
  }, { flush: 'sync' })

  watch(options.dose, () => {
    if (!writingBack) options.onDoseChange()
  }, { flush: 'sync' })

  /** 程式把值寫回表單（暫存還原、全部清除）。期間的手法與粉重變動不觸發重算 */
  function writeBack(fn: () => void) {
    writingBack = true
    try {
      fn()
    }
    finally {
      writingBack = false
    }
  }

  return { writeBack }
}
