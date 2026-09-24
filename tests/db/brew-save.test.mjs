// 新增紀錄時「紀錄建好了、分段沒寫進去」之後再按一次儲存（utils/brewSave.ts）。
//
// 這一下是使用者看到錯誤後最自然的動作，它不能再建一筆重複的紀錄。
// 用真的資料庫跑：分段寫入第一次故意失敗（先寫進一段再失敗，模擬半途斷線），
// 第二次帶著記住的 id 重送。

import { readFileSync } from 'node:fs'
import { createDatabase } from '../helpers/pg.mjs'
import { createReport } from '../helpers/report.mjs'
import { saveNewBrew } from '../../utils/brewSave.ts'
import { toStepRows } from '../../utils/brewSteps.ts'

const sql = value => value === null || value === undefined ? 'null'
  : typeof value === 'number' || typeof value === 'boolean' ? String(value)
    : `'${String(value).replace(/'/g, "''")}'`

export default async function run() {
  const r = createReport('新增紀錄：分段失敗後再按儲存')
  const pg = await createDatabase()
  const A = await pg.createUser('brew-save@test')
  await pg.as(A)
  const bean = (await pg.rows(`insert into beans (user_id, name) values ('${A}', '耶加雪菲') returning id`))[0].id
  const before = (await pg.rows(`select count(*)::int n from brews where user_id = '${A}'`))[0].n

  const steps = [
    { stepType: 'bloom', cumulativeWater: 40, holdSeconds: 30, note: '' },
    { stepType: 'pour', cumulativeWater: 150, holdSeconds: 20, note: '' },
    { stepType: 'pour', cumulativeWater: 240, holdSeconds: null, note: '' },
  ]
  let failSteps = true

  /** 與 pages/brews/new.vue 同一組操作，只是換成直接下 SQL */
  const store = {
    async insertBrew(row) {
      const cols = Object.keys(row)
      const rows = await pg.rows(`insert into brews (${cols.join(',')}) values (${cols.map(c => sql(row[c])).join(',')}) returning id`)
      return { id: rows[0]?.id ?? null, error: null }
    },
    async updateBrew(id, row) {
      const sets = Object.entries(row).map(([k, v]) => `${k} = ${sql(v)}`).join(', ')
      await pg.exec(`update brews set ${sets} where id = '${id}'`)
      return { error: null }
    },
    async writeSteps(brewId, replace) {
      if (replace) await pg.exec(`delete from brew_steps where brew_id = '${brewId}'`)
      const rows = toStepRows(steps)
      for (const [i, step] of rows.entries()) {
        // 第一次：寫進第一段之後斷線
        if (failSteps && i === 1) return { error: new Error('Failed to fetch') }
        await pg.exec(`insert into brew_steps (brew_id, user_id, step_index, step_type, cumulative_water, hold_seconds)
          values ('${brewId}', '${A}', ${step.step_index}, '${step.step_type}', ${step.cumulative_water}, ${sql(step.hold_seconds)})`)
      }
      return { error: null }
    },
  }

  const row = {
    user_id: A, bean_id: bean, dose: 15, water_temp: 92,
    form_duration_seconds: 60, params_duration_seconds: 40, tasting_duration_seconds: 10,
  }

  r.section('第一次儲存：紀錄建好了，分段寫到一半失敗')
  const first = await saveNewBrew(store, null, row)
  r.check(!first.ok && first.stage === 'steps' && !!first.id, '回報「分段失敗」，並交回已經建立的紀錄 id')
  const id = first.ok ? null : first.stage === 'steps' ? first.id : null
  r.check((await pg.rows(`select count(*)::int n from brew_steps where brew_id = '${id}'`))[0].n === 1, '前提：分段只寫進了一段')

  r.section('再按一次儲存（帶著記住的 id）')
  failSteps = false
  // 使用者在失敗之後改了水溫，也多花了時間
  const second = await saveNewBrew(store, id, { ...row, water_temp: 93, form_duration_seconds: 999 })
  r.check(second.ok && second.id === id, '成功，而且是同一筆紀錄')
  const after = (await pg.rows(`select count(*)::int n from brews where user_id = '${A}'`))[0].n
  r.check(after === before + 1, `資料庫裡只多了一筆紀錄（${after - before}）`)
  const stored = await pg.rows(`select step_index, cumulative_water, hold_seconds from brew_steps where brew_id = '${id}' order by step_index`)
  r.check(JSON.stringify(stored.map(s => [s.step_index, Number(s.cumulative_water), s.hold_seconds]))
    === '[[1,40,30],[2,150,20],[3,240,null]]', '分段完整寫入，沒有重複的第一段')
  const brew = (await pg.rows(`select water_temp, form_duration_seconds from brews where id = '${id}'`))[0]
  r.check(brew.water_temp === 93, '失敗之後改過的欄位也存進去了')
  r.check(brew.form_duration_seconds === 60, '耗時是第一次建立時的值，不被第二次蓋掉（只在建立時寫入）')

  r.section('頁面有接上')
  const page = readFileSync(new URL('../../pages/brews/new.vue', import.meta.url), 'utf8')
  r.check(/saveNewBrew\(/.test(page) && /pendingBrewId\.value, row\)/.test(page), 'pages/brews/new.vue 用 saveNewBrew，帶著記住的 id')
  r.check(/pendingBrewId\.value = result\.id/.test(page), '分段失敗時記住那筆 id')
  r.check(/紀錄已儲存，分段儲存失敗。請再按一次儲存。/.test(page)
    && /紀錄已儲存，分段儲存失敗。請再按一次儲存。/.test(readFileSync(new URL('../../pages/brews/[id]/edit.vue', import.meta.url), 'utf8')),
  '新增頁與編輯頁同一句文案')
  r.check(/errorCause\(result\.error\)/.test(page)
    && /errorCause\(stepError\)/.test(readFileSync(new URL('../../pages/brews/[id]/edit.vue', import.meta.url), 'utf8')),
  '括號裡只附原因（errorCause），同一則訊息不會出現兩個「請」')

  await pg.close()
  return r.finish()
}
