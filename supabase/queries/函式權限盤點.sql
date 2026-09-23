-- public schema 的函式權限盤點：部署前後各跑一次，**推完之後結果必須是 0 列**。
--
-- 為什麼需要這支：tests/db/function-grants.test.mjs 做的是同一件事，但它跑在
-- 本機用 migration 建出來的資料庫上，**看不到後台建的東西**。rls_auto_enable()
-- 就是這樣漏掉的——它是 Supabase 後台「Auto-enable RLS for new tables」設定
-- 建的，只存在於正式庫。能看到正式庫實際狀態的只有在正式庫上跑的查詢。
--
-- 在 Supabase SQL Editor 直接執行。它只讀 pg_catalog，不動任何資料。
--
-- ── 每一列是一個問題 ─────────────────────────────────────
--
--   對 anon／authenticated 開放，但不在白名單上
--       最要緊的一種。新函式忘了 revoke，或後台又建了一支
--   不在任何 migration 裡，也不是已知的後台物件
--       有人在後台（SQL Editor、設定頁）建了函式。先查清楚是什麼，
--       再決定要收進 migration、在 migration 裡 revoke、還是刪掉
--   security definer 卻沒有鎖 search_path
--       呼叫端可以用自己的 schema 蓋掉函式裡用到的名字，比執行權更直接的提權
--   在白名單上，卻沒有執行權
--       反方向的錯：要開放的函式忘了 grant，前端呼叫會是 permission denied
--
-- **推之前**跑出來有列是正常的，那正是這次 migration 要修的東西——
-- 拿來確認 migration 有涵蓋到。**推之後**必須是 0 列，有列就停下來查，不要推程式。
--
-- ── 兩份清單，要與程式碼同步 ─────────────────────────────
--
-- known：public schema 裡應該存在的函式。migration 建的，加上已知的後台物件。
-- allowed：明確開放給用戶端呼叫的函式，要與 tests/db/function-grants.test.mjs
--          的 ALLOWED 一致。
-- tests/unit/function-audit-query.test.mjs 會比對這兩份清單與 migration、測試，
-- 新增函式時忘了改這裡會失敗。
--
-- 擴充套件建的函式（例如之後裝 pg_trgm 到 public）不在盤點範圍：它們屬於套件，
-- 不是這個專案寫的。

with known(name, source) as (values
  ('create_sample_data', 'migration：20260922110000_sample_data.sql'),
  ('handle_new_user',    'migration：20260831160400_profiles.sql'),
  ('set_updated_at',     'migration：20260831170100_updated_at_triggers.sql'),
  ('rls_auto_enable',    '後台：Authentication → Auto-enable RLS for new tables（event trigger ensure_rls）')
),

-- 目前沒有任何函式對用戶端開放（前端沒有 .rpc() 呼叫）。
-- 之後加的格式：('get_shared_brew', 'anon'), ('get_shared_brew', 'authenticated'),
allowed(name, role) as (
  select * from (values
    (null::text, null::text)
  ) v(name, role)
  where v.name is not null
),

fns as (
  select p.oid,
         p.proname as name,
         p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as signature,
         p.prosecdef,
         p.proconfig,
         pg_get_userbyid(p.proowner) as owner
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and not exists (
      select 1 from pg_depend d
      where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e'
    )
),

roles(role) as (values ('anon'), ('authenticated'))

select f.signature as 函式, f.owner as 擁有者,
       '對 ' || r.role || ' 開放，但不在白名單上' as 問題
from fns f cross join roles r
where has_function_privilege(r.role, f.oid, 'execute')
  and not exists (select 1 from allowed a where a.name = f.name and a.role = r.role)

union all

select f.signature, f.owner, '不在任何 migration 裡，也不是已知的後台物件'
from fns f
where f.name not in (select name from known)

union all

select f.signature, f.owner, 'security definer 卻沒有鎖 search_path'
from fns f
where f.prosecdef
  and not exists (select 1 from unnest(coalesce(f.proconfig, '{}')) c where c like 'search_path=%')

union all

select a.name, null, '在白名單上，卻沒有對 ' || a.role || ' 的執行權'
from allowed a
where not exists (
  select 1 from fns f
  where f.name = a.name and has_function_privilege(a.role, f.oid, 'execute')
)

order by 1, 3;
