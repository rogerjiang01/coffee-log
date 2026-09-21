// 分段注水寫進真實 Postgres 之後的樣子、舊資料的搬移，以及複製流程。
//
// 單元測試驗的是轉換函式，這裡驗的是它與資料庫約束合起來還對不對。

import { readFileSync } from 'node:fs'
import { createDatabase } from '../helpers/pg.mjs'
import { createReport, equal } from '../helpers/report.mjs'
import { toStepRows, toStepInputs } from '../../utils/brewSteps.ts'

export default async function run() {
  const r = createReport('分段注水與複製流程（資料庫）')
  const pg = await createDatabase()
  const A = await pg.createUser('a@test')
  await pg.as(A)

  const bean = (await pg.rows(`insert into beans (user_id,name) values ('${A}','耶加雪菲') returning id`))[0].id

  r.section('介面 → 資料庫')
  const ui = [
    { stepType: 'bloom', cumulativeWater: 40, holdSeconds: 45, note: '' },
    { stepType: 'pour', cumulativeWater: 160, holdSeconds: 30, note: '' },
    { stepType: 'stir', cumulativeWater: 220, holdSeconds: 30, note: '輕輕轉兩圈' },
    { stepType: 'pour', cumulativeWater: 290, holdSeconds: 40, note: '' },
  ]
  const totalTime = 145
  const brew = (await pg.rows(`insert into brews (user_id,bean_id,dose,total_time,form_duration_seconds,params_duration_seconds,tasting_duration_seconds)
    values ('${A}','${bean}',20,${totalTime},73,40,25) returning id`))[0].id
  for (const row of toStepRows(ui)) {
    await pg.exec(`insert into brew_steps (brew_id,user_id,step_index,hold_seconds,cumulative_water,step_type,note)
      values ('${brew}','${A}',${row.step_index},${row.hold_seconds === null ? 'null' : row.hold_seconds},${row.cumulative_water},'${row.step_type}',${row.note === null ? 'null' : `'${row.note}'`})`)
  }
  const stored = await pg.rows(`select step_index,hold_seconds,cumulative_water,step_type,note
    from brew_steps where brew_id='${brew}' order by step_index`)
  r.check(equal(stored.map(s => s.hold_seconds), [45, 30, 30, null]),
    `資料庫裡就是使用者填的純停水秒數 ${JSON.stringify(stored.map(s => s.hold_seconds))}，沒有換算`)
  r.check(stored.at(-1).hold_seconds === null, '最後一段沒有停留——沒有下一注，那段時間由 total_time 表達')
  r.check(equal(stored.map(s => Number(s.cumulative_water)), [40, 160, 220, 290]), '累積水量直接存，不換算')
  r.check(stored[2].step_type === 'stir' && stored[2].note === '輕輕轉兩圈', '攪拌標記與段落備註正確寫入')
  r.check(stored[0].note === null, '沒填備註的段落存 null')

  r.section('資料庫 → 介面')
  const back = toStepInputs(stored.map(s => ({
    step_index: s.step_index, hold_seconds: s.hold_seconds,
    cumulative_water: Number(s.cumulative_water), step_type: s.step_type, note: s.note,
  })))
  r.check(equal(back.map(s => s.holdSeconds), [45, 30, 30, null]), '讀回介面完全一致，不必靠 total_time 反推')

  r.section('資料庫約束')
  await r.mustReject(pg.query(`insert into brew_steps (brew_id,user_id,step_index,hold_seconds,cumulative_water)
    values ('${brew}','${A}',1,0,50)`), 'step_index 在同一筆紀錄內不可重複')
  await r.mustReject(pg.query(`insert into brew_steps (brew_id,user_id,step_index,hold_seconds)
    values ('${brew}','${A}',9,0)`), 'cumulative_water 不可為空')
  await pg.exec(`insert into brew_steps (brew_id,user_id,step_index,cumulative_water)
    values ('${brew}','${A}',9,50)`)
  r.check((await pg.rows(`select hold_seconds h from brew_steps where brew_id='${brew}' and step_index=9`))[0].h === null,
    'hold_seconds 可為空——「沒記錄」直接由資料表達，不必用 0 代替')
  await pg.exec(`delete from brew_steps where brew_id='${brew}' and step_index=9`)
  await r.mustReject(pg.query(`update brews set rating=6 where id='${brew}'`), '評分超出 1–5 被擋下')
  await r.mustReject(pg.query(`update brews set rating=0 where id='${brew}'`), '評分 0 也被擋下，未評分要用 null')

  r.section('衍生值不存資料庫')
  const cols = (await pg.rows(`select column_name from information_schema.columns where table_name='brews'`))
    .map(x => x.column_name)
  for (const field of ['total_water', 'brew_ratio', 'rest_days', 'extraction_yield']) {
    r.check(!cols.includes(field), `brews 沒有 ${field} 欄位`)
  }
  r.check(cols.includes('form_duration_seconds'), 'form_duration_seconds 存在')
  r.check((await pg.rows(`select form_duration_seconds f from brews where id='${brew}'`))[0].f === 73,
    'form_duration_seconds 有寫入')

  r.section('參數與品飲各自的耗時（§9.1）')
  const durations = (await pg.rows(`select form_duration_seconds t, params_duration_seconds p,
    tasting_duration_seconds s from brews where id='${brew}'`))[0]
  r.check(durations.p === 40 && durations.s === 25, '兩個區段的秒數各自寫入')
  r.check(durations.p + durations.s <= durations.t,
    '兩段相加不超過總耗時——差額是日期這類不歸任何一段的欄位')
  const blank = (await pg.rows(`insert into brews (user_id,bean_id,dose)
    values ('${A}','${bean}',20) returning params_duration_seconds p, tasting_duration_seconds s`))[0]
  r.check(blank.p === null && blank.s === null,
    '沒寫就是 NULL——既有紀錄不回填，NULL 的意思是「沒有分段資料」不是 0')

  r.section('複製流程')
  const copy = (await pg.rows(`insert into brews (user_id,bean_id,dose,total_time,copied_from_brew_id)
    values ('${A}','${bean}',20,${totalTime},'${brew}') returning id`))[0].id
  r.check((await pg.rows(`select copied_from_brew_id c from brews where id='${copy}'`))[0].c === brew,
    'copied_from_brew_id 指向來源紀錄')
  for (const st of stored) {
    await pg.exec(`insert into brew_steps (brew_id,user_id,step_index,hold_seconds,cumulative_water,step_type,note)
      values ('${copy}','${A}',${st.step_index},${st.hold_seconds === null ? 'null' : st.hold_seconds},${st.cumulative_water},'${st.step_type}',${st.note === null ? 'null' : `'${st.note}'`})`)
  }
  const copied = await pg.rows(`select step_type,note from brew_steps where brew_id='${copy}' order by step_index`)
  r.check(copied.length === 4 && copied[2].step_type === 'stir' && copied[2].note === '輕輕轉兩圈',
    '完整分段連同攪拌標記與備註都被複製')
  const tasting = (await pg.rows(`select rating,is_favorite,tasting_notes,intensity from brews where id='${copy}'`))[0]
  r.check(tasting.rating === null && tasting.is_favorite === false
    && tasting.tasting_notes === null && tasting.intensity === null, '品飲欄位一律留空，不繼承')

  r.section('來源被刪除')
  await pg.exec(`delete from brews where id='${brew}'`)
  r.check((await pg.rows(`select copied_from_brew_id c from brews where id='${copy}'`))[0].c === null,
    'copied_from_brew_id 變成 null，差異區塊自然不顯示')
  r.check((await pg.rows(`select 1 from brews where id='${copy}'`)).length === 1, '複製出來的紀錄本身不受影響')
  r.check((await pg.rows(`select 1 from brew_steps where brew_id='${copy}'`)).length === 4, '它的分段也還在')

  r.section('舊資料搬移（跑的是 migration 裡那兩段 UPDATE）')
  // 驗的是 20260914100000 真正會跑的 SQL，不是它的仿製品：
  // 重建舊欄位、灌入舊格式的資料、執行從檔案讀出來的 UPDATE。
  const migration = readFileSync(
    new URL('../../supabase/migrations/20260914100000_brew_steps_hold_seconds.sql', import.meta.url), 'utf8')
  const updates = migration
    .split(';')
    // 每段前面都有註解，去掉註解行才看得到語句本身
    .map(chunk => chunk.split('\n').filter(line => !line.trim().startsWith('--')).join('\n').trim())
    .filter(statement => /^update brew_steps/i.test(statement))
  r.check(updates.length === 2, `migration 裡有兩段 UPDATE（實際 ${updates.length}）`)

  await pg.asSuperuser()
  await pg.exec('alter table brew_steps add column time_offset int')
  const timed = (await pg.rows(`insert into brews (user_id,bean_id,dose,total_time)
    values ('${A}','${bean}',20,145) returning id`))[0].id
  const zeroed = (await pg.rows(`insert into brews (user_id,bean_id,dose,total_time)
    values ('${A}','${bean}',20,180) returning id`))[0].id
  // 有記錄時間的舊紀錄：累積時間點 0 / 45 / 75 / 105
  for (const [index, offset] of [[1, 0], [2, 45], [3, 75], [4, 105]]) {
    await pg.exec(`insert into brew_steps (brew_id,user_id,step_index,time_offset,cumulative_water)
      values ('${timed}','${A}',${index},${offset},${index * 50})`)
  }
  // 沒記錄時間的舊紀錄：舊模型 NOT NULL 逼出來的一排 0
  for (const index of [1, 2, 3]) {
    await pg.exec(`insert into brew_steps (brew_id,user_id,step_index,time_offset,cumulative_water)
      values ('${zeroed}','${A}',${index},0,${index * 50})`)
  }
  await pg.exec(`update brew_steps set hold_seconds = null where brew_id in ('${timed}','${zeroed}')`)
  for (const statement of updates) await pg.exec(statement)

  const migrated = (await pg.rows(
    `select hold_seconds h from brew_steps where brew_id='${timed}' order by step_index`)).map(x => x.h)
  r.check(equal(migrated, [45, 30, 30, null]),
    `累積時間點 [0,45,75,105] 搬成停留秒數 ${JSON.stringify(migrated)}——精確的逆運算，最後一段是 null`)
  const zeroMigrated = (await pg.rows(
    `select hold_seconds h from brew_steps where brew_id='${zeroed}' order by step_index`)).map(x => x.h)
  r.check(zeroMigrated.every(v => v === null),
    `原本全為 0 的紀錄整筆設成 null ${JSON.stringify(zeroMigrated)}——那些 0 是舊模型的產物，不是真的停 0 秒`)
  await pg.exec('alter table brew_steps drop column time_offset')

  await pg.close()
  return r.finish()
}
