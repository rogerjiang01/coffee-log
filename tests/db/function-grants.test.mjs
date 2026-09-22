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

import { createDatabase } from '../helpers/pg.mjs'
import { createReport } from '../helpers/report.mjs'

/**
 * 明確開放給用戶端呼叫的函式。
 * 加進來之前先問：它是 security definer 嗎？是的話它自己有沒有做完所有檢查？
 * 目前前端沒有任何 .rpc() 呼叫，所以這份白名單是空的。
 */
const ALLOWED = {
  anon: [],
  authenticated: [],
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

  await pg.close()
  return r.finish()
}
