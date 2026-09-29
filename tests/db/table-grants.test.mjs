// public schema 的資料表權限（20261001100000_table_default_privileges.sql）。
//
// 用白名單反過來掃：migration 建出來的資料庫裡，每一張表都要啟用 RLS，
// 每張表對 anon／authenticated／service_role 的權限要與 tests/helpers/table-grants.mjs 完全一致——
// 多一項、少一項都失敗。anon 在白名單上是空的，所以任何一張表對 anon 有任何權限都失敗。
//
// 新表預設沒有任何權限（default privileges 已收回），所以建表的 migration 漏寫 grant 時，
// 失敗的是這裡的「少了」，不是推上去之後的 permission denied；
// 漏寫 revoke all 也一樣——那只會發生在有人把 default privileges 加回來的時候，這裡也會抓到。

import { readFileSync } from 'node:fs'
import { createDatabase } from '../helpers/pg.mjs'
import { createReport } from '../helpers/report.mjs'
import { PRIVILEGES, ROLES, TABLE_GRANTS } from '../helpers/table-grants.mjs'
import { generateShareCode } from '../../utils/share.ts'

const MIGRATION = '20261001100000_table_default_privileges.sql'

// 部署前後在正式庫跑的那支查詢。這裡拿它在本機的資料庫上跑，確認它本身算得對
const AUDIT = readFileSync(
  new URL('../../supabase/queries/資料表權限盤點.sql', import.meta.url), 'utf8')

// 收回之前，anon 還有權限的七張（20260923110000_brew_shares.sql 收掉的是存紀錄內容的那幾張）
const ANON_BEFORE = ['brew_methods', 'countries', 'equipment_catalog', 'flavor_tags', 'processing_methods', 'profiles', 'varieties']

const PRIV_LIST = PRIVILEGES.map(p => `'${p}'`).join(', ')

/** 白名單比對：回傳問題清單，空陣列＝一致 */
async function tableProblems(pg) {
  const problems = []
  const tables = await pg.rows(`
    select c.relname as name, c.relkind as kind, c.relrowsecurity as rls,
           exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attacl is not null) as column_acl,
           ${ROLES.map(role => `(select string_agg(p, ',') from unnest(array[${PRIV_LIST}]) p
              where has_table_privilege('${role}', c.oid, p)) as "${role}"`).join(',\n')}
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f')
    order by c.relname`)
  for (const t of tables) {
    if (['r', 'p'].includes(t.kind) && !t.rls) problems.push(`${t.name}：沒有啟用 RLS`)
    if (!(t.name in TABLE_GRANTS)) problems.push(`${t.name}：不在白名單上`)
    if (t.column_acl) problems.push(`${t.name}：有欄位層級授權`)
    for (const role of ROLES) {
      const actual = (t[role] ?? '').split(',').filter(Boolean)
      const expected = TABLE_GRANTS[t.name]?.[role] ?? []
      const extra = actual.filter(p => !expected.includes(p))
      const missing = expected.filter(p => !actual.includes(p))
      if (extra.length) problems.push(`${t.name}：${role} 多了 ${extra.join(',')}`)
      if (missing.length) problems.push(`${t.name}：${role} 少了 ${missing.join(',')}`)
    }
  }
  for (const name of Object.keys(TABLE_GRANTS)) {
    if (!tables.some(t => t.name === name)) problems.push(`${name}：在白名單上，但資料庫裡沒有這張表`)
  }
  const defaults = await pg.rows(`
    select d.defaclobjtype as type, coalesce(n.nspname, '全域') as ns, d.defaclacl::text as acl
    from pg_default_acl d left join pg_namespace n on n.oid = d.defaclnamespace
    where pg_get_userbyid(d.defaclrole) = 'postgres' and d.defaclobjtype in ('r', 'S')
      and (d.defaclnamespace = 0 or n.nspname = 'public')`)
  for (const d of defaults) {
    const granted = ROLES.filter(role => new RegExp(`(^|[{,])${role}=`).test(d.acl))
    if (/[{,]=/.test(d.acl)) granted.push('PUBLIC')
    if (granted.length) problems.push(`default privileges（${d.ns}、${d.type === 'r' ? '資料表' : 'sequence'}）：新建的會自動授權給 ${granted.join('、')}`)
  }
  return problems
}

export default async function run() {
  const r = createReport('public schema 的資料表權限')
  const pg = await createDatabase()
  await pg.asSuperuser()

  const attempt = async (sql) => {
    try {
      await pg.exec(sql)
      return null
    }
    catch (error) {
      return error.message
    }
  }
  const denied = message => /permission denied/i.test(message ?? '')

  r.section('每張表都啟用 RLS，權限與白名單完全一致')
  const tables = (await pg.rows(`select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f') order by relname`)).map(t => t.relname)
  r.check(tables.length === Object.keys(TABLE_GRANTS).length,
    `public schema 有 ${tables.length} 張表，白名單有 ${Object.keys(TABLE_GRANTS).length} 張`)
  const problems = await tableProblems(pg)
  r.check(problems.length === 0, problems.length === 0 ? '沒有任何不一致' : problems.join('；'))
  r.check(Object.values(TABLE_GRANTS).every(grants => !('anon' in grants)), '白名單上 anon 是空的')
  const anonAny = await pg.rows(`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f')
      and exists (select 1 from unnest(array[${PRIV_LIST}]) p where has_table_privilege('anon', c.oid, p))`)
  r.check(anonAny.length === 0, `anon 對任何一張表都沒有權限（${anonAny.map(x => x.relname).join('、') || '0 張'}）`)

  r.section('新表預設沒有任何權限')
  // 以 postgres 建表，也就是 supabase db push 實際的身分
  await pg.exec('begin')
  await pg.exec(`create table public.probe_new (id bigint generated always as identity primary key, v int)`)
  await pg.exec(`create sequence public.probe_seq`)
  const fresh = (await pg.rows(`select
      ${ROLES.map(role => `exists (select 1 from unnest(array[${PRIV_LIST}]) p
        where has_table_privilege('${role}', 'public.probe_new'::regclass, p)) as "${role}"`).join(', ')},
      ${ROLES.map(role => `(has_sequence_privilege('${role}', 'public.probe_seq', 'usage')
        or has_sequence_privilege('${role}', 'public.probe_seq', 'select')
        or has_sequence_privilege('${role}', 'public.probe_seq', 'update')) as "seq_${role}"`).join(', ')}`))[0]
  await pg.exec('rollback')
  for (const role of ROLES) {
    r.check(fresh[role] === false, `新資料表：${role} 沒有任何權限`)
    r.check(fresh[`seq_${role}`] === false, `新 sequence：${role} 沒有任何權限`)
  }

  r.section('盤點查詢（supabase/queries/資料表權限盤點.sql）在乾淨的資料庫上是 0 列')
  const clean = await pg.rows(AUDIT)
  r.check(clean.length === 0,
    clean.length === 0 ? '0 列' : `多出來的：${clean.map(x => `${x['對象']} ${x['角色'] ?? ''} ${x['問題']}`).join('；')}`)

  r.section('白名單比對與盤點查詢都抓得到每一種錯')
  // 每一種都在交易裡做、做完還原，互不影響
  const mutations = [
    ['替任一張表加上 anon 權限', `grant select on table countries to anon`, /countries.*anon.*多了 select/],
    ['替存紀錄內容的表加上 anon 權限', `grant insert on table brews to anon`, /brews.*anon.*多了 insert/],
    ['拿掉一張表的授權（漏寫 grant）', `revoke insert on table brew_save_events from authenticated`, /brew_save_events.*authenticated.*少了 insert/],
    ['拿掉 service_role 的授權', `revoke all on table brew_share_events from service_role`, /brew_share_events.*service_role.*少了/],
    ['關掉 RLS', `alter table beans disable row level security`, /beans.*沒有啟用 RLS/],
    ['不在 migration 裡的表', `create table public.stray (i int)`, /stray.*(不在白名單上|不在任何 migration 裡)/],
    ['欄位層級授權', `grant select (display_name) on table profiles to anon`, /profiles.*欄位層級授權/],
    ['default privileges 被加回來', `alter default privileges for role postgres in schema public grant select on tables to anon`,
      /(default privileges|資料表).*anon|anon.*(自動授權|新建)/],
  ]
  for (const [label, sql, pattern] of mutations) {
    await pg.exec('begin')
    const error = await attempt(sql)
    const found = error ? [] : await tableProblems(pg)
    const audit = error ? [] : (await pg.rows(AUDIT)).map(x => `${x['對象']} ${x['角色'] ?? ''} ${x['問題']}`)
    await pg.exec('rollback')
    r.check(!error && found.some(p => pattern.test(p)), `${label}：白名單比對失敗${error ? `（SQL 錯誤：${error}）` : ''}`)
    r.check(!error && audit.some(p => pattern.test(p)), `${label}：盤點查詢列出來（${audit.join('；') || '0 列'}）`)
  }
  r.check((await tableProblems(pg)).length === 0 && (await pg.rows(AUDIT)).length === 0, '全部還原之後又是 0 個問題')

  r.section('新使用者註冊：profile 與範例資料照常建立')
  // 正式庫的註冊由 Supabase Auth 以 supabase_auth_admin 寫入 auth.users。
  // 這個角色對 public schema 沒有任何權限，profile 與範例資料全靠 security definer 的 handle_new_user
  await pg.exec(`create role supabase_auth_admin nologin;
    grant usage on schema auth to supabase_auth_admin;
    grant select, insert on auth.users to supabase_auth_admin;`)
  await pg.exec('set role supabase_auth_admin')
  const signupError = await attempt(`insert into auth.users (email) values ('table-grants-a@test')`)
  await pg.asSuperuser()
  r.check(signupError === null, `以 supabase_auth_admin 寫入 auth.users 成功${signupError ? `：${signupError}` : ''}`)
  const A = (await pg.rows(`select id from auth.users where email = 'table-grants-a@test'`))[0]?.id
  const seeded = (await pg.rows(`
    select (select count(*)::int from profiles where id = '${A}') profile,
           (select count(*)::int from beans where user_id = '${A}' and is_sample) beans,
           (select count(*)::int from user_equipment where user_id = '${A}' and is_sample) equip,
           (select count(*)::int from brews where user_id = '${A}' and is_sample) brews`))[0]
  r.check(seeded.profile === 1, 'profile 建立')
  r.check(seeded.beans === 1 && seeded.equip === 1 && seeded.brews === 1, '範例資料三筆建立')

  r.section('登入後照常讀寫')
  await pg.as(A)
  r.check((await pg.rows(`select count(*)::int n from profiles`))[0].n === 1, '讀得到自己的 profile')
  for (const table of ['countries', 'equipment_catalog', 'brew_methods', 'flavor_tags', 'processing_methods', 'varieties']) {
    r.check((await pg.rows(`select count(*)::int n from ${table}`))[0].n > 0, `讀得到 ${table} 的系統項目`)
  }
  r.check(await attempt(`insert into flavor_tags (user_id, name) values ('${A}', '自建的風味')`) === null, '照常新增自建的風味標籤')
  await pg.asSuperuser()

  r.section('未登入讀分享頁正常')
  const brew = (await pg.rows(`select id from brews where user_id = '${A}' limit 1`))[0].id
  const code = generateShareCode()
  await pg.as(A)
  await pg.exec(`select public.create_brew_share('${brew}', '${code}', false)`)
  await pg.exec('reset role')
  await pg.exec(`select set_config('test.uid', '', false)`)
  await pg.exec('set role anon')
  const shared = (await pg.rows(`select public.get_shared_brew('${code}') as v`))[0].v
  r.check(shared !== null && typeof shared.bean?.name === 'string', 'anon 呼叫 get_shared_brew 拿得到內容')

  r.section('anon 直接查 profiles 與查表類系統表：permission denied')
  for (const table of ANON_BEFORE) {
    r.check(denied(await attempt(`select * from ${table} limit 1`)), `select ${table}`)
  }
  r.check(denied(await attempt(`insert into flavor_tags (name) values ('匿名')`)), 'insert flavor_tags')
  await pg.asSuperuser()
  await pg.close()

  // ── 推之前的正式庫：這支 migration 還沒套用 ────────────────────────
  r.section('推之前：盤點查詢抓得到這支 migration 要修的每一項')
  const before = await createDatabase({ skip: [MIGRATION] })
  await before.asSuperuser()
  const rows = await before.rows(AUDIT)
  const anonRows = rows.filter(x => x['角色'] === 'anon' && /多了/.test(x['問題'])).map(x => x['對象']).sort()
  r.check(JSON.stringify(anonRows) === JSON.stringify(ANON_BEFORE), `anon 多給的 7 張（${anonRows.join('、')}）`)
  const defaultRows = rows.filter(x => /自動授權/.test(x['問題']))
  r.check(defaultRows.length === 6, `default privileges：資料表與 sequence 各 3 個角色（${defaultRows.length} 列）`)
  r.check(rows.length === 13, `推之前共 13 列（實際 ${rows.length} 列）`)
  await before.exec(readFileSync(new URL(`../../supabase/migrations/${MIGRATION}`, import.meta.url), 'utf8'))
  const after = await before.rows(AUDIT)
  r.check(after.length === 0, `推之後 0 列${after.length ? `：${after.map(x => `${x['對象']} ${x['問題']}`).join('；')}` : ''}`)
  await before.close()

  return r.finish()
}
