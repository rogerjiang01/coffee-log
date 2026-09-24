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
export const SESSION_EXPIRED = '登入已過期，請重新登入'

/** 錯誤碼 → 中文。auth 用字串碼，Postgres 用 SQLSTATE。 */
const BY_CODE: Record<string, string> = {
  // ── Auth ────────────────────────────────────────────────
  invalid_credentials: '電子郵件或密碼錯誤',
  email_not_confirmed: '帳號尚未完成信箱確認，請查看註冊時寄出的確認信',
  email_exists: '這個信箱已經註冊，請直接登入',
  user_already_exists: '這個信箱已經註冊，請直接登入',
  signup_disabled: '這個站台目前關閉註冊',
  email_provider_disabled: '這個站台目前關閉以電子郵件註冊',
  weak_password: '密碼至少 6 個字元',
  validation_failed: '電子郵件格式錯誤',
  over_request_rate_limit: '嘗試次數過多，請稍後再試',
  over_email_send_rate_limit: '寄信次數過多，請幾分鐘後再試',
  session_expired: SESSION_EXPIRED,
  refresh_token_not_found: SESSION_EXPIRED,

  // ── PostgREST ───────────────────────────────────────────
  PGRST301: SESSION_EXPIRED,
  PGRST116: '找不到這筆資料，可能已被刪除',

  // ── Postgres（SQLSTATE）─────────────────────────────────
  '23502': '有必填欄位沒有填',
  '23503': '關聯的資料已不存在，請重新選擇',
  '23505': '這筆資料已經存在',
  '23514': '填的值超出允許範圍',
  '22P02': '欄位格式錯誤',
  '42501': '沒有權限存取這筆資料，請確認登入的帳號',
  '57014': '查詢逾時，請再試一次',
}

/**
 * 訊息文字比對。只放錯誤碼涵蓋不到的情況——
 * Supabase 有些錯誤沒帶 code，或舊版只有訊息。
 */
const BY_TEXT: [RegExp, string][] = [
  [/Invalid login credentials/i, '電子郵件或密碼錯誤'],
  [/Email not confirmed/i, '帳號尚未完成信箱確認，請查看註冊時寄出的確認信'],
  [/already registered|User already registered/i, '這個信箱已經註冊，請直接登入'],
  [/Email signups are disabled|Signups not allowed/i, '這個站台目前關閉註冊'],
  [/Password should be at least/i, '密碼至少 6 個字元'],
  [/invalid format|Unable to validate email/i, '電子郵件格式錯誤'],
  [/Too many requests|rate limit/i, '嘗試次數過多，請稍後再試'],
  [/row-level security policy/i, '沒有權限存取這筆資料，請確認登入的帳號'],
  [/violates foreign key constraint/i, '關聯的資料已不存在，請重新選擇'],
  [/duplicate key value/i, '這筆資料已經存在'],
  [/JWT expired|token is expired/i, SESSION_EXPIRED],
  // 網路中斷各家瀏覽器的說法都不同：Chrome 是 Failed to fetch、
  // Safari 是 Load failed、Firefox 是 NetworkError
  [/Failed to fetch|NetworkError|Load failed|ERR_INTERNET_DISCONNECTED/i,
    '無法連線到伺服器，請檢查網路'],
  [/timeout|timed out/i, '伺服器沒有回應，請再試一次'],
]

const REPORT_HINT = '請截圖回報'

/**
 * 錯誤畫面上的聯絡信箱。這一句是開發者直接跟使用者說話，保留溝通語氣（《03》§5.5 的例外）。
 * 有錯誤代碼時帶進信件主旨：使用者不必自己抄代碼，收到信也一眼對得上是哪一個錯誤。
 */
export const SUPPORT_EMAIL = 'rogerjiang01@gmail.com'

export function supportMailto(code?: string | null): string {
  const subject = code ? `手沖咖啡紀錄 錯誤回報 ${code}` : '手沖咖啡紀錄 錯誤回報'
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`
}

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
 * 只留原因、不附動作：接在另一句已經說了要做什麼的訊息後面用（例如括號裡的技術原因），
 * 同一則訊息才不會出現兩個「請」。
 * 「無法連線到伺服器，請檢查網路」→「無法連線到伺服器」；「原文。請截圖回報」→「原文」
 */
export function errorCause(error: unknown): string {
  return errorText(error).replace(/[，。]請[^，。]*$/, '')
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
