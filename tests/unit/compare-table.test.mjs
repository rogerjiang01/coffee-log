// 比較表的可點擊線索（結構檢查）。
//
// 實機測試時測試者「認真看不出來」每一列可以點進紀錄。整列都是連結
//（tr 不能包 a，所以每一格各包一個 NuxtLink），但沒有任何看得見的線索。
//
// 這裡守住兩件事：每一列的日期都是連結樣式，而且線索不是靠底色或 hover——
// 底色已經被「收藏」佔用，hover 在觸控裝置上不存在。
//
// 先前的線索是日期後面的 chevron（›），已改成日期本身做成連結樣式：
// 日期是每一列的識別，使用者本來就靠它辨認「這是哪一次」，
// 表格裡的識別欄做成連結是標準模式。

import { readFileSync } from 'node:fs'
import { createReport } from '../helpers/report.mjs'

const root = new URL('../../', import.meta.url)
const read = path => readFileSync(new URL(path, root), 'utf8')

export default function run() {
  const r = createReport('比較表的可點擊線索')
  const table = read('components/BeanCompareTable.vue')
  const body = table.slice(table.indexOf('<tbody>'))

  r.section('每一列都看得出可以點')
  // 指示放在 sticky 的日期欄：375px 下表格寬 461、可視區只有 333，
  // 放最右欄的話 x 會落在 458，要往右捲 128px 才看得到
  const dateCell = (body.match(/<th\s+scope="row"[\s\S]*?<\/th>/) || [''])[0]
  r.check(/sticky left-0/.test(dateCell), '日期欄是 sticky，永遠在畫面上')
  r.check(!/v-if/.test(dateCell), '每一列都有，沒有 v-if')
  r.check(/var\(--accent\)/.test(dateCell) && /underline/.test(dateCell),
    '日期是連結樣式：--accent 加底線')
  r.check(!/<svg/.test(dateCell), 'chevron 已移除——日期本身就是線索')
  const otherCells = body.slice(body.indexOf('</th>'))
  r.check(/<NuxtLink[\s\S]*?:to="`\/brews\/\$\{row\.id\}`"/.test(otherCells),
    '其他格仍然是連結，整列可點')
  r.check(!/var\(--accent\)/.test(otherCells), '連結樣式只在日期上，數值維持原本的顏色')
  r.check(/查看這筆紀錄/.test(dateCell), '螢幕閱讀器唸得到這是一個連結')
  r.check(!/w-0 px-2 py-3/.test(body), '最右側沒有另一欄指示——那裡要捲動才看得到，等於沒有')

  r.section('不靠 hover，也不靠底色')
  r.check(!/hover:/.test(table), '沒有 hover 樣式——觸控裝置沒有 hover，手機是這個 app 的主場')
  r.check(/row\.isFavorite \? 'var\(--accent-wash\)' : 'var\(--surface\)'/.test(table),
    '底色仍然只表達「收藏」，沒有被拿去表達「可點」')

  return r.finish()
}
