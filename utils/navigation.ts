// 導覽規則（《03》§3）。畫面分三種，各有自己的導覽：
//
//   瀏覽型  首頁、豆子列表、器材列表     分頁列 ＋ 右下新增，頂部只有標題
//   檢視型  豆子詳情、紀錄詳情、設定      左上 ‹ 返回上一層，分頁列保留
//   流程型  所有表單                      左上 ‹ 離開（暫存保留），沒有分頁列
//
// 登入、註冊不屬於任何一種：還沒進到產品裡，沒有分頁列、也沒有上一層。

export type ScreenKind = 'browse' | 'view' | 'flow'

/** 分頁列只在瀏覽型與檢視型出現。流程型的底部是儲存按鈕 */
export function showsTabBar(screen: unknown): boolean {
  return screen === 'browse' || screen === 'view'
}

/**
 * 分頁列要亮哪一項。依內容的階層，與 ‹ 返回的方向一致：
 * 紀錄屬於豆子（‹ 回到它的豆子），所以紀錄詳情亮「豆子」；設定從首頁進去，亮「首頁」。
 */
export function tabSection(path: string): '/' | '/beans' | '/equipment' | null {
  if (path === '/' || path.startsWith('/settings')) return '/'
  if (path.startsWith('/beans') || path.startsWith('/brews')) return '/beans'
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

/** 紀錄詳情的 ‹：回到這筆紀錄的豆子。資料還沒到（或找不到）時回豆子列表 */
export function brewParent(beanId: string | null | undefined): string {
  return beanId ? `/beans/${beanId}` : '/beans'
}
