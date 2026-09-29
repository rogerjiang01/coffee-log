// 部署前後在正式庫跑的資料表權限盤點（supabase/queries/資料表權限盤點.sql）有兩份清單，
// 都要與程式碼同步——做法與 function-audit-query.test.mjs 相同。
//
//   known    public schema 應該存在的資料表 ＝ migration 建的（扣掉後來 drop 的）
//   allowed  每張表對三個角色的權限 ＝ tests/helpers/table-grants.mjs 的 TABLE_GRANTS
//
// 另外守一條 CLAUDE.md 的規則：20261001100000 之後建表的 migration，
// 要在同一支裡啟用 RLS、revoke all 再 grant。

import { readFileSync, readdirSync } from 'node:fs'
import { createReport } from '../helpers/report.mjs'
import { PRIVILEGES, ROLES, TABLE_GRANTS } from '../helpers/table-grants.mjs'

const root = new URL('../../', import.meta.url)
const read = path => readFileSync(new URL(path, root), 'utf8')
const stripSqlComments = text => text.replace(/--.*$/gm, '')

// 從這一支起，新表不再自動拿到任何權限
const DEFAULTS_REVOKED = '20261001100000_table_default_privileges.sql'

export default function run() {
  const r = createReport('資料表權限盤點查詢的清單')
  const audit = stripSqlComments(read('supabase/queries/資料表權限盤點.sql'))

  const knownBlock = audit.match(/known\(name, source\) as \(values([\s\S]*?)\n\),/)?.[1] ?? ''
  const known = [...knownBlock.matchAll(/\('([a-z_]+)',\s*'([^']*)'\)/g)].map(m => ({ name: m[1], source: m[2] }))
  r.check(known.length > 0, `找得到 known 清單（${known.length} 張）`)

  // 依檔名順序重播 create table／drop table，記下建立它的檔案
  const dir = 'supabase/migrations'
  const files = readdirSync(new URL(dir, root)).filter(f => f.endsWith('.sql')).sort()
  const created = new Map()
  const newTables = []
  for (const file of files) {
    const sql = stripSqlComments(read(`${dir}/${file}`))
    for (const m of sql.matchAll(/(create\s+table(?:\s+if\s+not\s+exists)?|drop\s+table(?:\s+if\s+exists)?)\s+(?:public\.)?([a-z_]+)/gi)) {
      if (/^drop/i.test(m[1])) created.delete(m[2])
      else {
        created.set(m[2], file)
        if (file >= DEFAULTS_REVOKED) newTables.push({ file, name: m[2], sql })
      }
    }
  }

  r.section('migration 建的資料表都在 known 裡')
  for (const name of created.keys()) r.check(known.some(k => k.name === name), name)

  r.section('known 裡的每一張，都真的有 migration 建它')
  for (const k of known) {
    r.check(created.has(k.name), `${k.name}：現在還存在，沒有被後面的 migration drop 掉`)
    r.check(k.source === `migration：${created.get(k.name)}`, `${k.name} 註明的檔案是 ${k.source.replace(/^migration：/, '')}`)
  }

  r.section('allowed 與 tests/helpers/table-grants.mjs 的 TABLE_GRANTS 一致')
  const allowedBlock = audit.match(/allowed\(tbl, role, privs\) as \(values([\s\S]*?)\n\),/)?.[1] ?? ''
  const fromSql = [...allowedBlock.matchAll(/\('([a-z_]+)',\s*'([a-z_]+)',\s*'([a-z,]+)'\)/g)]
    .flatMap(m => (m[3] === 'all' ? PRIVILEGES : m[3].split(',')).map(p => `${m[1]}:${m[2]}:${p}`)).sort()
  const fromHelper = Object.entries(TABLE_GRANTS)
    .flatMap(([table, grants]) => Object.entries(grants).flatMap(([role, privs]) => privs.map(p => `${table}:${role}:${p}`))).sort()
  r.check(fromSql.length > 0 && JSON.stringify(fromSql) === JSON.stringify(fromHelper),
    `查詢 ${fromSql.length} 項、白名單 ${fromHelper.length} 項`)
  r.check(!/'anon'/.test(allowedBlock), 'allowed 裡沒有 anon')
  r.check(Object.values(TABLE_GRANTS).every(g => Object.keys(g).every(role => ROLES.includes(role))),
    '白名單只用 anon／authenticated／service_role 三個角色')
  r.check(JSON.stringify(Object.keys(TABLE_GRANTS).sort()) === JSON.stringify(known.map(k => k.name).sort()),
    'known 與白名單列的是同一批表')

  r.section(`${DEFAULTS_REVOKED} 之後建表的 migration：同一支裡啟用 RLS、revoke all、再 grant`)
  r.check(true, `目前 ${newTables.length} 張`)
  for (const { file, name, sql } of newTables) {
    r.check(new RegExp(`alter\\s+table\\s+(?:public\\.)?${name}\\s+enable\\s+row\\s+level\\s+security`, 'i').test(sql),
      `${file}：${name} 啟用 RLS`)
    r.check(new RegExp(`revoke\\s+all\\s+on\\s+(?:table\\s+)?[^;]*\\b${name}\\b[^;]*from\\s+[^;]*anon`, 'i').test(sql),
      `${file}：${name} 先 revoke all（含 anon）`)
  }

  r.section('部署步驟與規則有寫進 CLAUDE.md')
  const claude = read('CLAUDE.md')
  r.check(claude.includes('supabase/queries/資料表權限盤點.sql'), 'CLAUDE.md 提到這支查詢')
  r.check(/建立資料表的 migration/.test(claude) && /revoke all/.test(claude), 'CLAUDE.md 有建表的權限規則')

  return r.finish()
}
