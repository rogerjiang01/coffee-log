// 每週記錄目標（20261006100000_weekly_goals.sql、《01》§15）。
//
// 每一條都「真的去做一次」：anon 碰不到、讀不到別人的列、不能替別人新增、
// 不能改也不能刪（歷程）、不能把目標改在過去、杯數只能 1–21、帳號刪除時一併刪除。

import { createDatabase } from '../helpers/pg.mjs'
import { createReport } from '../helpers/report.mjs'

export default async function run() {
  const r = createReport('每週記錄目標（資料庫）')
  const pg = await createDatabase()

  async function attempt(sql) {
    try {
      await pg.exec(sql)
      return null
    }
    catch (error) {
      return error.message
    }
  }
  const denied = message => /permission denied|row-level security/i.test(message ?? '')

  await pg.asSuperuser()
  const A = await pg.createUser('goal-a@test')
  const B = await pg.createUser('goal-b@test')

  r.section('自己的列：新增與讀取')
  await pg.as(A)
  r.check(await attempt(`insert into weekly_goals (cups) values (3)`) === null, '新增自己的目標（user_id 預設是自己）')
  r.check(await attempt(`insert into weekly_goals (user_id, cups) values ('${A}', 5)`) === null, '明寫自己的 user_id 也可以')
  const own = await pg.rows(`select user_id, cups from weekly_goals order by created_at, cups`)
  r.check(own.length === 2 && own.every(row => row.user_id === A), '讀得到自己的兩列（修改是新增一列，不是覆蓋）')

  r.section('別人的列')
  await pg.as(B)
  r.check((await pg.rows(`select * from weekly_goals`)).length === 0, 'B 讀不到 A 的列')
  r.check(denied(await attempt(`insert into weekly_goals (user_id, cups) values ('${A}', 7)`)), 'B 不能替 A 新增')
  await pg.asSuperuser()
  r.check((await pg.rows(`select * from weekly_goals where user_id = '${A}'`)).length === 2, 'A 的列沒有被多寫')

  r.section('歷程：不能改、不能刪、不能改在過去')
  await pg.as(A)
  r.check(denied(await attempt(`update weekly_goals set cups = 9`)), '不能修改既有的列')
  r.check(denied(await attempt(`delete from weekly_goals`)), '不能刪除既有的列')
  r.check(denied(await attempt(`insert into weekly_goals (cups, created_at) values (4, now() - interval '30 days')`)),
    '不能自己指定建立時間（某一週的目標由它決定）')
  r.check(denied(await attempt(`insert into weekly_goals (cups, created_at) values (4, now() + interval '1 day')`)), '未來也不行')
  await pg.asSuperuser()
  r.check((await pg.rows(`select cups from weekly_goals where user_id = '${A}' order by cups`)).map(row => row.cups).join() === '3,5',
    '兩列都還在，值沒變')

  r.section('杯數 1–21（check constraint）')
  await pg.as(A)
  r.check(/check/i.test(await attempt(`insert into weekly_goals (cups) values (0)`) ?? ''), '0 杯擋下')
  r.check(/check/i.test(await attempt(`insert into weekly_goals (cups) values (22)`) ?? ''), '22 杯擋下')
  r.check(await attempt(`insert into weekly_goals (cups) values (1)`) === null && await attempt(`insert into weekly_goals (cups) values (21)`) === null,
    '1 與 21 可以')
  r.check(/null/i.test(await attempt(`insert into weekly_goals (cups) values (null)`) ?? ''), '沒有杯數擋下')

  r.section('anon 沒有任何權限')
  await pg.exec('reset role')
  await pg.exec(`select set_config('test.uid', '', false)`)
  await pg.exec('set role anon')
  r.check(denied(await attempt(`select * from weekly_goals`)), 'anon 不能讀')
  r.check(denied(await attempt(`insert into weekly_goals (user_id, cups) values ('${A}', 3)`)), 'anon 不能新增')

  r.section('帳號刪除時一併刪除')
  await pg.asSuperuser()
  await pg.exec(`delete from auth.users where id = '${A}'`)
  r.check((await pg.rows(`select * from weekly_goals where user_id = '${A}'`)).length === 0, 'A 的目標跟著刪除')

  await pg.close()
  return r.finish()
}
