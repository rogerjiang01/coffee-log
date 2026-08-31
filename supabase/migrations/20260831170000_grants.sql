-- 補上 table privilege。
--
-- 存取要通過兩層：先是 PostgreSQL 的 table privilege，再才是 RLS policy。
-- 前面的 migration 只寫了 RLS，privilege 依賴 Supabase 平台的
-- `alter default privileges` 預設，但該預設在本專案並未生效，
-- push 之後所有查詢都是 permission denied，症狀很像 policy 寫錯。
--
-- 這段必須留在版控裡：只在遠端用 SQL Editor 補，重建環境時會再撞一次。
--
-- 授予 anon 是 Supabase 的平台慣例，實際把關的是 RLS。
-- 第一版 anon 其實不需要讀任何資料表（型錄與產國的 policy 都是
-- `to authenticated`），保留授予是為了與平台預設一致，
-- 避免未登入狀態下出現 permission denied 這種難以判讀的錯誤。

grant usage on schema public to anon, authenticated, service_role;

grant all on all tables    in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all routines  in schema public to anon, authenticated, service_role;

-- 之後新增的物件自動授予，避免下一個 migration 又漏掉
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on routines to anon, authenticated, service_role;
