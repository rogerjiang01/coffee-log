// 導覽規則（《03》§3、utils/navigation.ts）。

import { BREW_BACK_FALLBACK, exitMethod, historyBack, newBrewLeaveTarget, showsTabBar, tabSection } from '../../utils/navigation.ts'
import { createReport } from '../helpers/report.mjs'

export default function run() {
  const r = createReport('導覽規則')

  r.section('分頁列：瀏覽型與檢視型有，流程型沒有')
  r.check(showsTabBar('browse') && showsTabBar('view'), '瀏覽型、檢視型：有')
  r.check(!showsTabBar('flow'), '流程型：沒有（底部是儲存按鈕）')
  r.check(!showsTabBar(undefined), '沒宣告（登入、註冊）：沒有')

  r.section('分頁列亮哪一項')
  r.check(tabSection('/') === '/' && tabSection('/settings') === '/', '首頁、設定（從首頁進）：首頁')
  r.check(tabSection('/beans') === '/beans' && tabSection('/beans/b1') === '/beans', '豆子列表與詳情：豆子（有列表頁，是真的父層）')
  r.check(tabSection('/brews/r1') === '/', '紀錄詳情：首頁——紀錄沒有自己的列表頁，它出現在時間軸')
  r.check(tabSection('/equipment') === '/equipment', '器材列表：器材')

  r.section('紀錄詳情的 ‹ 是歷史式')
  r.check(historyBack('/beans/b1') === 'back', '從豆子的比較表進來：回豆子')
  r.check(historyBack('/') === 'back', '從首頁時間軸進來：回首頁')
  r.check(historyBack(null) === 'fallback' && historyBack(undefined) === 'fallback', '外部連結直接打開、沒有上一頁：fallback')
  r.check(BREW_BACK_FALLBACK === '/', 'fallback 是首頁，紀錄實際出現的地方')

  r.section('離開流程：表單頁不留在 history 裡')
  r.check(exitMethod('/brews/r1', '/brews/r1') === 'back', '詳情 → 編輯 → 儲存：退回原本那一筆詳情，不多一筆')
  r.check(exitMethod('/', '/brews/r2') === 'replace', '新增 → 儲存：表單那一筆換成新紀錄，按返回不回到表單')
  r.check(exitMethod('/brews/r1', '/') === 'replace', '刪除：取代已刪掉的那一頁，按返回不會看到「找不到」')
  r.check(exitMethod(null, '/equipment') === 'replace', '沒有上一頁：取代')

  r.section('新增沖煮紀錄的 ‹ 離開，只看網址')
  r.check(newBrewLeaveTarget({}) === '/', '空白新增：首頁')
  r.check(newBrewLeaveTarget({ bean: 'b1' }) === '/beans/b1', '指定豆子：那支豆子')
  r.check(newBrewLeaveTarget({ copy: 'r1' }) === '/brews/r1', '複製：來源紀錄')
  r.check(newBrewLeaveTarget({ copy: 'r1', bean: 'b1' }) === '/brews/r1', '同時帶兩者以複製為準，與初始值、暫存 key 一致')

  return r.finish()
}
