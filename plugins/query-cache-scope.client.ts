// 查詢快取依使用者分區（composables/useQueryCache.ts）。
//
// 接的是 useCurrentUserId：它先看 session，session 在登入、登出的當下就同步換掉，
// 所以登入後跳到首頁時分區已經是新的使用者，第一個畫面不會用到上一個人的格子。

export default defineNuxtPlugin(() => {
  const userId = useCurrentUserId()
  setQueryCacheScope(() => userId.value)
})
