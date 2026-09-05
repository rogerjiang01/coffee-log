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

  return r.finish()
}
