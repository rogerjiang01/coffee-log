// public schema 的函式執行權（20260923100000_function_grants.sql）。
//
// 20260831170000_grants.sql 的 `alter default privileges … grant all on routines`
// 會讓每一支新函式自動拿到 anon 的執行權；PostgreSQL 對函式的內建預設又是
// 「EXECUTE 給 PUBLIC」，而 anon 是 PUBLIC 的一員。兩者相加的結果是：
// **新增一支 security definer 函式，預設就是未登入的人也叫得動。**
//
// 所以這裡用白名單反過來掃：public schema 裡的每一支函式，只要 anon 或
// authenticated 叫得動而又不在白名單上，就失敗。新函式忘了寫 revoke 時，
// 失敗的是這裡，不是上線之後。

import { readFileSync } from 'node:fs'
import { createDatabase } from '../helpers/pg.mjs'
import { createReport } from '../helpers/report.mjs'

const MIGRATION = readFileSync(
  new URL('../../supabase/migrations/20260923100000_function_grants.sql', import.meta.url), 'utf8')

// 部署前後在正式庫跑的那支查詢。這裡拿它在本機的資料庫上跑，確認它本身算得對
const AUDIT = readFileSync(
  new URL('../../supabase/queries/函式權限盤點.sql', import.meta.url), 'utf8')

// Supabase 後台「Auto-enable RLS for new tables」建立的函式與 event trigger，
// 照 Supabase 文件（Database → Postgres → Event triggers）的原文，只拿掉 RAISE LOG。
// 它只存在於正式庫，不在任何 migration 裡，所以測試要自己建一支來重現。
const DASHBOARD_RLS_AUTO_ENABLE = `
CREATE OR REPLACE FUNCTION rls_auto_enable()
RETURNS EVENT_TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT * FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table', 'partitioned table')
  LOOP
    IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') THEN
      EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
    END IF;
  END LOOP;
END;
$$;
CREATE EVENT TRIGGER ensure_rls ON ddl_command_end
WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
EXECUTE FUNCTION rls_auto_enable();
`

/**
 * 明確開放給用戶端呼叫的函式。
 * 加進來之前先問：它是 security definer 嗎？是的話它自己有沒有做完所有檢查？
 * 兩支都是分享用的（《01》§14）。get_shared_brew 是匿名的人唯一的入口，
 * 只吃代碼、只回傳分享頁顯示的欄位；create_brew_share 只給登入者，而且自己檢查擁有者。
 * （set_brew_share_notes 在傳送模型裡移除了：include_notes 建立之後不能改）
 * 各自的安全測試在 tests/db/shares.test.mjs。
 */
const ALLOWED = {
  anon: ['get_shared_brew'],
  authenticated: ['get_shared_brew', 'create_brew_share'],
}

export default async function run() {
  const r = createReport('public schema 的函式執行權')
  const pg = await createDatabase()
  await pg.asSuperuser()

  const fns = await pg.rows(`
    select p.proname as name,
           pg_get_function_identity_arguments(p.oid) as args,
           p.prosecdef as secdef,
           has_function_privilege('anon', p.oid, 'execute') as anon,
           has_function_privilege('authenticated', p.oid, 'execute') as authenticated
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
    order by p.proname
  `)

  r.section('盤點')
  r.check(fns.length > 0, `public schema 有 ${fns.length} 支函式`)
  for (const fn of fns) {
    r.check(true, `${fn.name}(${fn.args})：${fn.secdef ? 'security definer' : '一般'}`)
  }

  r.section('沒有在白名單上的，anon 與 authenticated 都不得執行')
  for (const role of ['anon', 'authenticated']) {
    for (const fn of fns) {
      if (ALLOWED[role].includes(fn.name)) {
        r.check(fn[role] === true, `${role} 可以執行白名單上的 ${fn.name}`)
        continue
      }
      r.check(fn[role] === false, `${role} 不能執行 ${fn.name}`)
    }
  }

  r.section('security definer 的函式一律要鎖住 search_path')
  // search_path 沒鎖的 security definer 函式，呼叫端可以用自己的 schema
  // 覆蓋函式裡用到的名字，那是比執行權更直接的提權
  const unpinned = await pg.rows(`
    select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
      and (p.proconfig is null or not exists (
        select 1 from unnest(p.proconfig) c where c like 'search_path=%'))
  `)
  r.check(unpinned.length === 0,
    unpinned.length === 0 ? '每一支都有 set search_path' : `沒鎖的：${unpinned.map(x => x.proname).join('、')}`)

  // ── 收回執行權之後，靠這三支函式的流程要照常運作 ──────────────────
  r.section('revoke 之後，註冊仍然建立範例資料')
  // trigger 函式的 EXECUTE 只在 create trigger 當下檢查，觸發時不再檢查——
  // 這一段就是在確認這件事，而不是靠記憶
  const A = await pg.createUser('fn-grants-a@test')
  r.check((await pg.rows(`select count(*)::int n from profiles where id='${A}'`))[0].n === 1,
    'handle_new_user 照樣建立 profile')
  const seeded = await pg.rows(`
    select (select count(*)::int from beans where user_id='${A}' and is_sample) beans,
           (select count(*)::int from user_equipment where user_id='${A}' and is_sample) equip,
           (select count(*)::int from brews where user_id='${A}' and is_sample) brews,
           (select sample_seeded from profiles where id='${A}') seeded`)
  r.check(seeded[0].beans === 1 && seeded[0].equip === 1 && seeded[0].brews === 1,
    'create_sample_data 照樣建立三筆範例')
  r.check(seeded[0].seeded === true, 'sample_seeded 照樣被設起來')

  r.section('revoke 之後，updated_at 的 trigger 仍然運作')
  const beanId = (await pg.rows(`select id from beans where user_id='${A}'`))[0].id
  await pg.exec(`update beans set updated_at = '2000-01-01' where id='${beanId}'`)
  await pg.as(A)
  await pg.exec(`update beans set name = '改過的豆名' where id='${beanId}'`)
  await pg.asSuperuser()
  const updated = (await pg.rows(`select updated_at > '2020-01-01'::timestamptz as touched from beans where id='${beanId}'`))[0]
  r.check(updated.touched === true, 'set_updated_at 照樣把 updated_at 推到現在')

  r.section('anon 直接呼叫會被擋下')
  const B = await pg.createUser('fn-grants-b@test')
  await pg.exec('reset role')
  await pg.exec('set role anon')
  let denied = false
  try {
    await pg.exec(`select public.create_sample_data('${B}'::uuid)`)
  }
  catch (error) {
    denied = /permission denied/i.test(error.message)
  }
  await pg.asSuperuser()
  r.check(denied, 'anon 呼叫 create_sample_data 是 permission denied')

  r.section('盤點查詢（supabase/queries/函式權限盤點.sql）在乾淨的資料庫上是 0 列')
  const clean = await pg.rows(AUDIT)
  r.check(clean.length === 0,
    clean.length === 0 ? '0 列' : `多出來的：${clean.map(x => `${x['函式']} ${x['問題']}`).join('；')}`)

  await pg.close()

  // ── 後台建立的 rls_auto_enable() ───────────────────────────────────
  // 上面那個資料庫是 migration 建出來的，看不到後台建的東西。這裡另開一個，
  // 先照文件原文建出那支函式（重現正式庫的狀態），再把 function_grants
  // 那支 migration 整支重跑一次——revoke 是冪等的，重跑等於「在已經有這支
  // 函式的資料庫上推這支 migration」，也就是正式庫實際會發生的事。
  const live = await createDatabase()
  await live.asSuperuser()
  await live.exec(DASHBOARD_RLS_AUTO_ENABLE)
  const exec = async role => (await live.rows(
    `select has_function_privilege('${role}', 'public.rls_auto_enable()', 'execute') as ok`))[0].ok

  r.section('後台的 rls_auto_enable()：推 migration 之前（重現正式庫）')
  r.check(await exec('anon') === true && await exec('authenticated') === true,
    '與正式庫一致：anon 與 authenticated 都有執行權')

  const before = await live.rows(AUDIT)
  r.check(before.length === 2 && before.every(x => x['函式'] === 'rls_auto_enable()'),
    `盤點查詢在推之前抓得到它（anon、authenticated 各一列，實際 ${before.length} 列）`)
  r.check(before.every(x => x['擁有者'] === 'postgres'), '盤點查詢列出擁有者')

  r.section('後台的 rls_auto_enable()：推 migration 之後')
  await live.exec(MIGRATION)
  const after = await live.rows(AUDIT)
  r.check(after.length === 0,
    after.length === 0 ? '盤點查詢：0 列' : `盤點查詢還有：${after.map(x => `${x['函式']} ${x['問題']}`).join('；')}`)
  r.check(await exec('anon') === false, 'anon 不能執行')
  r.check(await exec('authenticated') === false, 'authenticated 不能執行')

  r.section('收回執行權之後，新表照樣自動開啟 RLS')
  // 最嚴格的情況：建表的人不是函式擁有者、不是超級使用者、也沒有執行權。
  // event trigger 觸發時要是會檢查 EXECUTE，這裡就會失敗
  await live.exec(`create role table_maker nologin; grant usage, create on schema public to table_maker;`)
  r.check((await live.rows(
    `select has_function_privilege('table_maker', 'public.rls_auto_enable()', 'execute') as ok`))[0].ok === false,
    '前提：建表的角色對這支函式沒有執行權')
  await live.exec(`create table public.probe_by_owner (i int)`)
  await live.exec(`set role table_maker`)
  await live.exec(`create table public.probe_by_maker (i int)`)
  await live.exec(`create table public.probe_as as select 1 as i`)
  await live.exec(`reset role`)
  const rls = Object.fromEntries((await live.rows(`
    select relname, relrowsecurity from pg_class
    where relname in ('probe_by_owner', 'probe_by_maker', 'probe_as')`)).map(row => [row.relname, row.relrowsecurity]))
  r.check(rls.probe_by_owner === true, '擁有者建的表：RLS 自動開啟')
  r.check(rls.probe_by_maker === true, '沒有執行權的角色建的表：RLS 仍然自動開啟')
  r.check(rls.probe_as === true, 'create table as：RLS 仍然自動開啟')

  r.section('沒有這支函式的環境，migration 照樣推得過去')
  // 最前面那個資料庫就是這種環境（本機、測試、還沒開後台設定的專案）。
  // 走到這裡代表它已經套用成功；這一條只是把那件事明講出來
  r.check(/to_regprocedure\('public\.rls_auto_enable\(\)'\)\s+is not null/.test(MIGRATION),
    'revoke 包在存在與否的檢查裡')

  r.section('盤點查詢抓得到下一支後台建的函式')
  // 下一次有人在 SQL Editor 建了函式：它會同時是「來路不明」與「對用戶端開放」
  await live.exec(`create function public.mystery() returns int language sql security definer as 'select 1'`)
  const mystery = (await live.rows(AUDIT)).filter(x => x['函式'] === 'mystery()').map(x => x['問題'])
  r.check(mystery.includes('不在任何 migration 裡，也不是已知的後台物件'), '標成來路不明')
  r.check(mystery.includes('對 anon 開放，但不在白名單上'), '標成對 anon 開放')
  r.check(mystery.includes('security definer 卻沒有鎖 search_path'), '標成沒鎖 search_path')

  await live.close()
  return r.finish()
}
