/**
 * 目前登入者的 id。
 *
 * 為什麼需要這個包裝：@nuxtjs/supabase v2 的 useSupabaseUser() 回傳的是
 * auth.getClaims() 的 JWT payload，不是 User 物件。使用者 id 在 `sub`，
 * 沒有 `id` 這個欄位。而 JwtPayload 上有 `[key: string]: any` 索引簽章，
 * 因此誤寫成 user.value.id 不會被 typecheck 擋下，只會在執行期靜靜地變成
 * undefined，送到資料庫後被 RLS 以 42501 拒絕。
 *
 * 全站一律從這裡取使用者 id，不要再直接讀 useSupabaseUser()。
 */
export function useCurrentUserId() {
  const session = useSupabaseSession()
  const user = useSupabaseUser()
  return computed<string | null>(() => {
    // session 先於 claims：模組在 onAuthStateChange 裡同步更新 session，
    // claims 卻要等另一趟 getClaims() 才換。登入後立刻跳頁時，
    // 只看 claims 會拿到 null（剛登出）或上一個人的 id（沒登出就換帳號）——
    // 暫存 key 與查詢快取都依這個 id 分區，拿錯就是讀到別人的資料。
    //
    // 型別上 session 沒有 user：伺服器端送過來的那份會刪掉 user。那只發生在
    // 整頁載入時，claims 也是同一趟從伺服器拿的、不會是舊的，退回 claims 即可。
    // 客戶端的登入、登出、換 token 拿到的是完整的 session，user 在。
    const fromSession = (session.value as { user?: { id?: unknown } } | null)?.user?.id
    if (typeof fromSession === 'string' && fromSession) return fromSession
    const sub = user.value?.sub
    return typeof sub === 'string' && sub ? sub : null
  })
}
