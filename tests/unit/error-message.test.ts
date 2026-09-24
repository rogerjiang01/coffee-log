// 錯誤訊息中文化。
//
// 這裡的關鍵不是「有沒有翻譯」，而是**對不上的時候要保留原文**。
// 把未知錯誤換成「發生錯誤」這種萬用句，使用者回報時就什麼線索都沒有了。

import { errorText, errorCause, toError, errorReportCode, SUPPORT_EMAIL, supportMailto } from '../../utils/errorMessage.ts'
import { createReport } from '../helpers/report.mjs'

export default function run() {
  const r = createReport('錯誤訊息中文化')

  r.section('登入與註冊')
  r.check(errorText({ code: 'invalid_credentials' }) === '電子郵件或密碼錯誤', '登入失敗')
  r.check(errorText({ message: 'Invalid login credentials' }) === '電子郵件或密碼錯誤',
    '沒有 code 時靠訊息文字比對')
  r.check(errorText({ message: 'Email signups are disabled' }) === '這個站台目前關閉註冊',
    '註冊被停用——這是實際撞到過的那一個')
  r.check(errorText({ code: 'signup_disabled' }) === '這個站台目前關閉註冊', '同一件事的 code 版本')
  r.check(errorText({ code: 'email_exists' }) === '這個信箱已經註冊，請直接登入', '重複的 email')
  r.check(errorText({ message: 'User already registered' }) === '這個信箱已經註冊，請直接登入',
    '重複的 email，訊息版本')

  r.section('資料庫')
  r.check(errorText({ code: '23503' }).includes('已不存在'), '外鍵違反')
  r.check(errorText({ message: 'insert or update on table "brews" violates foreign key constraint' })
    .includes('已不存在'), '外鍵違反，訊息版本')
  r.check(errorText({ code: '42501' }).includes('沒有權限'), 'RLS 拒絕')
  r.check(errorText({ message: 'new row violates row-level security policy for table "beans"' })
    .includes('沒有權限'), 'RLS 拒絕——這是實際撞到過的那一個')
  r.check(errorText({ code: '23505' }).includes('已經存在'), '唯一鍵重複')
  r.check(errorText({ code: '23502' }).includes('必填'), 'NOT NULL 違反')

  r.section('網路中斷')
  // 三家瀏覽器講法都不同，全部要接住
  r.check(errorText({ message: 'Failed to fetch' }).includes('無法連線到伺服器'), 'Chrome')
  r.check(errorText({ message: 'Load failed' }).includes('無法連線到伺服器'), 'Safari')
  r.check(errorText({ message: 'NetworkError when attempting to fetch resource.' })
    .includes('無法連線到伺服器'), 'Firefox')

  r.section('對不上的一律保留原文')
  const unknown = errorText({ message: 'something completely unexpected' })
  r.check(unknown.includes('something completely unexpected'), '原文留著，不吞掉')
  r.check(unknown.includes('請截圖回報'), '附上回報提示')
  r.check(errorText({ code: 'XX999', message: 'weird thing' }).includes('weird thing'),
    '不認得的 code 也走原文，不要硬套')

  r.section('已經是中文的訊息不再加工')
  r.check(errorText({ message: '照片沒有上傳成功：檔案太大' }) === '照片沒有上傳成功：檔案太大',
    '我們自己丟的中文訊息原樣通過，不會被接上「請截圖回報」')

  r.section('各種形狀都吃得下')
  r.check(errorText('Failed to fetch').includes('無法連線到伺服器'), '直接傳字串')
  r.check(errorText(new Error('Invalid login credentials')).includes('密碼錯誤'), 'Error 實例')
  r.check(errorText(null).includes('請截圖回報'), 'null 不會炸掉')
  r.check(errorText({}).includes('請截圖回報'), '空物件不會炸掉')
  r.check(errorText({ statusCode: '23503' }).includes('已不存在'), 'Storage 用 statusCode')

  r.section('toError 在 throw 的當下就轉換')
  // code 只活到 throw 為止，catch 拿到的只有 message——
  // 原本錯誤訊息中文化做不起來就是卡在這裡
  const thrown = toError({ code: '42501', message: 'new row violates row-level security policy' })
  r.check(thrown instanceof Error, '回傳的是 Error，catch 端的 instanceof 判斷仍然成立')
  r.check(thrown.message.includes('沒有權限'), 'message 已經是中文，catch 端直接用就對了')

  r.section('只留原因、不附動作（接在另一句說了動作的訊息後面）')
  r.check(errorCause({ message: 'Failed to fetch' }) === '無法連線到伺服器', '去掉「，請檢查網路」')
  r.check(errorCause({ code: '42501' }) === '沒有權限存取這筆資料', '去掉「，請確認登入的帳號」')
  r.check(errorCause({ message: 'something odd' }) === 'something odd', '對不上的原文：去掉「。請截圖回報」')
  r.check(errorCause({ code: 'invalid_credentials' }) === '電子郵件或密碼錯誤', '本來就沒有動作的原樣保留')
  r.check(errorCause({ code: '22P02' }) === '欄位格式錯誤' && errorCause({ code: 'validation_failed' }) === '電子郵件格式錯誤',
    '格式錯誤的兩句（不用「不對」）')

  r.section('錯誤回報的 mailto 連結')
  const mail = supportMailto('E500-1A2B3C')
  r.check(mail.startsWith(`mailto:${SUPPORT_EMAIL}?subject=`), '寄到聯絡信箱')
  r.check(decodeURIComponent(mail.split('subject=')[1]).includes('E500-1A2B3C'), '主旨帶有錯誤代碼')
  r.check(!/[\s　]/.test(mail), '主旨有編碼，連結裡沒有未編碼的空白')
  r.check(!decodeURIComponent(supportMailto(null).split('subject=')[1]).includes('null'), '沒有代碼時主旨不會出現 null')

  r.section('可回報的錯誤代碼')
  // error.vue 用它取代 stack trace。關鍵是「同一個錯誤永遠同一組」——
  // 每次都變的話使用者回報的代碼就對不起來，這個欄位等於白做。
  const boom = { statusCode: 500, statusMessage: 'Internal', message: 'boom' }
  r.check(errorReportCode(boom) === errorReportCode({ ...boom }), '同一個錯誤兩次算出同一組代碼')
  r.check(errorReportCode(boom) !== errorReportCode({ ...boom, message: 'other' }),
    '訊息不同就是不同代碼')
  r.check(errorReportCode(boom) !== errorReportCode({ ...boom, statusCode: 502 }),
    '狀態碼不同就是不同代碼')
  r.check(/^E500-[0-9A-F]{6}$/.test(errorReportCode(boom)),
    `格式是 E<狀態碼>-<六碼>：${errorReportCode(boom)}`)
  r.check(/^E404-[0-9A-F]{6}$/.test(errorReportCode({ statusCode: 404, message: 'x' })), '404 也一樣')
  r.check(/^E0-[0-9A-F]{6}$/.test(errorReportCode(null)), 'null 不會炸掉，狀態碼當 0')
  r.check(/^E0-[0-9A-F]{6}$/.test(errorReportCode({})), '空物件不會炸掉')
  r.check(!errorReportCode(boom).includes('boom'), '代碼不含原始訊息——不洩漏內部細節')
  r.check(!errorReportCode({ statusCode: 500, message: '/Users/someone/app/pages/x.vue:12' })
    .includes('/'), '就算訊息裡有檔案路徑，代碼裡也不會出現')

  return r.finish()
}
