// 全域 CSS 裡幾條「刪掉不會報錯」的規則。
//
// 這是文字比對，不是行為驗證。收在測試裡的理由是失效方式太安靜：
// 規則被順手刪掉時畫面不會 crash、console 不會有訊息，
// 只是所有浮層默默跑到左上角。

import { readFileSync } from 'node:fs'
import { createReport } from '../helpers/report.mjs'

export default function run() {
  const r = createReport('全域 CSS 的關鍵規則')
  const css = readFileSync(new URL('../../assets/css/main.css', import.meta.url), 'utf8')

  r.section('浮層置中')
  // 註解裡也會出現「dialog:modal」這幾個字，要抓的是真正的規則區塊
  const at = css.search(/dialog:modal\s*\{/)
  r.check(at !== -1, 'main.css 裡有 dialog:modal 規則')
  const rule = at === -1 ? '' : css.slice(at, css.indexOf('}', at))

  // 這裡刻意不用 margin: auto 置中。那個機制有三個前提（瀏覽器補齊四邊
  // inset、height 是確定值、margin 沒被蓋掉），preflight 打掉第三項，
  // 瀏覽器差異打掉前兩項，結果是「左右置中、上下貼齊上緣」。
  // 改成 dialog 自己撐滿視窗當置中容器，只用普遍支援的屬性。
  r.check(/display:\s*flex/.test(rule), 'flex 置中——不依賴 margin auto 的餘量分配')
  r.check(/align-items:\s*center/.test(rule), '垂直置中')
  r.check(/justify-content:\s*center/.test(rule), '水平置中')
  r.check(/height:\s*100%/.test(rule),
    'height: 100% 撐滿視窗——對 position: fixed 而言相對視窗，不需要瀏覽器補 inset')
  r.check(!/margin:\s*auto/.test(rule) && !/fit-content/.test(rule),
    '不再依賴 margin: auto 與 fit-content——那兩者正是先前失敗的原因')
  r.check(/background:\s*transparent/.test(rule), 'dialog 本身透明，卡片樣式在內層')

  const innerAt = css.search(/dialog:modal\s*>\s*\*\s*\{/)
  const inner = innerAt === -1 ? '' : css.slice(innerAt, css.indexOf('}', innerAt))
  r.check(/max-height:\s*100%/.test(inner), '內層卡片不超過容器高度')
  r.check(/overflow:\s*auto/.test(inner), '內層卡片自己捲——超長內容不會被裁掉')

  r.section('全螢幕面板')
  const sheetAt = css.search(/dialog:modal\.sheet\s*\{/)
  r.check(sheetAt !== -1, '.sheet 變體存在——器材選擇器靠它取得焦點鎖定與 Esc')

  r.section('焦點可見（§7）')
  // 不依賴瀏覽器預設的 focus ring：各家畫法不同，在暖底色上有的幾乎看不出來
  const fv = css.search(/(?<![.\w-]):focus-visible\s*\{/)
  r.check(fv !== -1, '有全站的 :focus-visible 規則')
  const fvRule = fv === -1 ? '' : css.slice(fv, css.indexOf('}', fv))
  r.check(/outline:\s*2px solid var\(--accent\)/.test(fvRule), '焦點框用強調色，不是瀏覽器預設')
  r.check(/outline-offset/.test(fvRule),
    '有 outline-offset——沒有這道縫，疊在 --accent 底色上的按鈕焦點框會融進去')

  r.section('動態偏好')
  r.check(/prefers-reduced-motion/.test(css),
    'prefers-reduced-motion 的全域規則還在（《03》§6 要求）')

  return r.finish()
}
