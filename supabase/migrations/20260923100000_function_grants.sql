-- public schema 裡每一支函式的執行權，逐一收回。
--
-- **問題**：20260831170000_grants.sql 有
--     alter default privileges in schema public grant all on routines to anon, authenticated, service_role;
-- 所以之後建立的每一支函式都自動拿到 anon 的執行權。再加上 PostgreSQL 對函式的
-- 內建預設本來就是「EXECUTE 給 PUBLIC」，實際結果是：**未登入的人可以呼叫
-- public schema 裡的任何一支函式。**
--
-- 對 security definer 的函式來說，這等於把一支會繞過 RLS 的程式交給未登入的人。
-- 最具體的一支是 create_sample_data(uid uuid)：它吃一個 uuid 參數，然後以
-- 定義者的身分往 beans／user_equipment／brews／profiles 寫入。函式裡有
-- profiles.sample_seeded 的檢查擋著，所以實際能做的事有限（只能對一個「知道
-- uuid 且還沒被種過」的全新帳號塞進範例資料，既有資料一列都改不到、也讀不到
-- 任何東西），但「擋得住」與「碰不到」是兩件事，而且下一支 security definer
-- 函式不一定有同樣的檢查。
--
-- **原則：public schema 的函式一律不給角色執行權，需要的才明確 grant。**
-- 之後每一支新函式的 migration 都要自己寫 revoke ＋ grant，不要依賴
-- default privileges，也不要把函式內部的擁有者檢查當成唯一的防線。
-- 規則寫在《01》§14.3；tests/db/function-grants.test.mjs 會逐一掃描把關。
--
-- **三支函式為什麼都不需要角色的執行權**：
--   handle_new_user()    auth.users 上的 trigger。trigger 函式只能由 trigger 呼叫
--                        （直接呼叫會 raise），而 PostgreSQL 只在 create trigger
--                        當下檢查 EXECUTE，觸發時不再檢查
--   set_updated_at()     同上，beans／brews／profiles 上的 trigger
--   create_sample_data() 只被 handle_new_user 呼叫。後者是 security definer、
--                        擁有者是 postgres，函式內容以 postgres 的身分執行，
--                        而 postgres 是這支函式的擁有者，本來就有執行權
--
-- **service_role 保留。** 它是伺服器端的金鑰，不會出現在瀏覽器裡，而且它本來就
-- 繞過所有 RLS——對它收回執行權買不到任何東西。要收的是會送到用戶端的
-- anon 與 authenticated。
--
-- 可逆性：整支只有 revoke，沒有 drop、沒有 update／delete。要還原就是把
-- 對應的 grant 下回去（指令見本輪的回報）。不動任何一列使用者資料。

revoke all on function public.create_sample_data(uuid) from public, anon, authenticated;
revoke all on function public.handle_new_user()        from public, anon, authenticated;
revoke all on function public.set_updated_at()         from public, anon, authenticated;
