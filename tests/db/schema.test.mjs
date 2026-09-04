// Schema、RLS 與 seed。在 WASM 版 Postgres 上套用全部 migration。
//
// 資料隔離是本專案最關鍵的一組——做錯了使用者會看到別人的紀錄。

import { createDatabase } from '../helpers/pg.mjs'
import { createReport, equal } from '../helpers/report.mjs'

export default async function run() {
  const r = createReport('Schema、RLS 與 seed')
  const pg = await createDatabase()
  const A = await pg.createUser('a@test')
  const B = await pg.createUser('b@test')

  r.section('授權：RLS 之上還有一層 table privilege')
  await pg.as(A)
  r.check((await pg.rows('select 1 from countries limit 1')).length >= 0,
    'authenticated 讀得到資料（grants migration 有生效，否則會是 permission denied）')

  r.section('註冊 trigger')
  await pg.asSuperuser()
  r.check((await pg.rows(`select 1 from profiles where id='${A}'`)).length === 1, '新帳號自動建立 profile')

  r.section('豆子：必填只有 name')
  await pg.as(A)
  const bean = (await pg.rows(`insert into beans (user_id,name) values ('${A}','只有豆名') returning id`))[0].id
  r.ok('只給 user_id 與 name 就能建立豆子')
  const notNull = (await pg.rows(`select column_name from information_schema.columns
    where table_name='beans' and is_nullable='NO' order by column_name`)).map(x => x.column_name)
  r.check(equal(notNull, ['created_at', 'id', 'is_finished', 'name', 'updated_at', 'user_id']),
    `beans 的 NOT NULL 僅有 id/user_id/name 與系統欄位：${notNull.join(',')}`)

  r.section('沖煮紀錄：必填是 bean_id 與 dose')
  const brewNotNull = (await pg.rows(`select column_name from information_schema.columns
    where table_name='brews' and is_nullable='NO' order by column_name`)).map(x => x.column_name)
  r.check(brewNotNull.includes('bean_id') && brewNotNull.includes('dose'),
    'bean_id 與 dose 都是 NOT NULL——所以前端必須把兩者都當必填')
  await r.mustReject(pg.query(`insert into brews (user_id,dose) values ('${A}',15)`), 'bean_id 不可為空')
  await r.mustReject(pg.query(`insert into brews (user_id,bean_id) values ('${A}','${bean}')`), 'dose 不可為空')

  r.section('資料隔離')
  const brew = (await pg.rows(`insert into brews (user_id,bean_id,dose) values ('${A}','${bean}',15) returning id`))[0].id
  const pub = (await pg.rows(`insert into brews (user_id,bean_id,dose,visibility)
    values ('${A}','${bean}',16,'public') returning id`))[0].id
  await pg.exec(`insert into brew_steps (brew_id,user_id,step_index,time_offset,cumulative_water,step_type)
    values ('${brew}','${A}',1,0,40,'bloom')`)
  await pg.as(B)
  r.check((await pg.rows(`select 1 from beans where id='${bean}'`)).length === 0, 'B 讀不到 A 的豆子')
  r.check((await pg.rows(`select 1 from brews where id='${brew}'`)).length === 0, 'B 讀不到 A 的 private 紀錄')
  r.check((await pg.rows(`select 1 from brew_steps where brew_id='${brew}'`)).length === 0, 'B 讀不到 A 的分段')
  r.check((await pg.rows(`select 1 from profiles where id='${A}'`)).length === 0, 'B 讀不到 A 的 profile')
  r.check((await pg.query(`update beans set name='被改' where id='${bean}'`)).affectedRows === 0, 'B 改不動 A 的豆子')
  r.check((await pg.query(`delete from beans where id='${bean}'`)).affectedRows === 0, 'B 刪不掉 A 的豆子')
  await r.mustReject(pg.query(`insert into beans (user_id,name) values ('${A}','冒名')`), 'B 無法以 A 的身分新增')
  r.check((await pg.rows(`select 1 from brews where id='${pub}'`)).length === 1,
    'B 讀得到 A 標為 public 的紀錄——visibility 邏輯現在就生效')

  r.section('混合表：偽造系統項目')
  for (const table of ['processing_methods', 'varieties', 'flavor_tags', 'brew_methods']) {
    await r.mustReject(pg.query(`insert into ${table} (user_id,name) values (null,'偽造')`),
      `${table} 擋下 user_id = NULL`)
  }
  await r.mustReject(pg.query(`insert into processing_methods (user_id,name) values ('${A}','冒名')`),
    '擋下以他人 user_id 新增')
  r.check((await pg.query(`update processing_methods set name='改' where user_id is null`)).affectedRows === 0,
    '擋下修改系統項目')
  r.check((await pg.query(`delete from processing_methods where user_id is null`)).affectedRows === 0,
    '擋下刪除系統項目')

  r.section('seed')
  r.check((await pg.rows(`select 1 from processing_methods where user_id is null`)).length === 12, '處理法 12 筆')
  r.check((await pg.rows(`select 1 from varieties where user_id is null`)).length === 27, '品種 27 筆')
  r.check((await pg.rows(`select 1 from countries`)).length === 42, '產國 42 筆')
  r.check((await pg.rows(`select 1 from equipment_catalog where type='grinder'`)).length === 25, '磨豆機型錄 25 台')
  r.check((await pg.rows(`select 1 from equipment_catalog`)).length === 53, '型錄共 53 筆')
  r.check((await pg.rows(`select 1 from equipment_catalog where model like 'V60 Switch%'`)).length === 2,
    'V60 Switch 收 01／03 兩個尺寸——浸泡式結構屬於「影響沖煮行為」的層級')
  // 收錄粒度見《01》§3.2：只收到影響沖煮行為的層級，材質與聯名不收
  r.check((await pg.rows(`select 1 from equipment_catalog where brand='星芒濾杯'`)).length === 3,
    '星芒收三個代目——肋骨結構不同')
  r.check((await pg.rows(`select 1 from equipment_catalog where brand='川流濾杯'`)).length === 2,
    '川流收 01／02 兩個尺寸')
  r.check((await pg.rows(
    `select 1 from equipment_catalog where model ilike '%不鏽鋼%' or model ilike '%玻璃%' or model ilike '%陶瓷%'`)).length === 0,
    '型錄裡沒有任何材質條目——材質記在 user_equipment.note')
  r.check((await pg.rows(`select 1 from information_schema.tables where table_name='regions'`)).length === 0,
    'regions 表已移除，產區改為自由文字')

  r.section('沖煮手法的 seed')
  const methods = await pg.rows(`select name, aliases, default_ratio, step_template
    from brew_methods where user_id is null order by sort_order`)
  r.check(methods.length === 5, `內建手法 5 個：${methods.map(m => m.name).join('、')}`)
  for (const method of methods) {
    const steps = method.step_template?.steps ?? []
    const bases = new Set(steps.map(s => s.basis))
    const validBasis = [...bases].every(b => ['dose', 'total', 'remaining'].includes(b))
    const hasDuration = steps.every(s => typeof s.duration === 'number')
    const lastIsZero = steps.at(-1)?.duration === 0
    const remaining = steps.filter(s => s.basis === 'remaining').reduce((sum, s) => sum + s.factor, 0)
    const total = steps.filter(s => s.basis === 'total').reduce((sum, s) => sum + s.factor, 0)
    const remainingOk = !bases.has('remaining') || Math.abs(remaining - 1) < 1e-9
    const totalOk = !bases.has('total') || Math.abs(total - 1) < 1e-9
    r.check(steps.length > 0 && validBasis && hasDuration && lastIsZero && remainingOk && totalOk,
      `${method.name}：${steps.length} 段、basis 合法、factor 總和為 1、最後一段 duration 為 0`)
    r.check(Number(method.default_ratio) === 15 && (method.aliases?.length ?? 0) > 0,
      `${method.name}：有預設粉水比與別名`)
  }
  const fourSix = methods.find(m => m.name === '四六沖法')
  r.check(fourSix?.step_template.steps.every(s => s.basis === 'total'),
    '四六沖法全部使用 total 基準——它的第一注不是悶蒸，是結構比例')
  const threeStage = methods.find(m => m.name === '三段式沖法')
  r.check(threeStage?.step_template.steps[0].basis === 'dose',
    '三段式的悶蒸使用 dose 基準——悶蒸是物理需求，需求量由粉重決定')

  r.section('刻度四欄制的 seed 值')
  for (const [model, expected] of [
    ['EK43', { mn: '1', mx: '16', inc: '0.1' }],
    ['小飛馬 500N', { mn: null, mx: null, inc: null }],
    ['Zero', { mn: '0', mx: null, inc: null }],
    ['R440', { mn: '1', mx: '10', inc: '0.5' }],
  ]) {
    const row = (await pg.rows(`select grind_scale_min mn, grind_scale_max mx, grind_scale_increment inc
      from equipment_catalog where model='${model}'`))[0]
    r.check(equal({ mn: row.mn, mx: row.mx, inc: row.inc }, expected), `${model} 的刻度規格正確`)
  }

  r.section('器材：預設值與約束')
  await pg.as(A)
  await r.mustReject(pg.query(`insert into user_equipment (user_id,type) values ('${A}','grinder')`),
    '型錄與自訂名稱都空時被 check 擋下')
  const cat = (await pg.rows(`select id from equipment_catalog where model='EK43'`))[0].id
  const e1 = (await pg.rows(`insert into user_equipment (user_id,type,catalog_id,is_default)
    values ('${A}','grinder','${cat}',true) returning id`))[0].id
  const e2 = (await pg.rows(`insert into user_equipment (user_id,type,custom_name)
    values ('${A}','grinder','老磨豆機') returning id`))[0].id
  await r.mustReject(pg.query(`update user_equipment set is_default=true where id='${e2}'`),
    '同類型第二台直接設預設會撞上唯一索引——前端必須先清掉舊的')
  await pg.exec(`update user_equipment set is_default=false where user_id='${A}' and type='grinder' and id<>'${e2}'`)
  await pg.exec(`update user_equipment set is_default=true where id='${e2}'`)
  r.check((await pg.rows(`select 1 from user_equipment where user_id='${A}' and type='grinder' and is_default`)).length === 1,
    '先清再設就不會報錯，且同類型仍只有一個預設')

  r.section('updated_at trigger')
  const before = (await pg.rows(`select updated_at from beans where id='${bean}'`))[0].updated_at
  await pg.exec('select pg_sleep(0.05)')
  await pg.query(`update beans set name='改名' where id='${bean}'`)
  const after = (await pg.rows(`select updated_at from beans where id='${bean}'`))[0].updated_at
  r.check(new Date(after) > new Date(before), 'beans.updated_at 會自動前進')

  await pg.close()
  return r.finish()
}
