// 先載入既有資料才能顯示的頁面（編輯頁），畫面落在哪一種狀態。
//
// **只有 ready 才能渲染表單。** 編輯頁原本只分「讀取中」「找不到」「其餘顯示表單」，
// 載入失敗就掉進第三種：一張初始值全空、或分段退回模板、或風味標籤是空的表單。
// 那張表單可以儲存，而儲存會把原本那筆的欄位覆蓋掉、分段與標籤全刪重建——
// 不可逆，而且使用者看不出來表單裡的不是他的資料。
//
// 所以「已載入」必須是正面確認的狀態，不是「沒有出錯」的剩餘情況：
// 沒有錯誤訊息、但資料也沒到位，一樣當成錯誤。

export type LoadView = 'loading' | 'error' | 'notFound' | 'ready'

export function loadView(state: {
  loading: boolean
  loadError: string
  notFound: boolean
  /** 表單需要的資料全部到位 */
  loaded: boolean
}): LoadView {
  if (state.loading) return 'loading'
  if (state.loadError) return 'error'
  if (state.notFound) return 'notFound'
  return state.loaded ? 'ready' : 'error'
}

/**
 * 幾個查詢結果裡的第一個錯誤，沒有就是 null。
 *
 * supabase-js 查詢失敗不會拋出例外，是回傳 `{ data: null, error }`。
 * 只看 data 的話，主查詢失敗會被當成「找不到」，
 * 分段或標籤查詢失敗會被當成「這筆沒有分段、沒有標籤」。
 */
export function firstQueryError(...results: { error: unknown }[]): unknown {
  return results.find(result => result.error)?.error ?? null
}
