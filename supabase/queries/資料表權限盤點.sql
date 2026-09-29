-- public schema 的資料表權限盤點：部署前後各跑一次，**推完之後結果必須是 0 列**。
--
-- 與 函式權限盤點.sql 是一對，理由也相同：tests/db/table-grants.test.mjs 做的是同一件事，
-- 但它跑在本機用 migration 建出來的資料庫上，看不到後台建的東西
-- （例如在 SQL Editor 或 Table Editor 建的表）。能看到正式庫實際狀態的只有在正式庫上跑的查詢。
--
-- 在 Supabase SQL Editor 直接執行。它只讀 pg_catalog，不動任何資料。
--
-- ── 每一列是一個問題 ─────────────────────────────────────
--
--   沒有啟用 RLS
--       正式庫有後台的自動啟用，但本機沒有，所以建表的 migration 要自己寫
--   不在任何 migration 裡
--       有人在後台建了表。先查清楚，再決定收進 migration 還是刪掉
--   在清單上，但資料庫裡沒有這張表
--       建表的 migration 還沒推上去，或清單過期了
--   權限與白名單不一致（多了／少了哪些）
--       多了：建表時漏了 revoke all，或有人在後台 grant。對 anon 多了任何一項都是最要緊的
--       少了：該給的忘了 grant，前端查詢會是 permission denied
--   有欄位層級授權
--       白名單只管表層級。欄位層級的 grant 會讓沒有表權限的角色讀到個別欄位
--   新建的資料表／sequence 會自動授權給某個角色
--       default privileges 又被加回去了（20261001100000_table_default_privileges.sql 收掉的那兩條）
--   sequence 有權限
--       目前沒有任何 sequence 需要授權給角色
--
-- **推之前**跑出來有列是正常的，那正是這次 migration 要修的東西——
-- 拿來確認 migration 有涵蓋到。**推之後**必須是 0 列，有列就停下來查，不要推程式。
--
-- ── 兩份清單，要與程式碼同步 ─────────────────────────────
--
-- known：public schema 裡應該存在的資料表，與建立它的 migration。
-- allowed：每張表對 anon／authenticated／service_role 的權限，
--          要與 tests/helpers/table-grants.mjs 的 TABLE_GRANTS 一致。沒列出的角色＝沒有任何權限。
--          'all' ＝ select, insert, update, delete, truncate, references, trigger。
-- tests/unit/table-audit-query.test.mjs 會比對這兩份清單與 migration、白名單，
-- 新增資料表時忘了改這裡會失敗。
--
-- 擴充套件建的表不在盤點範圍：它們屬於套件，不是這個專案寫的。
-- supabase_admin 的 default privileges 是平台自己的設定，不在盤點範圍。

with known(name, source) as (values
  ('profiles',           'migration：20260831160400_profiles.sql'),
  ('countries',          'migration：20260831160100_countries_regions.sql'),
  ('processing_methods', 'migration：20260831160200_lookup_tables.sql'),
  ('varieties',          'migration：20260831160200_lookup_tables.sql'),
  ('flavor_tags',        'migration：20260831160200_lookup_tables.sql'),
  ('brew_methods',       'migration：20260831160200_lookup_tables.sql'),
  ('equipment_catalog',  'migration：20260831160300_equipment_catalog.sql'),
  ('user_equipment',     'migration：20260831160500_user_equipment.sql'),
  ('beans',              'migration：20260831160600_beans.sql'),
  ('brews',              'migration：20260831160700_brews.sql'),
  ('brew_steps',         'migration：20260831160800_brew_steps_flavor_tags.sql'),
  ('brew_flavor_tags',   'migration：20260831160800_brew_steps_flavor_tags.sql'),
  ('brew_save_events',   'migration：20260922100000_brew_save_events.sql'),
  ('brew_shares',        'migration：20260923110000_brew_shares.sql'),
  ('brew_share_events',  'migration：20260923110000_brew_shares.sql')
),

-- anon 一列都沒有：匿名的人只透過 get_shared_brew 讀資料，不碰表
allowed(tbl, role, privs) as (values
  ('profiles',           'authenticated', 'all'),
  ('profiles',           'service_role',  'all'),
  ('beans',              'authenticated', 'all'),
  ('beans',              'service_role',  'all'),
  ('brews',              'authenticated', 'all'),
  ('brews',              'service_role',  'all'),
  ('brew_steps',         'authenticated', 'all'),
  ('brew_steps',         'service_role',  'all'),
  ('brew_flavor_tags',   'authenticated', 'all'),
  ('brew_flavor_tags',   'service_role',  'all'),
  ('user_equipment',     'authenticated', 'all'),
  ('user_equipment',     'service_role',  'all'),
  ('brew_methods',       'authenticated', 'all'),
  ('brew_methods',       'service_role',  'all'),
  ('flavor_tags',        'authenticated', 'all'),
  ('flavor_tags',        'service_role',  'all'),
  ('processing_methods', 'authenticated', 'all'),
  ('processing_methods', 'service_role',  'all'),
  ('varieties',          'authenticated', 'all'),
  ('varieties',          'service_role',  'all'),
  ('countries',          'authenticated', 'all'),
  ('countries',          'service_role',  'all'),
  ('equipment_catalog',  'authenticated', 'all'),
  ('equipment_catalog',  'service_role',  'all'),
  ('brew_save_events',   'authenticated', 'insert'),
  ('brew_save_events',   'service_role',  'all'),
  ('brew_shares',        'authenticated', 'select'),
  ('brew_shares',        'service_role',  'all'),
  ('brew_share_events',  'service_role',  'all')
),

privs(p, o) as (
  select * from unnest(array['select', 'insert', 'update', 'delete', 'truncate', 'references', 'trigger']) with ordinality
),

roles(role) as (values ('anon'), ('authenticated'), ('service_role')),

expected as (
  select a.tbl, a.role, x.p
  from allowed a
  cross join lateral unnest(
    case when a.privs = 'all' then array(select p from privs) else string_to_array(a.privs, ',') end
  ) as x(p)
),

tables as (
  select c.oid, c.relname as name, c.relkind, c.relrowsecurity as rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p', 'v', 'm', 'f')
    and not exists (
      select 1 from pg_depend d
      where d.classid = 'pg_class'::regclass and d.objid = c.oid and d.deptype = 'e'
    )
),

diff as (
  select t.name, r.role,
         (select string_agg(pv.p, ',' order by pv.o) from privs pv
           where has_table_privilege(r.role, t.oid, pv.p)
             and not exists (select 1 from expected e where e.tbl = t.name and e.role = r.role and e.p = pv.p)) as extra,
         (select string_agg(pv.p, ',' order by pv.o) from privs pv
           where not has_table_privilege(r.role, t.oid, pv.p)
             and exists (select 1 from expected e where e.tbl = t.name and e.role = r.role and e.p = pv.p)) as missing
  from tables t cross join roles r
)

select t.name as 對象, null as 角色, '沒有啟用 RLS' as 問題
from tables t
where t.relkind in ('r', 'p') and not t.rls

union all

select t.name, null, '不在任何 migration 裡'
from tables t
where t.name not in (select name from known)

union all

select k.name, null, '在清單上，但資料庫裡沒有這張表'
from known k
where not exists (select 1 from tables t where t.name = k.name)

union all

select d.name, d.role,
       '權限與白名單不一致：' || concat_ws('；', '多了 ' || d.extra, '少了 ' || d.missing)
from diff d
where d.extra is not null or d.missing is not null

union all

select distinct t.name, null, '有欄位層級授權'
from tables t
join pg_attribute a on a.attrelid = t.oid
where a.attacl is not null

union all

-- aclexplode 每一項權限各回一列，同一個角色只列一次
select distinct coalesce(n.nspname, '全域') || '：' || case d.defaclobjtype when 'r' then '資料表' else 'sequence' end,
       case when x.grantee = 0 then 'PUBLIC' else pg_get_userbyid(x.grantee) end,
       'postgres 新建的' || case d.defaclobjtype when 'r' then '資料表' else ' sequence ' end || '會自動授權給這個角色'
from pg_default_acl d
left join pg_namespace n on n.oid = d.defaclnamespace
cross join lateral aclexplode(d.defaclacl) x
where pg_get_userbyid(d.defaclrole) = 'postgres'
  and d.defaclobjtype in ('r', 'S')
  and (d.defaclnamespace = 0 or n.nspname = 'public')
  and (x.grantee = 0 or pg_get_userbyid(x.grantee) in ('anon', 'authenticated', 'service_role'))

union all

select c.relname, r.role, 'sequence 有權限'
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
cross join roles r
where n.nspname = 'public' and c.relkind = 'S'
  and (has_sequence_privilege(r.role, c.oid, 'usage') or has_sequence_privilege(r.role, c.oid, 'select')
       or has_sequence_privilege(r.role, c.oid, 'update'))

order by 1, 2, 3;
