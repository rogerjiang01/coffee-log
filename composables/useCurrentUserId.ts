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
  const user = useSupabaseUser()
  return computed<string | null>(() => {
    const sub = user.value?.sub
    return typeof sub === 'string' && sub ? sub : null
  })
}
