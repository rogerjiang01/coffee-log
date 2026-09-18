// 編輯頁的畫面狀態：只有資料全部到位才能渲染表單。
//
// 回歸的情境：編輯頁載入失敗，卻渲染出一張空白（或分段退回模板、標籤是空的）
// 表單。那張表單可以儲存，儲存會覆蓋原本那筆、分段與標籤全刪重建——不可逆。

import { firstQueryError, loadView } from '../../utils/loadState.ts'
import { createReport } from '../helpers/report.mjs'

const base = { loading: false, loadError: '', notFound: false, loaded: false }

export default function run() {
  const r = createReport('編輯頁的載入狀態')

  r.section('表單只在資料到位時出現')
  r.check(loadView({ ...base, loaded: true }) === 'ready', '讀到了：顯示表單')
  r.check(loadView({ ...base, loading: true }) === 'loading', '讀取中：骨架')
  r.check(loadView({ ...base, notFound: true }) === 'notFound', '查無此筆：找不到')

  r.section('任何失敗都不能落到表單')
  r.check(loadView({ ...base, loadError: '讀不到資料' }) === 'error', '有錯誤訊息：錯誤狀態')
  r.check(loadView({ ...base, loadError: '讀不到資料', loaded: true }) === 'error',
    '資料有一部分、但出過錯：仍是錯誤狀態，不顯示不完整的表單')
  r.check(loadView(base) === 'error', '沒有錯誤訊息、資料也沒到：當成錯誤，不是表單')
  r.check(loadView({ ...base, loading: true, loaded: true }) === 'loading', '重試中：回到骨架')

  r.section('supabase-js 的錯誤不會拋出，要自己看')
  const ok = { data: [], error: null }
  const failed = { data: null, error: { message: 'Failed to fetch' } }
  r.check(firstQueryError(ok, ok, ok) === null, '全部成功：沒有錯誤')
  r.check(firstQueryError(ok, failed, ok) === failed.error, '分段查詢失敗也算——不能當成「這筆沒有分段」')
  r.check(firstQueryError(failed) === failed.error, '主查詢失敗：是錯誤，不是「找不到」')

  return r.finish()
}
