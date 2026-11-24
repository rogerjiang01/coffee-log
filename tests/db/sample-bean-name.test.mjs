// 範例的標示改成寫在豆名裡（20261123100000_sample_bean_name.sql，《01》§13.2）。
//
// 這支 migration 會覆寫既有使用者的資料（update beans.name），所以重現「推上去之前」的正式庫：
// 先不套這一支、寫進舊資料，再由測試自己執行它，確認只改到該改的列。

import fs from 'node:fs'
import { createDatabase } from '../helpers/pg.mjs'
import { createReport } from '../helpers/report.mjs'

const FILE = '20261123100000_sample_bean_name.sql'
const OLD = '衣索比亞 耶加雪菲'
const NEW = '範例-衣索比亞 耶加雪菲'

export default async function run() {
  const r = createReport('範例的標示寫在豆名裡')
  const pg = await createDatabase({ skip: [FILE] })
  await pg.asSuperuser()

  // 推上去之前註冊的三個人
  const untouched = await pg.createUser('untouched@test') // 範例豆子還是原本的名稱
  const renamed = await pg.createUser('renamed@test') // 自己把範例豆子改了名
  const own = await pg.createUser('own@test') // 刪掉範例，自己建了一支同名的豆子
  await pg.exec(`update beans set name='我的耶加' where user_id='${renamed}'`)
  await pg.exec(`delete from beans where user_id='${own}'`)
  await pg.exec(`insert into beans (user_id, name) values ('${own}', '${OLD}')`)
  const nameOf = async uid => (await pg.rows(`select name, is_sample from beans where user_id='${uid}'`))

  r.section('推之前：範例豆子是原本的名稱')
  r.check((await nameOf(untouched))[0]?.name === OLD, `舊的建立函式：「${OLD}」`)

  await pg.exec(fs.readFileSync(new URL(`../../supabase/migrations/${FILE}`, import.meta.url), 'utf8'))

  r.section('既有使用者：只改還是原本名稱的範例豆子')
  const a = await nameOf(untouched)
  r.check(a.length === 1 && a[0].name === NEW && a[0].is_sample === true, `改成「${NEW}」，仍然是範例`)
  const b = await nameOf(renamed)
  r.check(b.length === 1 && b[0].name === '我的耶加' && b[0].is_sample === true, '使用者改過名稱的不動')
  const c = await nameOf(own)
  r.check(c.length === 1 && c[0].name === OLD && c[0].is_sample === false, '不是範例的同名豆子不動')
  r.check((await pg.rows(`select count(*)::int n from beans where is_sample and name='${OLD}'`))[0].n === 0,
    '套完之後沒有「是範例而且仍是原本名稱」的列（migration 自己的檢查也是這一條）')

  r.section('新使用者：建立函式直接用新的名稱')
  const fresh = await pg.createUser('fresh@test')
  const d = await nameOf(fresh)
  r.check(d.length === 1 && d[0].name === NEW && d[0].is_sample === true, `新註冊的範例豆子是「${NEW}」`)
  r.check((await pg.rows(`select count(*)::int n from brews where user_id='${fresh}' and is_sample`))[0].n === 1
    && (await pg.rows(`select count(*)::int n from user_equipment where user_id='${fresh}' and is_sample`))[0].n === 1,
    '其餘照舊：一筆範例紀錄、一台範例磨豆機')

  r.section('權限沒有被 create or replace 重設')
  const acl = (await pg.rows(`select proacl::text acl from pg_proc where proname='create_sample_data'`))[0].acl ?? ''
  r.check(!/(^|[{,])(anon|authenticated)=/.test(acl) && !/(^|[{,])=X/.test(acl),
    `anon、authenticated、PUBLIC 都沒有執行權（${acl || '空'}）`)

  r.section('重跑一次不會出錯，也不會再改')
  await pg.exec(fs.readFileSync(new URL(`../../supabase/migrations/${FILE}`, import.meta.url), 'utf8'))
  r.check((await nameOf(untouched))[0].name === NEW && (await nameOf(own))[0].name === OLD, '名稱維持不變')

  await pg.close()
  return r.finish()
}
