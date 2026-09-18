// 導覽規則（《03》§3、utils/navigation.ts）。

import { brewParent, newBrewLeaveTarget, showsTabBar, tabSection } from '../../utils/navigation.ts'
import { createReport } from '../helpers/report.mjs'

export default function run() {
  const r = createReport('導覽規則')

  r.section('分頁列：瀏覽型與檢視型有，流程型沒有')
  r.check(showsTabBar('browse') && showsTabBar('view'), '瀏覽型、檢視型：有')
  r.check(!showsTabBar('flow'), '流程型：沒有（底部是儲存按鈕）')
  r.check(!showsTabBar(undefined), '沒宣告（登入、註冊）：沒有')

  r.section('分頁列亮哪一項，依內容階層')
  r.check(tabSection('/') === '/' && tabSection('/settings') === '/', '首頁、設定（從首頁進）：首頁')
  r.check(tabSection('/beans') === '/beans' && tabSection('/beans/b1') === '/beans', '豆子列表與詳情：豆子')
  r.check(tabSection('/brews/r1') === '/beans', '紀錄詳情屬於豆子，與 ‹ 返回的方向一致')
  r.check(tabSection('/equipment') === '/equipment', '器材列表：器材')

  r.section('返回上一層依內容階層，不依來源')
  r.check(brewParent('b1') === '/beans/b1', '紀錄詳情 ‹ → 它的豆子')
  r.check(brewParent(null) === '/beans' && brewParent(undefined) === '/beans', '資料還沒到或找不到：豆子列表')

  r.section('新增沖煮紀錄的 ‹ 離開，只看網址')
  r.check(newBrewLeaveTarget({}) === '/', '空白新增：首頁')
  r.check(newBrewLeaveTarget({ bean: 'b1' }) === '/beans/b1', '指定豆子：那支豆子')
  r.check(newBrewLeaveTarget({ copy: 'r1' }) === '/brews/r1', '複製：來源紀錄')
  r.check(newBrewLeaveTarget({ copy: 'r1', bean: 'b1' }) === '/brews/r1', '同時帶兩者以複製為準，與初始值、暫存 key 一致')

  return r.finish()
}
