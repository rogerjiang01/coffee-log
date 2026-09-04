// Supabase 錯誤訊息的中文對應（CLAUDE.md 階段 10 待辦第一條）。
//
// 在此之前，auth 與資料庫的錯誤都是把英文原文直接貼到畫面上，
// 使用者看到的是 `new row violates row-level security policy`。
//
// 對應優先看錯誤碼，其次才比對訊息文字：
// 錯誤碼是穩定介面，訊息文字會隨 Supabase 版本改寫。
//
// **對不上的一律保留原文並附上「請截圖回報」。** 吞掉未知錯誤、
// 換成「發生錯誤」這類萬用句，會讓真正的問題查不出來——原文再難看，
// 也比查不到根因好。

interface ErrorLike {
  code?: string
  message?: string
  status?: number
  statusCode?: string | number
}

/**
 * 「還沒登入」不是從 Supabase 回來的錯誤物件，是我們自己檢查出來的，
 * 所以需要一個可以直接引用的常數——原本 9 個檔案各自硬寫，
 * 寫出來的句子還跟這裡的對應表不一樣。
 */
export const SESSION_EXPIRED = '登入已經過期，重新登入一次'

/** 錯誤碼 → 中文。auth 用字串碼，Postgres 用 SQLSTATE。 */
const BY_CODE: Record<string, string> = {
  // ── Auth ────────────────────────────────────────────────
  invalid_credentials: '電子郵件或密碼不對，再確認一次',
  email_not_confirmed: '這個帳號還沒完成信箱確認，收一下註冊時寄出的信',
  email_exists: '這個信箱已經註冊過了，直接登入就好',
  user_already_exists: '這個信箱已經註冊過了，直接登入就好',
  signup_disabled: '這個站台目前關閉註冊',
  email_provider_disabled: '這個站台目前關閉以電子郵件註冊',
  weak_password: '密碼至少 6 個字元',
  validation_failed: '電子郵件格式不對',
  over_request_rate_limit: '嘗試次數太多，等一下再試',
  over_email_send_rate_limit: '寄信次數太多，等幾分鐘再試',
  session_expired: SESSION_EXPIRED,
  refresh_token_not_found: SESSION_EXPIRED,

  // ── PostgREST ───────────────────────────────────────────
  PGRST301: SESSION_EXPIRED,
  PGRST116: '找不到這筆資料，可能已經被刪掉了',

  // ── Postgres（SQLSTATE）─────────────────────────────────
  '23502': '有必填欄位沒有填',
  '23503': '這筆資料連到的對象已經不在了，重新選一次',
  '23505': '這筆資料已經存在，不用重複新增',
  '23514': '填的值超出允許範圍',
  '22P02': '欄位格式不對',
  '42501': '沒有權限存取這筆資料，確認是不是登入的帳號不對',
  '57014': '查詢太久被中止，再試一次',
}

/**
 * 訊息文字比對。只放錯誤碼涵蓋不到的情況——
 * Supabase 有些錯誤沒帶 code，或舊版只有訊息。
 */
const BY_TEXT: [RegExp, string][] = [
  [/Invalid login credentials/i, '電子郵件或密碼不對，再確認一次'],
  [/Email not confirmed/i, '這個帳號還沒完成信箱確認，收一下註冊時寄出的信'],
  [/already registered|User already registered/i, '這個信箱已經註冊過了，直接登入就好'],
  [/Email signups are disabled|Signups not allowed/i, '這個站台目前關閉註冊'],
  [/Password should be at least/i, '密碼至少 6 個字元'],
  [/invalid format|Unable to validate email/i, '電子郵件格式不對'],
  [/Too many requests|rate limit/i, '嘗試次數太多，等一下再試'],
  [/row-level security policy/i, '沒有權限存取這筆資料，確認是不是登入的帳號不對'],
  [/violates foreign key constraint/i, '這筆資料連到的對象已經不在了，重新選一次'],
  [/duplicate key value/i, '這筆資料已經存在，不用重複新增'],
  [/JWT expired|token is expired/i, SESSION_EXPIRED],
  // 網路中斷各家瀏覽器的說法都不同：Chrome 是 Failed to fetch、
  // Safari 是 Load failed、Firefox 是 NetworkError
  [/Failed to fetch|NetworkError|Load failed|ERR_INTERNET_DISCONNECTED/i,
    '連不上伺服器，檢查一下網路再試'],
  [/timeout|timed out/i, '等太久沒有回應，再試一次'],
]

const REPORT_HINT = '請截圖回報'

function shapeOf(error: unknown): ErrorLike {
  if (typeof error === 'string') return { message: error }
  if (error && typeof error === 'object') return error as ErrorLike
  return {}
}

/**
 * 把任何 Supabase／瀏覽器錯誤轉成可以直接顯示的中文。
 * 對不上時回「原文。請截圖回報」。
 */
export function errorText(error: unknown): string {
  const { code, message, statusCode } = shapeOf(error)

  const key = code ?? (typeof statusCode === 'string' ? statusCode : undefined)
  if (key && BY_CODE[key]) return BY_CODE[key]!

  const text = (message ?? '').trim()
  if (!text) return `發生未預期的錯誤。${REPORT_HINT}`

  for (const [pattern, zh] of BY_TEXT) {
    if (pattern.test(text)) return zh
  }

  // 已經是中文的訊息（我們自己丟出來的）不要再加提示
  if (/[一-鿿]/.test(text)) return text

  return `${text}。${REPORT_HINT}`
}

/**
 * 給 `if (error) throw toError(error)` 用。
 *
 * 在 throw 的當下就轉換，因為 catch 只拿得到 message，
 * code 到那時已經掉了——那正是原本錯誤訊息中文化做不起來的原因。
 */
export function toError(error: unknown): Error {
  return new Error(errorText(error))
}

/**
 * 可回報的錯誤代碼，給 error.vue 用。
 *
 * 取自狀態碼與錯誤訊息的雜湊：**同一個錯誤永遠算出同一組代碼**，
 * 使用者截圖回報時對得起來，但畫面上不會出現 stack trace 或內部路徑。
 * 這不是加密，只是縮短——用途是比對，不是保護。
 */
export function errorReportCode(error: unknown): string {
  const { statusCode, statusMessage, message } = (error ?? {}) as {
    statusCode?: number, statusMessage?: string, message?: string
  }
  const source = `${statusCode ?? 0}:${statusMessage ?? ''}:${message ?? ''}`
  let hash = 0
  for (let i = 0; i < source.length; i++) {
    hash = (hash * 31 + source.charCodeAt(i)) | 0
  }
  return `E${statusCode ?? 0}-${Math.abs(hash).toString(16).toUpperCase().padStart(6, '0').slice(0, 6)}`
}
