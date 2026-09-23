// 導覽規則（《03》§3）。畫面分三種，各有自己的導覽：
//
//   瀏覽型  首頁、豆子列表、器材列表     分頁列 ＋ 右下新增，頂部只有標題
//   檢視型  豆子詳情、紀錄詳情、設定      左上 ‹ 返回上一層，分頁列保留
//   流程型  所有表單                      左上 ‹ 離開（暫存保留），沒有分頁列
//
// 登入、註冊不屬於任何一種：還沒進到產品裡，沒有分頁列、也沒有上一層。
//
// 第四種是分享頁（《03》§3、《02》§7.2）：它的觀眾不一定是使用者。
//   分享頁  /s/[code]                     沒有 ‹，分頁列由登入狀態決定

export type ScreenKind = 'browse' | 'view' | 'flow' | 'share'

/**
 * 分頁列只在瀏覽型與檢視型出現。流程型的底部是儲存按鈕。
 * 分享頁是全站唯一由**登入狀態**決定的：未登入的人看到分頁列只會被帶到登入頁，
 * 已登入的人則確實可以從這裡回到自己的東西。
 */
export function showsTabBar(screen: unknown, signedIn = false): boolean {
  if (screen === 'share') return signedIn
  return screen === 'browse' || screen === 'view'
}

/**
 * 分頁列要亮哪一項。
 *   豆子詳情屬於豆子（有列表頁，‹ 也是回那裡）
 *   紀錄詳情沒有自己的列表頁，它出現在首頁時間軸——‹ 沒有歷史時也是回首頁
 *   設定從首頁的齒輪進去
 *   分享頁不亮任何一項：那筆紀錄不屬於看的人，亮「首頁」會暗示它在他的首頁上
 */
export function tabSection(path: string): '/' | '/beans' | '/equipment' | null {
  if (path === '/' || path.startsWith('/settings') || path.startsWith('/brews')) return '/'
  if (path.startsWith('/beans')) return '/beans'
  if (path.startsWith('/equipment')) return '/equipment'
  return null
}

/**
 * 新增沖煮紀錄的 ‹ 離開到哪裡。只看網址，重新整理之後仍然一樣：
 *   ?copy={id}  那筆來源紀錄（複製是從它出發的）
 *   ?bean={id}  那支豆子
 *   都沒有      首頁（全域新增按鈕在那裡）
 * 同時帶兩者時以複製為準，與表單的初始值、暫存 key 的規則一致。
 */
export function newBrewLeaveTarget(query: { copy?: string | null, bean?: string | null }): string {
  if (query.copy) return `/brews/${query.copy}`
  if (query.bean) return `/beans/${query.bean}`
  return '/'
}

/**
 * 紀錄詳情的 ‹ 沒有歷史時回到哪裡：首頁，紀錄實際出現的地方（時間軸）。
 *
 * 紀錄詳情的 ‹ 是**歷史式**，不是階層式。階層式只用在內容真的有父層列表頁
 * 的時候（豆子 → 豆子列表）。紀錄沒有自己的列表頁，只出現在首頁時間軸與
 * 豆子的比較表裡；把它的父層定成「它的豆子」是導覽自己的詮釋，
 * 資料模型裡紀錄才是主體，豆子只是它的一個維度（《03》§3）。
 */
export const BREW_BACK_FALLBACK = '/'

/**
 * 歷史式的 ‹：有上一頁就回上一頁，沒有（從外部連結直接打開）就去 fallback。
 * previous 是路由器記在 history.state.back 的上一頁；重新整理不會清掉它。
 */
export function historyBack(previous: string | null | undefined): 'back' | 'fallback' {
  return previous ? 'back' : 'fallback'
}

/**
 * 離開流程（儲存、刪除、‹ 離開）時怎麼走，目的是**流程頁不留在 history 裡**：
 *
 *   上一頁就是目的地  → 退回去（詳情 → 編輯 → 儲存：回到原本那一筆詳情，不再多一筆）
 *   其他              → 取代目前這一頁（新增 → 儲存：表單那一筆換成新紀錄的詳情）
 *
 * 用 push 的話，儲存後按返回會回到表單，刪除後按返回會看到「找不到」。
 * 只用 replace 也不夠：詳情 → 編輯 → 儲存會變成兩筆一樣的詳情，
 * 按 ‹ 或返回鍵看起來「沒有反應」。
 */
export function exitMethod(previous: string | null | undefined, target: string): 'back' | 'replace' {
  return previous === target ? 'back' : 'replace'
}
