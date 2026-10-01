// 導覽規則（《03》§3、utils/navigation.ts）。

import {
  BEAN_BACK_FALLBACK, BREW_BACK_FALLBACK, TABS,
  exitMethod, historyBack, leaveMethod, newBrewEntry, newBrewLeaveTarget, showsTabBar, tabSection,
} from '../../utils/navigation.ts'
import { createReport } from '../helpers/report.mjs'

// ── 用一疊網址模擬瀏覽器的 history，看 ‹ 按下去之後落在哪一頁 ──
// 最上面那一筆是目前這一頁；它底下那一筆就是路由器記在 history.state.back 的上一頁。
type Stack = string[]
const previousOf = (stack: Stack) => (stack.length > 1 ? stack[stack.length - 2]! : null)
const top = (stack: Stack) => stack[stack.length - 1]!

/** 流程型的 ‹ 離開 */
function leave(stack: Stack, fallback: string, direct = false): Stack {
  return leaveMethod(previousOf(stack), fallback, direct) === 'back'
    ? stack.slice(0, -1)
    : [...stack.slice(0, -1), fallback]
}

/** 檢視型的 ‹ 返回（歷史式） */
function back(stack: Stack, fallback: string): Stack {
  return historyBack(previousOf(stack)) === 'back' ? stack.slice(0, -1) : [...stack, fallback]
}

/** 儲存、刪除之後 */
function exit(stack: Stack, target: string): Stack {
  return exitMethod(previousOf(stack), target) === 'back' ? stack.slice(0, -1) : [...stack.slice(0, -1), target]
}

/** 新增紀錄頁：沒有上一頁時依網址決定的目的地 */
function newBrewFallback(url: string): string {
  const query = new URL(url, 'http://x').searchParams
  return newBrewLeaveTarget({ copy: query.get('copy'), bean: query.get('bean') })
}
const leaveNewBrew = (stack: Stack) => leave(stack, newBrewFallback(top(stack)))

export default function run() {
  const r = createReport('導覽規則')

  r.section('分頁列：瀏覽型與檢視型有，流程型沒有')
  r.check(showsTabBar('browse') && showsTabBar('view'), '瀏覽型、檢視型：有')
  r.check(!showsTabBar('flow'), '流程型：沒有（底部是儲存按鈕）')
  r.check(!showsTabBar(undefined), '沒宣告（登入、註冊）：沒有')
  r.check(!showsTabBar('share', false), '分享頁、未登入：沒有（分頁列只會把他帶到登入頁）')
  r.check(showsTabBar('share', true), '分享頁、已登入：有')
  r.check(showsTabBar('view', false) && !showsTabBar('flow', true), '其他畫面不看登入狀態')

  r.section('分頁列四格，依序：總覽、紀錄、豆子、器材')
  r.check(TABS.map(tab => tab.label).join('、') === '總覽、紀錄、豆子、器材', '四格的名稱與順序')
  r.check(TABS.map(tab => tab.to).join(' ') === '/ /brews /beans /equipment', '四格的目的地')

  r.section('分頁列亮哪一格')
  r.check(tabSection('/') === '/', '/：總覽')
  r.check(tabSection('/settings') === '/', '/settings：總覽（設定從總覽的齒輪進去）')
  r.check(tabSection('/brews') === '/brews', '/brews：紀錄')
  r.check(tabSection('/brews/r1') === '/brews', '紀錄詳情：紀錄——紀錄有了自己的列表頁，不再屬於總覽')
  r.check(tabSection('/brews/r1/edit') === '/brews' && tabSection('/brews/new') === '/brews', '編輯紀錄、新增紀錄：紀錄')
  r.check(tabSection('/beans') === '/beans' && tabSection('/beans/b1') === '/beans' && tabSection('/beans/b1/edit') === '/beans',
    '/beans/…：豆子')
  r.check(tabSection('/equipment') === '/equipment' && tabSection('/equipment/e1/edit') === '/equipment', '/equipment/…：器材')
  r.check(tabSection('/s/abc') === null, '分享頁：不亮任何一格（那筆紀錄不屬於看的人）')
  r.check(tabSection('/login') === null, '登入頁：不亮（也沒有分頁列）')
  const lit = (path: string) => TABS.filter(tab => tabSection(path) === tab.to).map(tab => tab.label).join()
  r.check(lit('/') === '總覽' && lit('/brews/r1') === '紀錄' && lit('/beans/b1') === '豆子' && lit('/equipment') === '器材' && lit('/s/abc') === '',
    '每個網址最多亮一格，名稱對得上')

  r.section('浮動新增按鈕：總覽與紀錄分頁同一條規則')
  r.check(newBrewEntry([{ id: 'b1' }]) === '/brews/new?bean=b1', '未喝完的豆子剛好一支：帶入那支豆子')
  r.check(newBrewEntry([]) === '/brews/new', '沒有未喝完的豆子：空白新增')
  r.check(newBrewEntry([{ id: 'b1' }, { id: 'b2' }]) === '/brews/new', '兩支以上：空白新增')

  r.section('紀錄詳情的 ‹：歷史式，沒有上一頁回紀錄分頁')
  r.check(BREW_BACK_FALLBACK === '/brews', '退回目標是紀錄分頁（原本是 /）')
  r.check(top(back(['/brews', '/brews/r1'], BREW_BACK_FALLBACK)) === '/brews', '從紀錄分頁進來：回紀錄分頁')
  r.check(top(back(['/beans', '/beans/b1', '/brews/r1'], BREW_BACK_FALLBACK)) === '/beans/b1', '從豆子的比較表進來：回那支豆子')
  r.check(top(back(['/s/abc', '/brews/r1'], BREW_BACK_FALLBACK)) === '/s/abc', '從分享頁的「前往紀錄」進來：回分享頁')
  r.check(top(back(['/brews/r1'], BREW_BACK_FALLBACK)) === '/brews', '外部連結直接打開、沒有上一頁：紀錄分頁')
  r.check(historyBack(null) === 'fallback' && historyBack(undefined) === 'fallback', 'null 與 undefined 都算沒有上一頁')

  r.section('豆子詳情的 ‹：歷史式，沒有上一頁回豆子列表')
  r.check(BEAN_BACK_FALLBACK === '/beans', '退回目標是豆子列表')
  r.check(top(back(['/', '/beans/b1'], BEAN_BACK_FALLBACK)) === '/', '從總覽的沖煮中的豆子進來：回總覽（階層式會跑到豆子列表）')
  r.check(top(back(['/beans', '/beans/b1'], BEAN_BACK_FALLBACK)) === '/beans', '從豆子列表進來：回豆子列表')
  r.check(top(back(['/brews', '/brews/r1', '/beans/b1'], BEAN_BACK_FALLBACK)) === '/brews/r1', '從紀錄詳情的豆名進來：回那筆紀錄')
  r.check(top(back(['/beans/b1'], BEAN_BACK_FALLBACK)) === '/beans', '外部連結直接打開、沒有上一頁：豆子列表')

  r.section('刪除之後的落點')
  r.check(top(exit(['/brews', '/brews/r1'], BREW_BACK_FALLBACK)) === '/brews', '刪除紀錄：紀錄分頁（原本是 /）')
  r.check(exit(['/brews', '/brews/r1'], BREW_BACK_FALLBACK).join() === '/brews', '從紀錄分頁進來的：退回去，不多一筆')
  r.check(exit(['/beans/b1', '/brews/r1'], BREW_BACK_FALLBACK).join() === '/beans/b1,/brews', '從別處進來的：取代已刪掉的那一頁，按返回不會看到「找不到」')
  r.check(top(exit(['/', '/beans/b1'], BEAN_BACK_FALLBACK)) === '/beans', '刪除豆子：豆子列表（不變）')

  r.section('儲存之後：表單頁不留在 history 裡（不變）')
  r.check(exitMethod('/brews/r1', '/brews/r1') === 'back', '詳情 → 編輯 → 儲存：退回原本那一筆詳情，不多一筆')
  r.check(exitMethod('/', '/brews/r2') === 'replace', '新增 → 儲存：表單那一筆換成新紀錄，按返回不回到表單')
  r.check(exitMethod(null, '/equipment') === 'replace', '沒有上一頁：取代')
  r.check(exit(['/brews', '/brews/new'], '/brews/r2').join() === '/brews,/brews/r2', '從紀錄分頁新增 → 儲存：落在新紀錄的詳情，‹ 回紀錄分頁')

  r.section('新增紀錄沒有上一頁時，依網址決定目的地（原有規則）')
  r.check(newBrewLeaveTarget({}) === '/', '空白新增：總覽')
  r.check(newBrewLeaveTarget({ bean: 'b1' }) === '/beans/b1', '指定豆子：那支豆子')
  r.check(newBrewLeaveTarget({ copy: 'r1' }) === '/brews/r1', '複製：來源紀錄')
  r.check(newBrewLeaveTarget({ copy: 'r1', bean: 'b1' }) === '/brews/r1', '同時帶兩者以複製為準，與初始值、暫存 key 一致')

  r.section('表單的 ‹ 離開：有上一頁就退回上一頁')
  r.check(leaveMethod('/brews', '/') === 'back', '有上一頁：退回去，不看網址算出來的目的地')
  r.check(leaveMethod(null, '/') === 'replace' && leaveMethod(undefined, '/') === 'replace', '沒有上一頁：取代成目的地')

  r.section('新增紀錄的 ‹ 離開，各個入口的落點')
  r.check(leaveNewBrew(['/', '/brews/new']).join() === '/', '從總覽的浮動新增按鈕：回總覽')
  r.check(leaveNewBrew(['/brews', '/brews/new']).join() === '/brews', '從紀錄分頁的浮動新增按鈕：回紀錄分頁（只看網址的話會落在總覽）')
  r.check(leaveNewBrew(['/', '/brews/new?bean=b1']).join() === '/',
    '從總覽帶著 ?bean=（只有一支未喝完的豆子）：回總覽（只看網址的話會落在豆子詳情）')
  r.check(leaveNewBrew(['/brews', '/brews/new?bean=b1']).join() === '/brews', '從紀錄分頁帶著 ?bean=：回紀錄分頁')
  r.check(leaveNewBrew(['/beans', '/beans/b1', '/brews/new?bean=b1']).join() === '/beans,/beans/b1', '從豆子詳情帶著 ?bean=：回那支豆子')
  r.check(leaveNewBrew(['/brews', '/brews/r1', '/brews/new?copy=r1']).join() === '/brews,/brews/r1', '從紀錄詳情帶著 ?copy=：回來源紀錄')
  r.check(leaveNewBrew(['/beans', '/beans/b1', '/brews/new?copy=r9']).join() === '/beans,/beans/b1',
    '從豆子詳情帶著 ?copy=（照最近一次再沖）：回那支豆子，不是沒去過的來源紀錄')
  r.check(leaveNewBrew(['/brews/new']).join() === '/', '直接開網址、空白：總覽')
  r.check(leaveNewBrew(['/brews/new?bean=b1']).join() === '/beans/b1', '直接開網址、帶 ?bean=：那支豆子')
  r.check(leaveNewBrew(['/brews/new?copy=r1']).join() === '/brews/r1', '直接開網址、帶 ?copy=：來源紀錄')
  const afterLeave = [
    leaveNewBrew(['/', '/brews/new']), leaveNewBrew(['/brews', '/brews/new?bean=b1']),
    leaveNewBrew(['/brews/new']), leaveNewBrew(['/brews/new?copy=r1']),
  ]
  r.check(afterLeave.every(stack => !stack.some(path => path.startsWith('/brews/new'))), '兩種走法都不把表單留在 history 裡')

  r.section('單一入口的表單：‹ 離開的落點與原本相同')
  // 原本的規則：上一頁就是目的地時退回去，否則取代（exitMethod）
  const single: [string, Stack, string][] = [
    ['編輯紀錄（從紀錄詳情）', ['/brews', '/brews/r1', '/brews/r1/edit'], '/brews/r1'],
    ['新增豆子（從豆子列表）', ['/beans', '/beans/new'], '/beans'],
    ['編輯豆子（從豆子詳情）', ['/beans', '/beans/b1', '/beans/b1/edit'], '/beans/b1'],
    ['新增器材（從器材列表）', ['/equipment', '/equipment/new'], '/equipment'],
    ['編輯器材（從器材列表）', ['/equipment', '/equipment/e1/edit'], '/equipment'],
    ['編輯紀錄（直接開網址）', ['/brews/r1/edit'], '/brews/r1'],
    ['新增豆子（直接開網址）', ['/beans/new'], '/beans'],
    ['編輯豆子（直接開網址）', ['/beans/b1/edit'], '/beans/b1'],
    ['新增器材（直接開網址）', ['/equipment/new'], '/equipment'],
    ['編輯器材（直接開網址）', ['/equipment/e1/edit'], '/equipment'],
  ]
  for (const [name, stack, target] of single) {
    r.check(leave(stack, target).join() === exit(stack, target).join() && top(leave(stack, target)) === target,
      `${name}：落在 ${target}，history 與原本一樣`)
  }

  r.section('編輯頁找不到那一筆：不看上一頁，直接去列表')
  r.check(leaveMethod('/brews/r1', BREW_BACK_FALLBACK, true) === 'replace', '上一頁是那筆紀錄的詳情：不退回去（只會再看到一次「找不到」）')
  r.check(leave(['/brews', '/brews/r1', '/brews/r1/edit'], BREW_BACK_FALLBACK, true).join() === '/brews,/brews/r1,/brews',
    '編輯紀錄找不到：落在紀錄分頁（原本是 /）')
  r.check(top(leave(['/brews/r1/edit'], BREW_BACK_FALLBACK, true)) === '/brews', '直接開網址也一樣')
  r.check(top(leave(['/beans', '/beans/b1', '/beans/b1/edit'], BEAN_BACK_FALLBACK, true)) === '/beans', '編輯豆子找不到：豆子列表（不變）')
  r.check(leaveMethod('/brews', BREW_BACK_FALLBACK, true) === 'back', '上一頁剛好就是列表：退回去，不多一筆')

  return r.finish()
}
