// 比較表的可點擊線索（結構檢查）。
//
// 實機測試時測試者「認真看不出來」每一列可以點進紀錄。整列都是連結
//（tr 不能包 a，所以每一格各包一個 NuxtLink），但沒有任何看得見的線索。
//
// 這裡守住兩件事：每一列都有進入指示，而且那個指示不是靠底色或 hover——
// 底色已經被「收藏」佔用，hover 在觸控裝置上不存在。

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
  r.check(/<svg/.test(dateCell) && !/v-if/.test(dateCell),
    '進入指示就畫在日期欄裡，而且每一列都有——沒有 v-if')
  r.check(/var\(--text-muted\)/.test(dateCell),
    '用 --text-muted：它是線索不是行動，不該搶走數值的視覺權重')
  r.check(/查看這筆紀錄/.test(dateCell), '螢幕閱讀器唸得到這是一個連結')
  r.check(!/w-0 px-2 py-3/.test(body), '最右側沒有另一欄指示——那裡要捲動才看得到，等於沒有')

  r.section('不靠 hover，也不靠底色')
  r.check(!/hover:/.test(table), '沒有 hover 樣式——觸控裝置沒有 hover，手機是這個 app 的主場')
  r.check(/row\.isFavorite \? 'var\(--accent-wash\)' : 'var\(--surface\)'/.test(table),
    '底色仍然只表達「收藏」，沒有被拿去表達「可點」')

  return r.finish()
}
