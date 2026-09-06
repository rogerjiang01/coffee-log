// 浮層的 teleport 目標。
//
// 這一條是結構檢查，因為它的失效方式在執行期完全安靜：
// 浮層 teleport 到 body、而外層是 showModal() 開的 <dialog> 時，
// 浮層落在 inert 區域——**畫得出來、點不到、沒有 console 錯誤**。
// 而且程式呼叫 element.click() 仍然會觸發（那條路徑不做命中測試），
// 所以連「模擬點擊」的測試都驗不出來，要用 document.elementFromPoint 才抓得到。
//
// 在沒有 DOM 的測試環境裡驗不了那件事，退而求其次：守住「沒有人再寫死 body」。

import { readFileSync, readdirSync } from 'node:fs'
import { createReport } from '../helpers/report.mjs'

export default function run() {
  const r = createReport('浮層的 teleport 目標')

  const dir = new URL('../../components/', import.meta.url)
  const files = readdirSync(dir).filter(name => name.endsWith('.vue'))
  const sources = files.map(name => [name, readFileSync(new URL(name, dir), 'utf8')])

  r.section('沒有人寫死 to="body"')
  const hardcoded = sources.filter(([, src]) => /<Teleport\s+to="body"/.test(src)).map(([name]) => name)
  r.check(hardcoded.length === 0,
    hardcoded.length ? `這些還寫死 body：${hardcoded.join('、')}` : '全部改用 usePortalTarget')

  r.section('每個 Teleport 都用共用的目標')
  const users = sources.filter(([, src]) => src.includes('<Teleport'))
  r.check(users.length >= 3, `有 ${users.length} 個元件用到 Teleport`)
  for (const [name, src] of users) {
    r.check(src.includes('usePortalTarget'), `${name} 用 usePortalTarget 決定目標`)
    r.check(/<Teleport\s+:to="portalTarget"/.test(src), `${name} 綁的是 portalTarget`)
  }

  r.section('dialog 內的浮層有人在用')
  // EquipmentPicker 是 showModal() 開的，裡面放了 CatalogSelect——
  // 就是這個組合暴露了問題。這條在於：哪天它被拿掉，上面的檢查就失去對象。
  const picker = readFileSync(new URL('EquipmentPicker.vue', dir), 'utf8')
  r.check(picker.includes('<dialog'), 'EquipmentPicker 是原生 dialog')
  r.check(picker.includes('<CatalogSelect'), 'EquipmentPicker 裡面有 CatalogSelect——這個組合要保持被覆蓋')

  r.section('浮層第一幀就要有正確的寬度')
  // 位置與寬度是 update() 算出來的。若那次計算等到算繪之後才跑，
  // 第一幀的 style 是空的，浮層就變成 teleport 目標的一般子元素：
  // 掛在 body 上撐成整個視窗寬，掛在 dialog 上（flex 置中容器）
  // 縮成內容寬度——實測 375px 下欄位 335px、浮層只剩 188px。
  // 沒有錯誤訊息，只是閃一下就被修正，回歸時很難察覺。
  const panel = readFileSync(new URL('../../composables/useAnchoredPanel.ts', import.meta.url), 'utf8')
  r.check(/flush:\s*'sync'/.test(panel),
    "watch 用 flush: 'sync' 先算一次——預設的 pre 會等到算繪之後才跑")

  const sources2 = sources.filter(([, src]) => src.includes('<Teleport'))
  for (const [name, src] of sources2) {
    r.check(/class="fixed z-40/.test(src),
      `${name} 的浮層 class 直接帶 fixed——style 因故沒套上時也不會變成一般子元素`)
  }

  r.section('取消與關閉的路徑分開接')
  // 這一條是結構檢查。行為的失效方式很安靜：按了取消再打開，
  // 內容還在——看起來像「暫存有效」，其實是違反了使用者剛表達的意圖。
  const beanSrc = readFileSync(new URL('BeanSelect.vue', dir), 'utf8')

  for (const [name, src] of [['BeanSelect', beanSrc], ['EquipmentPicker', picker]]) {
    r.check(/function cancelCreate\(\)/.test(src), `${name} 有獨立的 cancelCreate()`)
    r.check(/cancelCreate[\s\S]{0,200}inlineDraft(\.value)?\.clear\(\)/.test(src),
      `${name} 的取消會清掉 inline draft`)
    r.check(/@click="cancelCreate|cancelCreate\(\) :/.test(src), `${name} 的取消按鈕接的是 cancelCreate`)
  }

  // 返回鍵是「關閉」不是「取消」，不能也清掉
  const backButton = picker.slice(picker.indexOf('回到清單') - 400, picker.indexOf('回到清單') + 200)
  r.check(!backButton.includes('cancelCreate'),
    '器材選擇器的返回鍵維持保留內容——它是離開，不是取消')

  r.section('成對按鈕一律次要在左、主要在右')
  // 只看 <button> 的內容：DraftOverlay 的標題就有「繼續填寫」四個字，
  // 拿整份 template 比對會量到標題的位置而不是按鈕的位置。
  const SECONDARY = ['取消', '重新開始']
  const PRIMARY = ['confirmLabel', '繼續填寫', '選好了', "'儲存'"]

  for (const name of ['ConfirmDialog.vue', 'DraftOverlay.vue', 'EquipmentPicker.vue', 'BeanSelect.vue']) {
    const whole = readFileSync(new URL(name, dir), 'utf8')
    const template = whole.slice(whole.indexOf('<template>'))
    const buttons = [...template.matchAll(/<button[\s\S]*?<\/button>/g)].map(m => m[0])

    const secondaryAt = buttons.findIndex(b => SECONDARY.some(w => b.includes(w)))
    const primaryAt = buttons.findIndex(b => PRIMARY.some(w => b.includes(w)))
    r.check(secondaryAt >= 0 && primaryAt >= 0 && secondaryAt < primaryAt,
      `${name}：次要動作的按鈕排在主要動作前面（第 ${secondaryAt + 1} 顆 vs 第 ${primaryAt + 1} 顆）`)
  }

  return r.finish()
}
