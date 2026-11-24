// 內外圓角的盤點（《03》§2.3.1）。**只在本機跑，不在 pnpm test 裡**：要起 nuxt dev 與瀏覽器，一輪約五分鐘。
//
// 用法（在專案根目錄）：
//   node scripts/radius-audit/run.mjs                 全部重跑
//   node scripts/radius-audit/run.mjs --only "表單|下拉"  只跑標籤符合的狀態
//
// 第一次要先下載瀏覽器：pnpm exec playwright install chromium
//
// 做什麼：
//   1. 起一個假 Supabase（fake-supabase.mjs，127.0.0.1:54329），**不連正式庫**
//   2. 起 nuxt dev（port 3111），SUPABASE_URL 指向假的那個；登入狀態用偽造的 session cookie
//   3. 用 Chromium、375px 逐一開啟下面 STATES 的每個狀態（頁面、表單、子頁、下拉、對話框、提示、登入註冊、骨架），
//      在頁面裡跑 measure.js
//   4. 分類、去重，寫到 tmp-screenshots/radius-audit/（已在 .gitignore）：report.md、raw.json、每個狀態一張截圖
//   5. 有「要處理」的組合時結束碼是 1
//
// 不會新增任何路由，不寫任何專案檔案（只寫 tmp-screenshots/）。
//
// 分類（《03》§2.3.1）：
//   A 內層比外層還圓（不論在不在轉角區）
//   B 在轉角區，實際和應為差超過 2px
//   C 形狀由高度決定（膠囊、開關、圓點）
// 判定：
//   符合        在轉角區、差距 ≤ 2px，而且不是 A
//   例外 a      照片與縮圖（維持各自的 token）
//   例外 b      形狀由高度決定、沒有大於外層
//   要處理      其他（A 一律要處理）
// 新增狀態：在 STATES 加一筆 { label, url, act? }。

import { spawn } from 'node:child_process'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { FAKE_USER_ID, startFakeSupabase } from './fake-supabase.mjs'

const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const OUT = `${ROOT}tmp-screenshots/radius-audit`
const SB_PORT = 54329
const APP_PORT = 3111
const APP = `http://localhost:${APP_PORT}`
const SB = `http://127.0.0.1:${SB_PORT}`
const MEASURE = fs.readFileSync(new URL('./measure.js', import.meta.url), 'utf8')
const IMG = fs.readFileSync(`${ROOT}public/splash/v1/cover-1.webp`)
const onlyArg = process.argv.indexOf('--only')
const only = onlyArg > 0 ? new RegExp(process.argv[onlyArg + 1]) : null

// ── 偽造的登入狀態：@supabase/ssr 的 cookie（名稱取自 SUPABASE_URL 的主機名第一段）。
// 簽章是假的：只有假 Supabase 會收到這個 token，它不驗
function sessionCookie() {
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url')
  const now = Math.floor(Date.now() / 1000), exp = now + 3600 * 24 * 365
  const user = { id: FAKE_USER_ID, aud: 'authenticated', role: 'authenticated', email: 'fake@example.test', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }
  const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: FAKE_USER_ID, aud: 'authenticated', role: 'authenticated', exp, iat: now, email: user.email })}.sig`
  const session = { access_token: token, token_type: 'bearer', expires_in: 3600 * 24 * 365, expires_at: exp, refresh_token: 'fake', user }
  return { name: 'sb-127-auth-token', value: `base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`, domain: 'localhost', path: '/' }
}

const click = (p, sel) => p.locator(sel).first().click()
const openShare = async (p) => { await click(p, 'button[aria-label="分享"]'); await p.waitForTimeout(400) }
const STATES = [
  // 頁面：四個分頁第一層、設定、紀錄詳情、豆子詳情、結算頁、分享頁、目標設定
  ...['/', '/brews', '/beans', '/equipment', '/settings', '/brews/r2', '/beans/b1', '/brews/r2/summary', '/s/abc123', '/goal'].map(url => ({ label: `頁面 ${url}`, url })),
  // 六張表單與錯誤狀態
  ...['/beans/new', '/beans/b1/edit', '/brews/new', '/brews/r2/edit', '/equipment/new', '/equipment/e1/edit'].map(url => ({ label: `表單 ${url}`, url })),
  ...['/beans/new', '/brews/new', '/equipment/new'].map(url => ({ label: `表單 ${url} 錯誤`, url, act: p => click(p, 'button[type=submit]') })),
  // 子頁
  { label: '子頁 分段', url: '/brews/r2/edit', act: p => click(p, 'button:has-text("編輯分段")') },
  { label: '子頁 器材選擇器清單', url: '/brews/r2/edit', act: p => p.locator('button:has-text("選填")').nth(0).click() },
  { label: '子頁 器材選擇器新增', url: '/brews/r2/edit', act: async (p) => { await p.locator('button:has-text("選填")').nth(0).click(); await p.waitForTimeout(600); await click(p, 'dialog[open] button[aria-label*="新增"]') } },
  // 下拉
  { label: '下拉 豆子（沖煮表單）', url: '/brews/r2/edit', act: p => click(p, 'button:has-text("瓜地馬拉")') },
  { label: '下拉 產國（豆子表單）', url: '/beans/new', act: p => p.locator('button:has-text("選填")').nth(0).click() },
  { label: '下拉 處理法（豆子表單）', url: '/beans/new', act: p => p.locator('button:has-text("選填")').nth(1).click() },
  { label: '下拉 品種（豆子表單）', url: '/beans/new', act: p => p.locator('button:has-text("選填")').nth(2).click() },
  { label: '下拉 型號（器材表單）', url: '/equipment/e1/edit', act: p => click(p, 'button:has-text("Comandante")') },
  // 對話框與全螢幕浮層
  { label: '對話框 刪除紀錄', url: '/brews/r2', act: p => click(p, 'button:has-text("刪除")') },
  { label: '對話框 刪除豆子', url: '/beans/b1', act: p => click(p, 'button:has-text("刪除")') },
  { label: '對話框 刪除器材', url: '/equipment/e1/edit', act: p => click(p, 'button:has-text("刪除")') },
  { label: '對話框 分享', url: '/brews/r2', act: openShare },
  { label: '對話框 目標', url: '/', act: p => click(p, 'button:has-text("本週目標")') },
  { label: '對話框 登出', url: '/settings', act: p => click(p, 'button:has-text("登出")') },
  { label: '浮層 照片放大', url: '/brews/r2', act: p => click(p, 'button[aria-label="放大豆袋照片"]') },
  { label: '浮層 裁切', url: '/beans/new', act: p => p.locator('input[type=file]').first().setInputFiles(`${ROOT}public/splash/v1/cover-1.webp`) },
  // 頁面層級的提示（分享）
  { label: '提示 已複製連結', url: '/brews/r2', act: async (p) => { await openShare(p); await click(p, 'dialog[open] button:has-text("複製連結")') } },
  { label: '提示 無法複製', url: '/brews/r2', act: async (p) => {
    await p.evaluate(() => { Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('x')) } }); document.execCommand = () => false })
    await openShare(p); await click(p, 'dialog[open] button:has-text("複製連結")')
  } },
  { label: '提示 分享建立失敗', url: '/brews/r2', share: 'fail', act: async (p) => { await openShare(p); await click(p, 'dialog[open] button:has-text("複製連結")'); await p.waitForTimeout(1500) } },
  // 登入、註冊
  { label: '登入', url: '/login', auth: false },
  { label: '登入 欄位錯誤', url: '/login', auth: false, act: p => click(p, 'button[type=submit]') },
  { label: '登入 帳密錯誤', url: '/login', auth: false, act: async (p) => { await p.locator('input[type=email]').fill('a@b.test'); await p.locator('input[type=password]').fill('wrongpass'); await click(p, 'button[type=submit]'); await p.waitForTimeout(800) } },
  { label: '註冊', url: '/signup', auth: false },
  { label: '註冊 欄位錯誤', url: '/signup', auth: false, act: p => click(p, 'button[type=submit]') },
  { label: '註冊 確認信寄出了', url: '/signup', auth: false, act: async (p) => { await p.locator('input[type=email]').fill('a@b.test'); await p.locator('input[type=password]').fill('goodpass1'); await click(p, 'button[type=submit]'); await p.waitForTimeout(800) } },
  // 載入中的骨架：瀏覽器對資料表的請求永遠不回
  ...['/', '/brews', '/beans', '/equipment', '/brews/r2', '/beans/b1', '/brews/r2/summary', '/s/abc123', '/beans/b1/edit', '/brews/r2/edit', '/equipment/e1/edit', '/brews/new']
    .map(url => ({ label: `骨架 ${url}`, url, hang: true })),
]

function classify(r) {
  const tags = []
  if (r.kind === 'larger' || r.actual > r.R + 0.5) tags.push('A')
  if (r.kind === 'corner' && Math.abs(r.actual - r.should) > 2) tags.push('B')
  if (r.capsule) tags.push('C')
  let verdict
  if (r.photo) verdict = '例外 a（照片）'
  else if (tags.includes('A')) verdict = '要處理'
  else if (!tags.includes('B')) verdict = '符合'
  else if (r.capsule) verdict = '例外 b（形狀由高度決定）'
  else verdict = '要處理'
  return { tags: tags.join('') || '—', verdict }
}

async function waitFor(url, ms) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    try { if ((await fetch(url)).ok) return } catch {}
    await new Promise(r => setTimeout(r, 1000))
  }
  throw new Error(`等不到 ${url}`)
}

fs.mkdirSync(OUT, { recursive: true })
const sb = await startFakeSupabase(SB_PORT)
const nuxt = spawn('pnpm', ['exec', 'nuxt', 'dev', '--port', String(APP_PORT)], {
  cwd: ROOT, env: { ...process.env, SUPABASE_URL: SB, SUPABASE_KEY: 'fake' }, stdio: 'ignore', detached: true,
})
const stopAll = () => { try { process.kill(-nuxt.pid) } catch {} sb.close() }
process.on('SIGINT', () => { stopAll(); process.exit(130) })

const raw = []
try {
  console.log('等 nuxt dev 起來…')
  await waitFor(`${APP}/login`, 180_000)
  const browser = await chromium.launch()
  for (const s of STATES) {
    if (only && !only.test(s.label)) continue
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, timezoneId: 'Asia/Taipei', locale: 'zh-TW' })
    if (s.auth !== false) await ctx.addCookies([sessionCookie()])
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: APP })
    // 分享頁的縮圖網址要伺服器的 secret key 簽，這裡直接給一張
    await ctx.route('**/api/shared-photo/**', r => r.request().url().includes('/image')
      ? r.fulfill({ body: IMG, contentType: 'image/webp' })
      : r.fulfill({ json: { thumb: `${APP}/api/shared-photo/x/image?v=thumb`, full: null } }))
    if (s.hang) await ctx.route(`${SB}/rest/v1/**`, () => {})
    const page = await ctx.newPage()
    try {
      await fetch(`${SB}/__mode?share=${s.share ?? 'ok'}`)
      await page.goto(APP + s.url, { waitUntil: s.hang ? 'domcontentloaded' : 'networkidle', timeout: 60_000 })
      await page.waitForTimeout(s.hang ? 2500 : 1200)
      if (s.act) await s.act(page)
      await page.waitForTimeout(700)
      const rows = await page.evaluate(MEASURE)
      for (const r of rows) raw.push({ state: s.label, ...r })
      await page.screenshot({ path: `${OUT}/${s.label.replace(/[\\/ ：:]/g, '_')}.png` })
      console.log(`${s.label}：${rows.length}`)
    }
    catch (e) {
      raw.push({ state: s.label, error: String(e).slice(0, 300) })
      console.log(`${s.label}：失敗 ${String(e).split('\n')[0]}`)
    }
    await ctx.close()
  }
  await browser.close()
}
finally {
  stopAll()
}

// ── 去重：同一對元件、同樣的數字只列一次，附上出現的狀態
const groups = new Map()
for (const r of raw.filter(r => !r.error)) {
  const strip = s => s.replace(/「.*」/, '')
  const key = [r.kind, strip(r.outer), strip(r.inner), r.corner, r.R, r.dx, r.dy, r.actual].join('|')
  if (!groups.has(key)) groups.set(key, { ...r, ...classify(r), states: new Set() })
  groups.get(key).states.add(r.state)
}
const order = { '要處理': 0, '例外 a（照片）': 1, '例外 b（形狀由高度決定）': 2, '符合': 3 }
const list = [...groups.values()].sort((a, b) => order[a.verdict] - order[b.verdict])
const errors = raw.filter(r => r.error)
const md = [
  `# 內外圓角盤點（375px，Chromium，${new Date().toISOString().slice(0, 10)}）`, '',
  '規則與分類見《03》§2.3.1。間距從外層的外緣量起（外層的框線算在間距裡）。', '',
  '| 判定 | 分類 | 外層 | 內層 | 角 | 外層圓角 | 間距（水平／垂直） | 應為 | 實際 | 狀態 |',
  '|---|---|---|---|---|---|---|---|---|---|',
  ...list.map(g => `| ${g.verdict} | ${g.tags} | ${g.outer} | ${g.inner}（${g.innerSize}） | ${g.corner} | ${g.R} | ${g.dx}／${g.dy} | ${g.kind === 'corner' ? g.should : '不在轉角區'} | ${g.actual} | ${[...g.states].join('、')} |`),
  '', errors.length ? `## 沒有量到的狀態\n\n${errors.map(e => `- ${e.state}：${e.error.split('\n')[0]}`).join('\n')}` : '',
].join('\n')
fs.writeFileSync(`${OUT}/report.md`, md)
fs.writeFileSync(`${OUT}/raw.json`, JSON.stringify(raw, null, 1))

const todo = list.filter(g => g.verdict === '要處理')
console.log(`\n組合 ${list.length}：要處理 ${todo.length}、例外 a ${list.filter(g => g.verdict.startsWith('例外 a')).length}、例外 b ${list.filter(g => g.verdict.startsWith('例外 b')).length}、符合 ${list.filter(g => g.verdict === '符合').length}`)
for (const g of todo) console.log(`  要處理 ${g.tags}：${g.outer} ⊃ ${g.inner}（外 ${g.R}、應為 ${g.should ?? '—'}、實際 ${g.actual}）`)
if (errors.length) console.log(`沒有量到 ${errors.length} 個狀態，見 report.md`)
console.log(`報告：${OUT}/report.md`)
process.exit(todo.length || errors.length ? 1 : 0)
