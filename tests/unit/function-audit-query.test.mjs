// 部署前後在正式庫跑的函式權限盤點（supabase/queries/函式權限盤點.sql）有兩份清單，
// 都要與程式碼同步——這支查詢存在的理由就是「本機看不到的東西」，
// 它自己的清單要是過期了，它會在正式庫上報假警報，或更糟，漏報。
//
//   known    public schema 應該存在的函式 ＝ migration 建的 ＋ 已知的後台物件
//   allowed  明確開放給用戶端的函式 ＝ tests/db/function-grants.test.mjs 的 ALLOWED

import { readFileSync, readdirSync } from 'node:fs'
import { createReport } from '../helpers/report.mjs'

const root = new URL('../../', import.meta.url)
const read = path => readFileSync(new URL(path, root), 'utf8')
const stripSqlComments = text => text.replace(/--.*$/gm, '')

export default function run() {
  const r = createReport('函式權限盤點查詢的清單')
  const audit = stripSqlComments(read('supabase/queries/函式權限盤點.sql'))

  const knownBlock = audit.match(/known\(name, source\) as \(values([\s\S]*?)\n\),/)?.[1] ?? ''
  const known = [...knownBlock.matchAll(/\('([a-z_]+)',\s*'([^']*)'\)/g)].map(m => ({ name: m[1], source: m[2] }))
  r.check(known.length > 0, `找得到 known 清單（${known.length} 支）`)

  // migration 建的每一支函式都要在 known 裡
  const dir = 'supabase/migrations'
  const created = new Set()
  for (const file of readdirSync(new URL(dir, root)).filter(f => f.endsWith('.sql'))) {
    for (const m of stripSqlComments(read(`${dir}/${file}`)).matchAll(/create\s+(?:or\s+replace\s+)?function\s+public\.([a-z_]+)/gi)) {
      created.add(m[1])
    }
  }
  r.section('migration 建的函式都在 known 裡')
  for (const name of created) {
    r.check(known.some(k => k.name === name), `${name}`)
  }

  r.section('known 裡標成 migration 的，都真的有 migration 建它')
  for (const k of known.filter(k => k.source.startsWith('migration'))) {
    r.check(created.has(k.name), `${k.name}（${k.source}）`)
    const file = k.source.replace(/^migration：/, '')
    r.check(readdirSync(new URL(dir, root)).includes(file), `${k.name} 註明的檔案 ${file} 存在`)
  }

  r.section('known 裡不是 migration 的，要說明來源')
  for (const k of known.filter(k => !k.source.startsWith('migration'))) {
    r.check(/^後台：/.test(k.source) && k.source.length > 4, `${k.name}：${k.source}`)
  }

  r.section('allowed 與 function-grants 測試的 ALLOWED 一致')
  const allowedBlock = audit.match(/allowed\(name, role\) as \(([\s\S]*?)\n\),/)?.[1] ?? ''
  const allowedSql = [...allowedBlock.matchAll(/\('([a-z_]+)',\s*'(anon|authenticated)'\)/g)]
    .map(m => `${m[2]}:${m[1]}`).sort()
  const testSrc = read('tests/db/function-grants.test.mjs')
  const allowedTest = ['anon', 'authenticated'].flatMap((role) => {
    const list = testSrc.match(new RegExp(`${role}:\\s*\\[([^\\]]*)\\]`))?.[1] ?? ''
    return [...list.matchAll(/'([a-z_]+)'/g)].map(m => `${role}:${m[1]}`)
  }).sort()
  r.check(JSON.stringify(allowedSql) === JSON.stringify(allowedTest),
    `查詢 [${allowedSql.join(', ') || '空'}]　測試 [${allowedTest.join(', ') || '空'}]`)

  r.section('部署步驟有寫進 CLAUDE.md')
  r.check(read('CLAUDE.md').includes('supabase/queries/函式權限盤點.sql'), 'CLAUDE.md 提到這支查詢')

  return r.finish()
}
