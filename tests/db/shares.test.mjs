// 分享沖煮紀錄的安全測試（《01》§14.6，逐條對應）。
//
// 這一組的核心約束：**匿名的人碰不到任何一張表**，讀取只有 get_shared_brew 一個入口，
// 而它只回傳分享頁實際顯示的欄位。每一條都用「真的去做一次」驗，不看 policy 寫了什麼。
//
// 傳送模型（20260923120000_brew_shares_send_model.sql）：每次分享都是一條新連結，
// include_notes 跟著那一次傳送固定，之後沒有任何寫入路徑能改。

import { readFileSync } from 'node:fs'
import { createDatabase } from '../helpers/pg.mjs'
import { createReport } from '../helpers/report.mjs'
import { SHARED_BREW_KEYS, keyPaths, generateShareCode } from '../../utils/share.ts'
import { catalogDisplayName } from '../../utils/equipment.ts'

const TABLES = ['brews', 'brew_steps', 'beans', 'user_equipment', 'brew_flavor_tags', 'brew_shares', 'brew_share_events']
const SEND_MODEL = '20260923120000_brew_shares_send_model.sql'
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

export default async function run() {
  const r = createReport('分享沖煮紀錄（資料庫）')
  const pg = await createDatabase()

  /** 執行一段 SQL，回傳錯誤訊息；成功回傳 null */
  async function attempt(sql) {
    try {
      await pg.exec(sql)
      return null
    }
    catch (error) {
      return error.message
    }
  }
  const denied = message => /permission denied/i.test(message ?? '')

  async function asAnon() {
    await pg.exec('reset role')
    await pg.exec(`select set_config('test.uid', '', false)`)
    await pg.exec('set role anon')
  }
  async function read(code) {
    const rows = await pg.rows(`select public.get_shared_brew('${code}') as v`)
    return rows[0].v
  }
  async function events(shareCode) {
    await pg.asSuperuser()
    return pg.rows(`select e.event, e.include_notes, e.viewer from brew_share_events e
      join brew_shares s on s.id = e.share_id where s.code = '${shareCode}' order by e.occurred_at, e.event`)
  }

  // ── 準備資料（超級使用者，直接寫） ─────────────────────────────
  await pg.asSuperuser()
  const A = await pg.createUser('share-a@test')
  const B = await pg.createUser('share-b@test')
  const C = await pg.createUser('share-c@test')

  const catalog = (await pg.rows(`select id, brand, model, variant from equipment_catalog
    where type = 'grinder' and variant is not null order by brand, model limit 1`))[0]
  const bean = (await pg.rows(`insert into beans (user_id, name, roaster, roast_date, roast_level)
    values ('${A}', '衣索比亞 耶加雪菲', '山頂咖啡', '2026-09-01', 'light') returning id`))[0].id
  const grinder = (await pg.rows(`insert into user_equipment (user_id, catalog_id, type)
    values ('${A}', '${catalog.id}', 'grinder') returning id`))[0].id
  const dripper = (await pg.rows(`insert into user_equipment (user_id, custom_name, type)
    values ('${A}', '朋友送的陶瓷濾杯', 'dripper') returning id`))[0].id
  const filter = (await pg.rows(`insert into user_equipment (user_id, custom_name, type)
    values ('${A}', '不該出現的濾紙', 'filter') returning id`))[0].id
  const method = (await pg.rows(`select id, name from brew_methods where user_id is null order by sort_order limit 1`))[0]
  const brew = (await pg.rows(`insert into brews (user_id, bean_id, brew_method_id, dose, water_temp, grinder_id, grind_setting,
      dripper_id, filter_id, total_time, rating, is_favorite, tasting_notes, intensity, brewed_at,
      form_duration_seconds, params_duration_seconds, tasting_duration_seconds, water_tds)
    values ('${A}', '${bean}', '${method.id}', 15, 92, '${grinder}', 22, '${dripper}', '${filter}', 150, 4, true,
      '私人的心得：今天心情不好', '{"acidity": 4, "sweetness": 3, "body": 2, "bitterness": 1, "secret": 9}', '2026-09-20 08:00+08',
      80, 50, 30, 1.35)
    returning id`))[0].id
  const steps = [
    [1, 'bloom', 30, 30, null], [2, 'pour', 120, 20, '繞圈'], [3, 'stir', 180, 25, null], [4, 'pour', 240, null, null],
  ]
  for (const [index, type, water, hold, note] of steps) {
    await pg.exec(`insert into brew_steps (brew_id, user_id, step_index, step_type, cumulative_water, hold_seconds, note)
      values ('${brew}', '${A}', ${index}, '${type}', ${water}, ${hold ?? 'null'}, ${note ? `'${note}'` : 'null'})`)
  }
  const tags = await pg.rows(`select id from flavor_tags where user_id is null order by sort_order limit 2`)
  for (const tag of tags) {
    await pg.exec(`insert into brew_flavor_tags (brew_id, flavor_tag_id, user_id) values ('${brew}', '${tag.id}', '${A}')`)
  }
  // 沒分享過的另一筆，以及磨豆機沒填但有刻度的一筆
  const unshared = (await pg.rows(`insert into brews (user_id, bean_id, dose, tasting_notes)
    values ('${A}', '${bean}', 18, '另一筆的心得') returning id`))[0].id
  const noGrinder = (await pg.rows(`insert into brews (user_id, bean_id, dose, grind_setting)
    values ('${A}', '${bean}', 16, 30) returning id`))[0].id

  // ── A 分享 ─────────────────────────────────────────────────────
  const code = generateShareCode()
  await pg.as(A)
  const created = (await pg.rows(`select public.create_brew_share('${brew}', '${code}', false) as c`))[0].c

  r.section('建立')
  r.check(created === code, '回傳的就是送進去的代碼（用戶端產生）')

  r.section('#1 匿名以生效中的代碼讀取')
  await asAnon()
  const anonView = await read(code)
  r.check(anonView !== null && anonView.bean.name === '衣索比亞 耶加雪菲', '拿得到內容')
  r.check(anonView?.is_owner === false, 'is_owner 為 false')

  r.section('#2 不存在或格式不對的代碼')
  r.check(await read(generateShareCode()) === null, '不存在的代碼：NULL')
  r.check(await read('short') === null, '格式不對：NULL')
  r.check(await read(code.slice(0, 21)) === null, '少一個字元：NULL')
  r.check((await pg.rows(`select public.get_shared_brew(null) as v`))[0].v === null, 'null：NULL')

  r.section('#3 匿名直接 select 每一張表')
  for (const table of TABLES) {
    await asAnon()
    r.check(denied(await attempt(`select * from ${table}`)), `${table}：permission denied（不是查到 0 列）`)
  }

  r.section('#4 匿名呼叫寫入函式')
  await asAnon()
  r.check(denied(await attempt(`select public.create_brew_share('${unshared}', '${generateShareCode()}', false)`)),
    'create_brew_share：沒有執行權')
  await pg.asSuperuser()
  r.check((await pg.rows(`select to_regproc('public.set_brew_share_notes') is null as gone`))[0].gone,
    'set_brew_share_notes 已經不存在（傳送模型沒有修改設定的路）')

  r.section('#5 匿名寫入每一張表')
  for (const table of TABLES) {
    await asAnon()
    r.check(denied(await attempt(`insert into ${table} default values`)), `${table}：insert 被拒`)
    await asAnon()
    r.check(denied(await attempt(`update ${table} set user_id = null`.replace(
      /brew_share_events set user_id = null/, 'brew_share_events set viewer = null'))), `${table}：update 被拒`)
    await asAnon()
    r.check(denied(await attempt(`delete from ${table}`)), `${table}：delete 被拒`)
  }

  r.section('#6 登入者直接寫分享的兩張表（包括自己的列）')
  await pg.as(A)
  r.check(denied(await attempt(`insert into brew_shares (brew_id, user_id, code) values ('${unshared}', '${A}', '${generateShareCode()}')`)),
    'brew_shares：insert 被拒')
  await pg.as(A)
  r.check(denied(await attempt(`update brew_shares set include_notes = true where code = '${code}'`)), 'brew_shares：update 被拒')
  await pg.as(A)
  r.check(denied(await attempt(`update brew_shares set revoked_at = now() where code = '${code}'`)), 'brew_shares：寫 revoked_at 被拒')
  await pg.as(A)
  r.check(denied(await attempt(`delete from brew_shares where code = '${code}'`)), 'brew_shares：delete 被拒')
  await pg.as(A)
  r.check(denied(await attempt(`select * from brew_share_events`)), 'brew_share_events：連讀都不行')
  await pg.as(A)
  r.check(denied(await attempt(`delete from brew_share_events`)), 'brew_share_events：delete 被拒')
  await pg.as(A)
  const own = await pg.rows(`select code, include_notes from brew_shares`)
  r.check(own.length === 1 && own[0].code === code, '本人讀得到自己的分享（紀錄詳情頁要用）')
  await pg.as(B)
  r.check((await pg.rows(`select * from brew_shares`)).length === 0, '別人讀不到 A 的分享列')

  r.section('#7 從未分享過的紀錄')
  await pg.asSuperuser()
  const codes = (await pg.rows(`select code from brew_shares where brew_id = '${unshared}'`))
  r.check(codes.length === 0, '沒有任何代碼指向它')

  r.section('#8 沒勾「包含心得筆記」')
  r.check(!('tasting_notes' in anonView), '回傳值裡沒有心得筆記那個 key（不是空字串、不是 null）')
  r.check(!JSON.stringify(anonView).includes('今天心情不好'), '心得的內容一個字都不在回傳值裡')

  r.section('#9 同一筆紀錄可以有多條連結，include_notes 各自獨立')
  await pg.as(A)
  const withNotesCode = generateShareCode()
  const secondCode = (await pg.rows(`select public.create_brew_share('${brew}', '${withNotesCode}', true) as c`))[0].c
  r.check(secondCode === withNotesCode, '第二次分享回傳的是這一次送進去的新代碼，不是第一條的')
  await asAnon()
  const withNotes = await read(withNotesCode)
  r.check(withNotes.tasting_notes === '私人的心得：今天心情不好', '勾了心得的那一條：含心得筆記')
  r.check(!('tasting_notes' in await read(code)), '第一條（沒勾）不受影響：仍然沒有心得')
  await pg.asSuperuser()
  const rows = await pg.rows(`select code, include_notes from brew_shares where brew_id = '${brew}' order by created_at, code`)
  r.check(rows.length === 2, `brew_shares 兩列（${rows.length}）`)
  r.check(rows.find(x => x.code === code).include_notes === false && rows.find(x => x.code === withNotesCode).include_notes === true,
    '各自記著建立時的設定')

  r.section('#10 B 對 A 的紀錄')
  await pg.as(B)
  r.check(!!await attempt(`select public.create_brew_share('${unshared}', '${generateShareCode()}', true)`),
    'create_brew_share（A 沒分享過的那筆）：raise')
  await pg.as(B)
  r.check(!!await attempt(`select public.create_brew_share('${brew}', '${generateShareCode()}', true)`),
    'create_brew_share（A 已經分享的那筆）：raise')
  await pg.as(B)
  r.check(!!await attempt(`select public.create_brew_share('${brew}', '${code}', true)`),
    '拿 A 的代碼重送：raise，不會被當成冪等的重送')
  await pg.asSuperuser()
  const stateAfterB = await pg.rows(`select code, include_notes, user_id from brew_shares where brew_id in ('${brew}', '${unshared}') order by created_at, code`)
  r.check(stateAfterB.length === 2 && stateAfterB.every(x => x.user_id === A)
    && stateAfterB.find(x => x.code === code).include_notes === false,
  'A 的連結狀態不變，也沒有多出任何一列')

  r.section('#11 B 以 A 的代碼讀取')
  await pg.as(B)
  const memberView = await read(code)
  r.check(memberView?.bean?.name === '衣索比亞 耶加雪菲', '拿得到內容（那正是分享）')
  r.check(memberView.is_owner === false && !('brew_id' in memberView), 'is_owner 為 false，沒有 brew_id')

  r.section('#12 「再試一次」用同一個代碼重送：冪等')
  // 第一次其實成功了，只是回應沒回來。重送不能失敗，也不能多一列
  await pg.as(A)
  const retry = (await pg.rows(`select public.create_brew_share('${brew}', '${code}', true) as c`))[0].c
  r.check(retry === code, '回傳同一個代碼，不報錯')
  await pg.asSuperuser()
  r.check((await pg.rows(`select count(*)::int n from brew_shares where brew_id = '${brew}'`))[0].n === 2, '沒有多出一列')
  r.check((await pg.rows(`select include_notes from brew_shares where code = '${code}'`))[0].include_notes === false,
    '重送帶的設定不覆蓋第一次建立的（那條連結建立之後就不能改）')

  r.section('#16 沒有任何路徑能修改 include_notes')
  const updaters = await pg.rows(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f' and pg_get_functiondef(p.oid) ~* 'update\\s+public\\.brew_shares'`)
  r.check(updaters.length === 0, `沒有任何函式 update brew_shares${updaters.length ? `：${updaters.map(w => w.proname).join('、')}` : ''}`)
  for (const role of ['anon', 'authenticated']) {
    const can = (await pg.rows(`select has_column_privilege('${role}', 'brew_shares', 'include_notes', 'update') as ok`))[0].ok
    r.check(can === false, `${role} 對 include_notes 沒有 update 權限`)
  }

  r.section('#14 回傳值的 key ＝ 分享頁顯示的欄位')
  await pg.as(A)
  const ownerView = await read(withNotesCode)
  const actual = [...new Set(keyPaths(ownerView))].sort()
  const expected = [...SHARED_BREW_KEYS].sort()
  r.check(JSON.stringify(actual) === JSON.stringify(expected),
    `完全一致（多：${actual.filter(k => !expected.includes(k)).join('、') || '無'}；少：${expected.filter(k => !actual.includes(k)).join('、') || '無'}）`)
  const withoutOwnId = JSON.stringify({ ...ownerView, brew_id: undefined })
  r.check(!UUID.test(withoutOwnId), '除了本人的 brew_id，沒有任何 uuid')
  r.check(ownerView.brew_id === brew, '本人拿得到 brew_id（「前往紀錄」用）')
  r.check(!/user_id|email|is_sample|visibility|copied_from|duration|created_at|updated_at|include_notes|water_tds/.test(JSON.stringify(ownerView)),
    '沒有 user_id、email、is_sample、visibility、差異、耗時、時間戳、include_notes、進階欄位')
  r.check(!JSON.stringify(ownerView).includes('不該出現的濾紙'), '濾紙（詳情頁不顯示）不在回傳值裡')
  r.check(ownerView.intensity && !('secret' in ownerView.intensity) && ownerView.intensity.acidity === 4,
    '強度只給四個已知的 key，jsonb 裡的其他東西不會被帶出去')

  r.section('回傳的內容')
  r.check(ownerView.grinder === catalogDisplayName(catalog), `型錄器材的顯示名稱與介面同一個組法：${ownerView.grinder}`)
  r.check(ownerView.dripper === '朋友送的陶瓷濾杯', '自建器材用自建名稱')
  r.check(ownerView.kettle === null, '沒填的器材：null')
  r.check(Number(ownerView.grind_setting) === 22, '有磨豆機：刻度照給')
  r.check(ownerView.method === method.name, '沖煮手法名稱')
  r.check(JSON.stringify(ownerView.steps.map(s => s.hold_seconds)) === '[30,20,25,null]'
    && ownerView.steps[2].step_type === 'stir' && ownerView.steps[1].note === '繞圈',
    '分段依段號排序，停水時間原樣、最後一段 null、攪拌標記與備註都在')
  r.check(ownerView.flavor_tags.length === 2, '風味標籤名稱')
  r.check(ownerView.bean.roaster === '山頂咖啡' && ownerView.bean.roast_level === 'light' && ownerView.bean.roast_date === '2026-09-01',
    '豆子資訊：咖啡店名、烘焙度、烘焙日期')
  await pg.as(A)
  const noGrinderCode = generateShareCode()
  await pg.exec(`select public.create_brew_share('${noGrinder}', '${noGrinderCode}', false)`)
  await asAnon()
  const noGrinderView = await read(noGrinderCode)
  r.check(noGrinderView.grinder === null && noGrinderView.grind_setting === null,
    '磨豆機沒填時刻度也不給：刻度 30 單獨出現是一個會誤導的數字')

  r.section('#15 本人、登入的朋友、未登入的朋友各開一次')
  const probe = generateShareCode()
  await pg.as(A)
  await pg.exec(`select public.create_brew_share('${unshared}', '${probe}', false)`)
  await pg.as(A)
  await read(probe)
  await pg.as(C)
  await read(probe)
  await asAnon()
  await read(probe)
  const opens = (await events(probe)).filter(e => e.event === 'open')
  r.check(opens.length === 3, '三次開啟，各一列')
  r.check(JSON.stringify(opens.map(e => e.viewer).sort()) === '["anon","member","owner"]', 'viewer：owner、member、anon')
  r.check(opens.filter(e => e.viewer !== 'owner').length === 2, "viewer <> 'owner' 只數到兩次：本人的開啟不混進朋友的次數")
  await pg.asSuperuser()
  const countEvents = async () => (await pg.rows(`select count(*)::int n from brew_share_events`))[0].n
  const beforeMiss = await countEvents()
  await asAnon()
  await read(generateShareCode())
  await pg.asSuperuser()
  r.check(await countEvents() === beforeMiss, '失效的開啟不記事件（沒有 share_id 可以掛）')

  r.section('埋點：每次分享一筆 create，不再有 toggle_notes')
  const logFirst = await events(code)
  const logSecond = await events(withNotesCode)
  r.check(logFirst.filter(e => e.event === 'create').length === 1 && logFirst.find(e => e.event === 'create').include_notes === false,
    '第一條：create 一筆（重送不寫），記下建立時的設定')
  r.check(logSecond.filter(e => e.event === 'create').length === 1 && logSecond.find(e => e.event === 'create').include_notes === true,
    '第二條：自己的 create 一筆')
  await pg.asSuperuser()
  r.check((await pg.rows(`select count(*)::int n from brew_share_events where event = 'toggle_notes'`))[0].n === 0,
    '沒有 toggle_notes 事件')
  const lonely = (await pg.rows(`insert into brews (user_id, bean_id, dose) values ('${A}', '${bean}', 10) returning id`))[0].id

  r.section('#17 第一版沒有停止分享的寫入路徑')
  await pg.asSuperuser()
  const writers = await pg.rows(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f' and (p.proname like '%revoke%' or pg_get_functiondef(p.oid) ~* 'revoked_at\\s*=')`)
  r.check(writers.length === 0, `沒有任何函式寫 revoked_at${writers.length ? `：${writers.map(w => w.proname).join('、')}` : ''}`)
  for (const role of ['anon', 'authenticated']) {
    const can = (await pg.rows(`select has_column_privilege('${role}', 'brew_shares', 'revoked_at', 'update') as ok`))[0].ok
    r.check(can === false, `${role} 對 revoked_at 沒有 update 權限`)
  }
  r.check(!!await attempt(`insert into brew_share_events (share_id, event) select id, 'revoke' from brew_shares limit 1`),
    "event 不收 'revoke'（沒有寫入路徑的值不先開）")

  r.section('代碼的格式由資料庫把關')
  await pg.as(A)
  r.check(!!await attempt(`select public.create_brew_share('${lonely}', 'too-short', false)`), '不是 22 個字元：被 check 擋下')
  await pg.as(A)
  r.check(!!await attempt(`select public.create_brew_share('${lonely}', '${noGrinderCode}', false)`), '撞到別筆紀錄的代碼：被 unique 擋下')

  r.section('#13 刪除那筆紀錄')
  await pg.as(A)
  await pg.exec(`delete from brews where id = '${brew}'`)
  await pg.asSuperuser()
  r.check((await pg.rows(`select count(*)::int n from brew_shares where code = '${code}'`))[0].n === 0, 'brew_shares 跟著消失')
  r.check((await pg.rows(`select count(*)::int n from brew_share_events e
    where not exists (select 1 from brew_shares s where s.id = e.share_id)`))[0].n === 0, 'brew_share_events 跟著消失')
  await asAnon()
  r.check(await read(code) === null, '代碼回 NULL，與不存在的代碼無法區分')

  r.section('brews 的 RLS 沒有被分享打開')
  await pg.as(B)
  r.check((await pg.rows(`select * from brews where user_id = '${A}'`)).length === 0, 'B 仍然讀不到 A 的任何紀錄（包括分享中的那幾筆）')
  await pg.asSuperuser()
  r.check((await pg.rows(`select count(*)::int n from brews where visibility <> 'private'`))[0].n === 0, '分享不改 visibility')

  await pg.close()

  // ── 推上去之前已經有的資料（前一版：一筆一條、設定可改） ───────────────
  // 正式庫可能已經有前一版建的分享與 toggle_notes 事件。這支 migration 一列都不能動它們
  r.section('傳送模型的 migration 不動既有資料')
  const old = await createDatabase({ skip: [SEND_MODEL] })
  await old.asSuperuser()
  const U = await old.createUser('share-old@test')
  const oldBean = (await old.rows(`insert into beans (user_id, name) values ('${U}', '舊的豆子') returning id`))[0].id
  const oldBrew = (await old.rows(`insert into brews (user_id, bean_id, dose, tasting_notes)
    values ('${U}', '${oldBean}', 15, '舊的心得') returning id`))[0].id
  const oldCode = generateShareCode()
  await old.as(U)
  await old.exec(`select public.create_brew_share('${oldBrew}', '${oldCode}', false)`)
  await old.exec(`select public.set_brew_share_notes('${oldBrew}', true)`)
  await old.asSuperuser()
  const snapshot = async () => ({
    shares: await old.rows(`select id, brew_id, user_id, code, include_notes, revoked_at, created_at from brew_shares order by id`),
    events: await old.rows(`select id, share_id, event, include_notes, viewer, occurred_at from brew_share_events order by id`),
  })
  const before = await snapshot()
  r.check(before.events.some(e => e.event === 'toggle_notes'), '前提：舊資料裡有 toggle_notes 事件')

  await old.exec(readFileSync(new URL(`../../supabase/migrations/${SEND_MODEL}`, import.meta.url), 'utf8'))
  const after = await snapshot()
  r.check(JSON.stringify(after) === JSON.stringify(before), 'brew_shares 與 brew_share_events 一列不少、一個值都沒變')
  r.check(!!(await old.rows(`select 1 from pg_constraint where conname like 'brew_share_events_event_check%'
    and pg_get_constraintdef(oid) like '%toggle_notes%'`)).length, "event 的 check 仍然收 'toggle_notes'（舊資料不違反限制）")
  await old.asSuperuser()
  await old.exec(`select set_config('test.uid', '', false)`)
  await old.exec('set role anon')
  const oldView = (await old.rows(`select public.get_shared_brew('${oldCode}') as v`))[0].v
  r.check(oldView?.tasting_notes === '舊的心得', '舊連結照樣開得起來，設定是最後一次存的（含心得）')
  await old.as(U)
  const newCode = generateShareCode()
  await old.exec(`select public.create_brew_share('${oldBrew}', '${newCode}', false)`)
  await old.asSuperuser()
  r.check((await old.rows(`select count(*)::int n from brew_shares where brew_id = '${oldBrew}'`))[0].n === 2,
    '推上去之後，同一筆舊紀錄可以再分享出第二條連結')
  r.check((await old.rows(`select to_regproc('public.set_brew_share_notes') is null as gone`))[0].gone, 'set_brew_share_notes 已移除')
  r.check((await old.rows(`select has_function_privilege('anon', 'public.create_brew_share(uuid, text, boolean)', 'execute') as ok`))[0].ok === false,
    'create_brew_share 仍然不給 anon')
  await old.close()

  return r.finish()
}
