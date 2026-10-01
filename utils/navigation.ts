// 導覽規則（《03》§3）。畫面分三種，各有自己的導覽：
//
//   瀏覽型  總覽、紀錄分頁、豆子列表、器材列表   分頁列 ＋ 右下新增，頂部只有標題
//   檢視型  豆子詳情、紀錄詳情、設定              左上 ‹ 返回，分頁列保留
//   流程型  所有表單                              左上 ‹ 離開（暫存保留），沒有分頁列
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

/** 分頁列的四格，依序（《03》§3） */
export const TABS = [
  { to: '/', label: '總覽' },
  { to: '/brews', label: '紀錄' },
  { to: '/beans', label: '豆子' },
  { to: '/equipment', label: '器材' },
] as const

export type TabPath = typeof TABS[number]['to']

/**
 * 分頁列要亮哪一格。
 *   總覽      /、/settings（設定從總覽的齒輪進去）
 *   紀錄      /brews/…（紀錄有自己的列表頁，詳情與編輯都屬於它）
 *   豆子      /beans/…
 *   器材      /equipment/…
 *   分享頁    不亮任何一格：那筆紀錄不屬於看的人，亮哪一格都會暗示它在他的東西裡
 */
export function tabSection(path: string): TabPath | null {
  if (path === '/' || path.startsWith('/settings')) return '/'
  if (path.startsWith('/brews')) return '/brews'
  if (path.startsWith('/beans')) return '/beans'
  if (path.startsWith('/equipment')) return '/equipment'
  return null
}

/**
 * 浮動新增按鈕導向哪裡（總覽與紀錄分頁，兩處行為相同，《02》§4）：
 * 未喝完的豆子剛好一支時直接帶入那支豆子，少一步選擇；其他情況空白新增。
 */
export function newBrewEntry(activeBeans: readonly { id: string }[]): string {
  return activeBeans.length === 1 ? `/brews/new?bean=${activeBeans[0]!.id}` : '/brews/new'
}

/**
 * 新增沖煮紀錄的 ‹ 離開，**沒有上一頁時**到哪裡（有上一頁就退回上一頁，見 leaveMethod）。
 * 只看網址，重新整理之後仍然一樣：
 *   ?copy={id}  那筆來源紀錄（複製是從它出發的）
 *   ?bean={id}  那支豆子
 *   都沒有      總覽
 * 同時帶兩者時以複製為準，與表單的初始值、暫存 key 的規則一致。
 */
export function newBrewLeaveTarget(query: { copy?: string | null, bean?: string | null }): string {
  if (query.copy) return `/brews/${query.copy}`
  if (query.bean) return `/beans/${query.bean}`
  return '/'
}

/**
 * 兩個詳情頁的 ‹ 沒有上一頁時回到哪裡：各自的列表。
 *
 * 兩個詳情頁的 ‹ 都是**歷史式**（《03》§3）：它們各有不只一個入口——
 * 紀錄詳情從紀錄分頁、豆子的比較表、分享頁的「前往紀錄」進來；
 * 豆子詳情從總覽的沖煮中的豆子、豆子列表、紀錄詳情的豆名進來。
 * 固定回列表的話，從其他入口進來的人會被帶離原本的脈絡。
 */
export const BREW_BACK_FALLBACK = '/brews'
export const BEAN_BACK_FALLBACK = '/beans'

/**
 * 歷史式的 ‹：有上一頁就回上一頁，沒有（從外部連結直接打開）就去 fallback。
 * previous 是路由器記在 history.state.back 的上一頁；重新整理不會清掉它。
 */
export function historyBack(previous: string | null | undefined): 'back' | 'fallback' {
  return previous ? 'back' : 'fallback'
}

/**
 * 流程型的 ‹ 離開怎麼走（六張表單，《03》§3）：
 *
 *   站內有上一頁  → 退回上一頁（使用者實際來的地方）
 *   沒有上一頁    → 取代目前這一頁，換成依網址決定的目的地
 *
 * 只看網址不夠：新增紀錄有總覽與紀錄分頁兩個浮動新增按鈕，網址分不出使用者
 * 從哪裡來；帶著 ?bean= 從浮動按鈕進來時，依網址會落在豆子詳情而不是出發的那一頁。
 * 兩種走法都不把表單留在 history 裡。
 *
 * direct：編輯頁找不到那一筆時用。上一頁多半是那一筆的詳情，退回去只會再看到
 * 一次「找不到」，所以不看上一頁，直接去列表（走 exitMethod，上一頁剛好是列表才退回）。
 */
export function leaveMethod(
  previous: string | null | undefined,
  target: string,
  direct = false,
): 'back' | 'replace' {
  if (direct) return exitMethod(previous, target)
  return previous ? 'back' : 'replace'
}

/**
 * 儲存、刪除之後怎麼走，目的是**流程頁不留在 history 裡**：
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
