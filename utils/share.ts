// 分享沖煮紀錄（《01》§14、《02》§7.1、§7.2）。
//
// 這裡不碰 window、navigator 與 Supabase，全部由呼叫端注入，才能在 Node 裡測。

/** 網址上那一段：16 bytes 的亂數轉 base64url，22 個字元（與 brew_shares.code 的 check 一致） */
export const SHARE_CODE_PATTERN = /^[A-Za-z0-9_-]{22}$/

/**
 * 產生分享代碼。**必須由用戶端產生**：iOS Safari 的系統分享要在點擊的同一個事件裡
 * 同步呼叫，等不了一趟網路請求，所以網址在點擊的那一瞬間就要是已知的（《02》§7.1）。
 *
 * 用 crypto.getRandomValues，不用 Math.random：代碼就是這個連結唯一的保護，
 * 猜得到代碼就看得到紀錄。
 */
export function generateShareCode(
  fill: (bytes: Uint8Array) => Uint8Array = bytes => crypto.getRandomValues(bytes),
): string {
  const bytes = fill(new Uint8Array(16))
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function shareUrl(origin: string, code: string): string {
  return `${origin.replace(/\/+$/, '')}/s/${code}`
}

// ══════════════════════════════════════════════════════════════
// get_shared_brew 的回傳值
// ══════════════════════════════════════════════════════════════
//
// **白名單 ＝ 分享頁實際顯示的欄位，一欄都不能多**（《01》§14.2）。
// 函式回傳了畫面上沒顯示的欄位，一般人看不到，但任何人打開開發者工具就看得到——
// 等於不知不覺多公開了資料。三個地方要一起改：
//   supabase/migrations/…_brew_shares.sql 的 get_shared_brew
//   這份清單（tests/db/shares.test.mjs 比對函式實際回傳的 key）
//   pages/s/[code].vue（tests/unit/share-wiring.test.mjs 確認每一個都有用到）

/** 回傳值裡所有 key 的路徑。陣列元素寫成 `steps[].note`，純量陣列寫成 `flavor_tags[]` */
export const SHARED_BREW_KEYS = [
  'is_owner',
  'bean.name', 'bean.roaster', 'bean.roast_level', 'bean.roast_date',
  'brewed_at', 'dose', 'water_temp', 'grind_setting', 'total_time', 'method',
  'grinder', 'dripper', 'kettle',
  'steps[].step_index', 'steps[].step_type', 'steps[].cumulative_water', 'steps[].hold_seconds', 'steps[].note',
  'rating', 'is_favorite',
  'intensity.acidity', 'intensity.sweetness', 'intensity.body', 'intensity.bitterness',
  'flavor_tags[]',
  // 只在特定條件下出現
  'tasting_notes', // 分享時勾了「包含心得筆記」，而且紀錄有心得
  'brew_id', // 開啟的人是分享者本人
] as const

/** 回傳值裡實際出現的 key 路徑（測試用：與 SHARED_BREW_KEYS 比對） */
export function keyPaths(value: unknown, prefix = ''): string[] {
  if (Array.isArray(value)) {
    const inner = value.flatMap(item => keyPaths(item, `${prefix}[]`))
    return inner.length ? inner : value.length ? [`${prefix}[]`] : []
  }
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, child]) => {
      const path = prefix ? `${prefix}.${key}` : key
      const nested = keyPaths(child, path)
      return nested.length ? nested : [path]
    })
  }
  return prefix ? [prefix] : []
}

export interface SharedBrew {
  is_owner: boolean
  brew_id?: string
  bean: {
    name: string
    roaster: string | null
    roast_level: 'light' | 'medium_light' | 'medium' | 'medium_dark' | 'dark' | null
    roast_date: string | null
  }
  brewed_at: string
  dose: number | null
  water_temp: number | null
  grind_setting: number | null
  total_time: number | null
  method: string | null
  grinder: string | null
  dripper: string | null
  kettle: string | null
  steps: {
    step_index: number
    step_type: 'bloom' | 'pour' | 'stir' | 'wait'
    cumulative_water: number
    hold_seconds: number | null
    note: string | null
  }[]
  rating: number | null
  is_favorite: boolean
  intensity: Partial<Record<'acidity' | 'sweetness' | 'body' | 'bitterness', number>> | null
  flavor_tags: string[]
  tasting_notes?: string
}

// ══════════════════════════════════════════════════════════════
// 按下「分享」
// ══════════════════════════════════════════════════════════════

export type DeliveryResult = 'shared' | 'copied' | 'cancelled' | 'failed'

export interface DeliveryEnv {
  /** navigator.share；瀏覽器不支援時不給 */
  share?: (data: { url: string }) => Promise<void>
  /** 寫進剪貼簿 */
  copy: (text: string) => Promise<void>
}

/**
 * 把連結交給系統分享選單，不支援就複製。
 *
 * **share() 或 copy() 在這個函式回傳之前就已經被呼叫**——呼叫端必須在點擊事件裡
 * 直接呼叫它，前面不能有任何 await（iOS Safari 會判定不屬於那個手勢而拒絕）。
 *
 * 使用者在系統選單裡取消（AbortError）不算失敗：那是他改變主意，不是出錯。
 * 其他錯誤（例如手勢失效的 NotAllowedError）退回複製；複製也失敗才是 failed。
 */
export function deliverShareLink(url: string, env: DeliveryEnv): Promise<DeliveryResult> {
  const copy = () => env.copy(url).then(() => 'copied' as const, () => 'failed' as const)
  if (!env.share) return copy()
  return env.share({ url }).then(
    () => 'shared' as const,
    (error: unknown) => (error as { name?: string } | null)?.name === 'AbortError' ? 'cancelled' as const : copy(),
  )
}

/**
 * 點擊「分享」的順序（《02》§7.1）：
 *   1. 同步把連結交出去（deliver）
 *   2. 同一個 handler 裡**不等待**地發出建立請求（create）
 *
 * 已經建立過（或建立請求還在路上）時不再建立：代碼已經在手上，
 * 按下去只是再叫一次系統選單。
 */
export function startShare<T>(options: {
  url: string
  alreadyCreated: boolean
  deliver: (url: string) => Promise<DeliveryResult>
  create: () => Promise<T>
}): { delivery: Promise<DeliveryResult>, creation: Promise<T> | null } {
  const delivery = options.deliver(options.url)
  const creation = options.alreadyCreated ? null : options.create()
  return { delivery, creation }
}

/**
 * 建立請求回來之後該顯示什麼（對話框已經關了，提示在頁面層級）。
 *
 *   ok        建立成功（或本來就有、而且就是這個代碼）
 *   failed    請求失敗：連結已經送出去但不會動。「再試一次」用同一個代碼重送
 *   mismatch  回來的代碼不是送出去的那個：這筆紀錄已經在別的裝置分享過。
 *             送出去的連結永遠不會動，重送也沒用——不給「再試一次」，
 *             改用既有的代碼，再打開對話框按一次「分享」就對了
 */
export function creationOutcome(sent: string, result: { code: string | null, error: unknown }):
  { kind: 'ok', code: string } | { kind: 'failed' } | { kind: 'mismatch', code: string } {
  if (result.error || !result.code) return { kind: 'failed' }
  if (result.code !== sent) return { kind: 'mismatch', code: result.code }
  return { kind: 'ok', code: sent }
}
