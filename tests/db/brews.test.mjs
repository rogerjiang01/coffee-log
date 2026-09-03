// 分段注水寫進真實 Postgres 之後的樣子，以及複製流程。
//
// 單元測試驗的是換算函式，這裡驗的是它與資料庫約束合起來還對不對。

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
  const brew = (await pg.rows(`insert into brews (user_id,bean_id,dose,total_time,form_duration_seconds)
    values ('${A}','${bean}',20,${totalTime},73) returning id`))[0].id
  for (const row of toStepRows(ui)) {
    await pg.exec(`insert into brew_steps (brew_id,user_id,step_index,time_offset,cumulative_water,step_type,note)
      values ('${brew}','${A}',${row.step_index},${row.time_offset},${row.cumulative_water},'${row.step_type}',${row.note === null ? 'null' : `'${row.note}'`})`)
  }
  const stored = await pg.rows(`select step_index,time_offset,cumulative_water,step_type,note
    from brew_steps where brew_id='${brew}' order by step_index`)
  r.check(equal(stored.map(s => s.time_offset), [0, 45, 75, 105]),
    `資料庫裡是累積時間點 ${JSON.stringify(stored.map(s => s.time_offset))}，不是停留秒數 [45,30,30,40]`)
  r.check(equal(stored.map(s => Number(s.cumulative_water)), [40, 160, 220, 290]), '累積水量直接存，不換算')
  r.check(stored[2].step_type === 'stir' && stored[2].note === '輕輕轉兩圈', '攪拌標記與段落備註正確寫入')
  r.check(stored[0].note === null, '沒填備註的段落存 null')

  r.section('資料庫 → 介面')
  const back = toStepInputs(stored.map(s => ({
    step_index: s.step_index, time_offset: s.time_offset,
    cumulative_water: Number(s.cumulative_water), step_type: s.step_type, note: s.note,
  })), totalTime)
  r.check(equal(back.map(s => s.holdSeconds), [45, 30, 30, 40]), '讀回介面還原成停留秒數')

  r.section('資料庫約束')
  await r.mustReject(pg.query(`insert into brew_steps (brew_id,user_id,step_index,time_offset,cumulative_water)
    values ('${brew}','${A}',1,0,50)`), 'step_index 在同一筆紀錄內不可重複')
  await r.mustReject(pg.query(`insert into brew_steps (brew_id,user_id,step_index,time_offset)
    values ('${brew}','${A}',9,0)`), 'cumulative_water 不可為空')
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

  r.section('複製流程')
  const copy = (await pg.rows(`insert into brews (user_id,bean_id,dose,total_time,copied_from_brew_id)
    values ('${A}','${bean}',20,${totalTime},'${brew}') returning id`))[0].id
  r.check((await pg.rows(`select copied_from_brew_id c from brews where id='${copy}'`))[0].c === brew,
    'copied_from_brew_id 指向來源紀錄')
  for (const st of stored) {
    await pg.exec(`insert into brew_steps (brew_id,user_id,step_index,time_offset,cumulative_water,step_type,note)
      values ('${copy}','${A}',${st.step_index},${st.time_offset},${st.cumulative_water},'${st.step_type}',${st.note === null ? 'null' : `'${st.note}'`})`)
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

  await pg.close()
  return r.finish()
}
