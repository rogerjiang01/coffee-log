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

  r.section('使用者偏好：記錄分段時間')
  r.check((await pg.rows(`select record_step_times from profiles where id='${A}'`))[0].record_step_times === false,
    '新帳號預設關閉——分段時間是進階參數，由使用者宣告要不要用')
  await pg.as(A)
  r.check((await pg.query(`update profiles set record_step_times=true where id='${A}'`)).affectedRows === 1,
    'A 可以打開自己的開關')
  await pg.as(B)
  r.check((await pg.rows(`select record_step_times from profiles where id='${A}'`)).length === 0, 'B 讀不到 A 的開關')
  r.check((await pg.query(`update profiles set record_step_times=false where id='${A}'`)).affectedRows === 0,
    'B 改不動 A 的開關')
  await pg.asSuperuser()
  r.check((await pg.rows(`select record_step_times from profiles where id='${A}'`))[0].record_step_times === true,
    'A 的開關仍是開著')
  await r.mustReject(pg.query(`update profiles set record_step_times=null where id='${A}'`),
    '不接受 NULL——偏好沒有「還沒決定」這個第三態')

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
  await pg.exec(`insert into brew_steps (brew_id,user_id,step_index,hold_seconds,cumulative_water,step_type)
    values ('${brew}','${A}',1,45,40,'bloom')`)
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
  r.section('產國的洲別')
  r.check((await pg.rows(`select 1 from countries where continent is null`)).length === 0,
    '42 國全部歸了洲——NOT NULL 會擋住漏填，之後新增產國忘記填會直接失敗')
  const byContinent = await pg.rows(
    `select continent, count(*)::int as n from countries group by continent order by continent`)
  r.check(byContinent.length === 3, `只有三洲：${byContinent.map(x => x.continent).join('、')}`)
  r.check((await pg.rows(`select 1 from countries where iso_code='YE' and continent='africa'`)).length === 1,
    '葉門在非洲組——咖啡產區慣例與非洲東岸一起討論，不要「修正」成亞洲')
  r.check((await pg.rows(`select 1 from countries where iso_code='PG' and continent='asia'`)).length === 1,
    '巴布亞紐幾內亞併入亞洲——42 國裡只有它屬大洋洲，不為單一項目開一組')

  // 常見度排序：每一洲的第一名不能被之後的改動洗掉
  const first = async (continent) => (await pg.rows(
    `select name_zh from countries where continent='${continent}' order by sort_order limit 1`))[0].name_zh
  r.check(await first('africa') === '衣索比亞', '非洲第一是衣索比亞')
  r.check(await first('americas') === '巴拿馬', '美洲第一是巴拿馬')
  r.check(await first('asia') === '臺灣', '亞洲第一是臺灣')

  r.check((await pg.rows(
    `select sort_order from countries group by sort_order having count(*) > 1`)).length === 0,
    'sort_order 沒有並列——並列時每次載入的順序可能不同')

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
    // duration 是純停水秒數：最後一段沒有下一注所以是 null，其餘必須是正數
    //（換算成純停水時若有段落變成 0 或負數，要停下來回報，不自行調整）
    const lastIsNull = steps.at(-1)?.duration === null
    const othersArePositive = steps.slice(0, -1).every(s => typeof s.duration === 'number' && s.duration > 0)
    const remaining = steps.filter(s => s.basis === 'remaining').reduce((sum, s) => sum + s.factor, 0)
    const total = steps.filter(s => s.basis === 'total').reduce((sum, s) => sum + s.factor, 0)
    const remainingOk = !bases.has('remaining') || Math.abs(remaining - 1) < 1e-9
    const totalOk = !bases.has('total') || Math.abs(total - 1) < 1e-9
    r.check(steps.length > 0 && validBasis && othersArePositive && lastIsNull && remainingOk && totalOk,
      `${method.name}：${steps.length} 段、basis 合法、factor 總和為 1、停留秒數都是正數、最後一段 duration 為 null`)
    r.check(Number(method.default_ratio) === 15 && (method.aliases?.length ?? 0) > 0,
      `${method.name}：有預設粉水比與別名`)
  }
  const fourSix = methods.find(m => m.name === '四六沖法')
  r.check(fourSix?.step_template.steps.every(s => s.basis === 'total'),
    '四六沖法全部使用 total 基準——它的第一注不是悶蒸，是結構比例')
  const threeStage = methods.find(m => m.name === '三段式沖法')
  r.check(threeStage?.step_template.steps[0].basis === 'dose',
    '三段式的悶蒸使用 dose 基準——悶蒸是物理需求，需求量由粉重決定')

  r.section('手法模板的停水秒數（台灣主流教學交叉比對，尚未實機核實）')
  // 20260917100000 只改 duration：水量與段數必須與原本的 seed 一模一樣
  for (const [name, durations, factors] of [
    ['三段式沖法', [30, 35, null], [2, 0.6, 0.4]],
    ['四六沖法', [38, 33, 33, 33, null], [0.1667, 0.2333, 0.2, 0.2, 0.2]],
    ['五段式沖法', [33, 20, 20, 20, null], [3, 0.25, 0.25, 0.25, 0.25]],
    ['攪拌流五段沖法', [25, 20, 20, 20, null], [2.5, 0.2, 0.26, 0.26, 0.28]],
    ['肥尾沖法', [35, 25, 5, 5, 5, null], [2.5, 0.2, 0.2, 0.2, 0.2, 0.2]],
  ]) {
    const steps = methods.find(m => m.name === name)?.step_template.steps ?? []
    r.check(JSON.stringify(steps.map(s => s.duration)) === JSON.stringify(durations),
      `${name}：duration ${durations.join(' / ')}`)
    r.check(JSON.stringify(steps.map(s => s.factor)) === JSON.stringify(factors),
      `${name}：水量比例沒有被動到`)
  }
  const threeStageNote = methods.find(m => m.name === '三段式沖法')?.step_template.steps[0].note
  r.check(threeStageNote === '讓粉床完全濕透', '段落備註沒有被動到')
  const descriptions = await pg.rows(`select name, description from brew_methods
    where user_id is null and name in ('五段式沖法', '攪拌流五段沖法')`)
  r.check(descriptions.find(d => d.name === '五段式沖法')?.description.includes('台灣社群的五段變體'),
    '五段式的說明標明是台灣變體')
  r.check(descriptions.find(d => d.name === '攪拌流五段沖法')?.description.includes('台灣常見的五段結構'),
    '攪拌流的說明標明是台灣常見結構')

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
