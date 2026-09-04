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
  const at = css.indexOf('dialog:modal')
  r.check(at !== -1, 'main.css 裡有 dialog:modal 規則')
  const rule = at === -1 ? '' : css.slice(at, css.indexOf('}', at))
  r.check(/margin:\s*auto/.test(rule),
    'margin: auto 還在——Tailwind preflight 的 margin: 0 會蓋掉瀏覽器預設的置中，浮層會跑到左上角')
  r.check(/overflow:\s*auto/.test(rule),
    'overflow: auto 還在——沒有它，超長內容會被裁掉而不是可以捲')
  r.check(/max-height/.test(rule), 'max-height 還在——沒有它，超長內容會頂出視窗')

  r.section('動態偏好')
  r.check(/prefers-reduced-motion/.test(css),
    'prefers-reduced-motion 的全域規則還在（《03》§6 要求）')

  return r.finish()
}
