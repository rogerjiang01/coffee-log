-- 資料表：新表預設沒有任何權限，需要什麼由建表的那支 migration 明確給。
--
-- **背景**：Supabase 從 2026-10-30 起，public schema 的新資料表不再自動授權給 Data API
-- （既有的表保留現在的權限）。之後建表的 migration 沒有自己 grant，查詢就是 permission denied，
-- 本機重建與 preview branch 也一樣。
--
-- **問題**：20260831170000_grants.sql 自己設了
--     alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
--     alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
-- 本機與測試資料庫只有這一份設定，所以新表在本機照樣自動拿到權限——漏寫 grant 時本機一切正常，
-- 推上去才 permission denied。而 anon 也跟著自動拿到，靠的是之後每一支 migration 記得 revoke。
--
-- **做法**：把這兩條收回，而不是去對齊 Supabase 的實作。收回之後新表的權限只剩
-- PostgreSQL 的內建預設（只有擁有者；資料表與 sequence 的內建預設沒有 PUBLIC，
-- 這點和函式不同），不管 Supabase 那邊怎麼改，本機、preview、正式庫的結果都一樣。
-- 建表的 migration 自己寫 revoke all ＋ grant，規則在 CLAUDE.md，
-- tests/db/table-grants.test.mjs 用白名單把關。
--
-- 只動 postgres 在 public schema 的設定（migration 都是以 postgres 執行）。
-- supabase_admin 的 default privileges 是平台自己的，不動。
-- **函式的 default privileges 不動**（20260923100000_function_grants.sql 已決定：
-- 函式一律在自己的 migration 裡 revoke ＋ grant，由 tests/db/function-grants.test.mjs 把關）。
--
-- 可逆性：整支只有 alter default privileges 與 revoke，沒有 drop、沒有 update／delete，
-- 不動任何一列資料。還原指令見本輪的回報。

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated, service_role;

-- ── anon 對既有資料表：全部收回 ──────────────────────────────────
--
-- 20260923110000_brew_shares.sql 已經對存著紀錄內容的表收回 anon，剩下這七張。
-- 收回之後 anon 對 public schema 的任何一張表都沒有 table privilege。
--
--   profiles              policy 是 auth.uid() = id，anon 本來就讀到 0 列
--   countries             policy 是 to authenticated，anon 本來就讀到 0 列
--   equipment_catalog     同上
--   brew_methods          select policy 沒有 to，anon 讀得到系統項目（user_id is null）
--   flavor_tags           同上
--   processing_methods    同上
--   varieties             同上
--
-- 未登入時會經過的流程都不直接讀表：登入、註冊只呼叫 Supabase Auth
-- （註冊後的 profile 與範例資料由 security definer 的 handle_new_user 建立）；
-- 分享頁只呼叫 get_shared_brew（security definer）與伺服器端的照片 API；錯誤頁不碰資料庫。
--
-- authenticated 與 service_role 的權限一個字都不動。

revoke all on table
  profiles, countries, equipment_catalog, brew_methods, flavor_tags, processing_methods, varieties
  from anon;
