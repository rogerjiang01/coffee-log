// 內外圓角盤點用的假 Supabase（《03》§2.3.1）。只在本機回固定的假資料，**請求不會到正式庫**。
//
// 只做頁面畫得出來需要的那幾件事：Auth 的 user、各資料表的 GET（只認 eq／is／in 與 limit）、
// Storage 的簽名網址、分享的兩支 RPC、登入失敗與註冊後等收信。寫入一律回空的成功。
// 資料涵蓋盤點會碰到的情況：有照片與沒有照片的豆子、長豆名、收藏、未評分、範例、三種器材（型錄兩台、自建一台）。
//
// 用法：由 run.mjs 啟動（startFakeSupabase），不單獨執行。
// 控制：GET /__mode?share=fail 讓 create_brew_share 回 500（盤點「分享建立失敗」的提示）。

import http from 'node:http'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const IMG = fileURLToPath(new URL('../../public/splash/v1/cover-1.webp', import.meta.url))
export const FAKE_USER_ID = '00000000-0000-4000-8000-000000000001'
const USER = { id: FAKE_USER_ID, aud: 'authenticated', role: 'authenticated', email: 'fake@example.test', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }
const bean = (id, name, roast_level, photo_path = null) => ({ id, user_id: USER.id, name, roast_level, photo_path, roast_date: '2026-11-01', is_finished: false, is_sample: false })
const B1 = bean('b1', '瓜地馬拉 微微特南果', 'medium', 'u/b1.webp')
const B2 = bean('b2', '範例-衣索比亞 耶加雪菲', 'medium_light')
const B3 = bean('b3', '哥倫比亞 慧蘭 粉紅波旁 厭氧日曬 阿瓜斯莊園限量批次', 'light')
const B4 = bean('b4', '肯亞 涅里 AA', null)
let n = 0
const brew = (brewed_at, beanRow, o) => ({ id: `r${++n}`, user_id: USER.id, bean_id: beanRow?.id ?? null, beans: beanRow, brewed_at, dose: 18, water_temp: 92, grind_setting: 28, total_time: 132, rating: 4, is_favorite: false, is_sample: false, ...o })
const BREWS = [
  brew('2025-12-28T00:30:00Z', B1, { is_favorite: true }),                                  // 不是今年＋收藏
  brew('2026-11-23T00:30:00Z', B1, { is_favorite: true }),
  brew('2026-11-22T13:05:00Z', B2, { dose: 15, grind_setting: 20, total_time: 150, is_sample: true }),
  brew('2026-11-20T23:59:00Z', B3, { rating: null, dose: 20.5, grind_setting: 8.5, is_favorite: true }),
  brew('2026-11-18T02:00:00Z', B4, { rating: 2, water_temp: null, grind_setting: null, total_time: null }),
  brew('2026-11-15T04:00:00Z', null, { rating: 5 }),
]
const water = { r1: 288, r2: 288, r3: 225, r4: 320, r6: 300 }
const STEPS = Object.entries(water).flatMap(([id, w]) => [[1, 40], [2, Math.round(w * 0.6)], [3, w]].map(([i, c]) => ({ brew_id: id, step_index: i, cumulative_water: c, hold_seconds: null, step_type: i === 1 ? 'bloom' : 'pour', note: null })))
const CATALOG = [
  { id: 'k1', type: 'grinder', brand: 'Comandante', model: 'C40', variant: null, grind_scale_min: 0, grind_scale_max: 40, grind_scale_increment: 1, grind_scale_suggested_min: 18, grind_scale_suggested_max: 30, grind_scale_note: null },
  { id: 'k2', type: 'dripper', brand: 'Hario', model: 'V60', variant: '02', grind_scale_min: null, grind_scale_max: null, grind_scale_increment: null, grind_scale_suggested_min: null, grind_scale_suggested_max: null, grind_scale_note: null },
]
const EQUIP = [
  { id: 'e1', user_id: USER.id, catalog_id: 'k1', type: 'grinder', custom_name: null, is_default: true, is_sample: false, note: null, equipment_catalog: CATALOG[0] },
  { id: 'e2', user_id: USER.id, catalog_id: 'k2', type: 'dripper', custom_name: null, is_default: true, is_sample: true, note: null, equipment_catalog: CATALOG[1] },
  { id: 'e3', user_id: USER.id, catalog_id: null, type: 'kettle', custom_name: '月兔印 細口壺', is_default: false, is_sample: false, note: '0.7L', equipment_catalog: null },
]
const MODE = { share: 'ok' }
const SHARED = { is_owner: false, bean: { name: '瓜地馬拉 微微特南果', roaster: '某某烘豆', roast_level: 'medium', roast_date: '2026-11-01', has_photo: true }, brewed_at: '2026-11-23T00:30:00Z', dose: 18, water_temp: 92, grind_setting: 28, total_time: 132, method: '4:6 法', grinder: 'Comandante C40', dripper: 'Hario V60 02', kettle: null,
  steps: [{ step_index: 1, step_type: 'bloom', cumulative_water: 40, hold_seconds: 30, note: null }, { step_index: 2, step_type: 'pour', cumulative_water: 170, hold_seconds: 20, note: null }, { step_index: 3, step_type: 'pour', cumulative_water: 288, hold_seconds: null, note: null }],
  rating: 4, is_favorite: true, intensity: { acidity: 3, sweetness: 4 }, flavor_tags: ['柑橘', '莓果'], notes: '很乾淨' }
const TABLES = {
  beans: () => [B1, B2, B3, B4], brews: () => BREWS, brew_steps: () => STEPS, user_equipment: () => [],
  weekly_goals: () => [{ id: 'g1', user_id: USER.id, cups: 5, created_at: '2026-11-01T00:00:00Z' }],
  profiles: () => [{ id: USER.id }],
  user_equipment: () => EQUIP.filter(e => true),
  equipment_catalog: () => CATALOG,
  brew_methods: () => [{ id: 'm1', name: '4:6 法', user_id: null, default_ratio: 15, step_template: [] }],
  flavor_tags: () => [{ id: 'f1', name: '柑橘', aliases: [], user_id: null, category: 'fruity' }, { id: 'f2', name: '莓果', aliases: [], user_id: null, category: 'fruity' }],
  countries: () => [{ id: 'c1', name_zh: '衣索比亞', name_en: 'Ethiopia', iso_code: 'ET', continent: 'africa' }, { id: 'c2', name_zh: '肯亞', name_en: 'Kenya', iso_code: 'KE', continent: 'africa' }],
  processing_methods: () => [{ id: 'p1', name: '水洗', user_id: null }, { id: 'p2', name: '日曬', user_id: null }],
  varieties: () => [{ id: 'v1', name: '藝伎', user_id: null }],
}
function filter(rows, params) {
  for (const [key, raw] of params) {
    if (['select', 'order', 'limit', 'offset', 'or', 'columns'].includes(key)) continue
    const [op, ...rest] = raw.split('.'); const val = rest.join('.')
    rows = rows.filter((row) => {
      if (!(key in row)) return true
      const cell = row[key] === null ? 'null' : String(row[key])
      if (op === 'eq' || op === 'is') return cell === val
      if (op === 'in') return val.slice(1, -1).split(',').map(s => s.replace(/"/g, '')).includes(cell)
      return true
    })
  }
  const limit = params.get('limit')
  return limit ? rows.slice(0, Number(limit)) : rows
}
function handle(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*')
  res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS,HEAD')
  res.setHeader('Access-Control-Expose-Headers', 'content-range')
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end() }
  const url = new URL(req.url, 'http://x')
  if (url.pathname.startsWith('/storage/v1/object/sign/') && req.method === 'GET') {
    res.setHeader('content-type', 'image/webp'); return res.end(fs.readFileSync(IMG))
  }
  res.setHeader('content-type', 'application/json')
  if (url.pathname === '/auth/v1/user') return res.end(JSON.stringify(USER))
  if (url.pathname.startsWith('/storage/v1/object/sign/') && req.method === 'POST') {
    let body = ''; req.on('data', c => body += c); req.on('end', () => {
      const { paths } = JSON.parse(body || '{}')
      // 一次要很多張（createSignedUrls，body 有 paths）回陣列；只要一張（createSignedUrl，路徑在網址上）回物件
      if (!paths) return res.end(JSON.stringify({ signedURL: `${url.pathname.slice('/storage/v1'.length)}?token=x` }))
      res.end(JSON.stringify(paths.map(p => ({ path: p, signedURL: `/object/sign/bean-photos/${p}?token=x`, error: null }))))
    }); return
  }
  if (url.pathname === '/__mode') { MODE.share = url.searchParams.get('share'); return res.end('{}') }
  if (url.pathname === '/auth/v1/token') { res.writeHead(400); return res.end(JSON.stringify({ code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' })) }
  if (url.pathname === '/auth/v1/signup') return res.end(JSON.stringify({ ...USER, id: '00000000-0000-4000-8000-000000000009', identities: [{ id: 'x' }], confirmation_sent_at: '2026-11-24T00:00:00Z' }))
  if (url.pathname === '/rest/v1/rpc/get_shared_brew') return res.end(JSON.stringify(SHARED))
  if (url.pathname === '/rest/v1/rpc/create_brew_share') {
    if (MODE.share === 'fail') { res.writeHead(500); return res.end(JSON.stringify({ code: 'XX000', message: 'fake failure' })) }
    // 成功時回傳建立的代碼（BrewShare 比對它判斷成功）
    let body = ''; req.on('data', c => body += c); req.on('end', () => res.end(JSON.stringify(JSON.parse(body || '{}').p_code ?? null)))
    return
  }
  if (url.pathname.startsWith('/rest/v1/rpc/')) return res.end('null')
  const one = (req.headers.accept || '').includes('vnd.pgrst.object')
  if (url.pathname.startsWith('/rest/v1/') && req.method === 'GET') {
    const rows = filter(TABLES[url.pathname.slice(9)]?.() ?? [], url.searchParams)
    if (one) return rows.length ? res.end(JSON.stringify(rows[0])) : (res.writeHead(406), res.end(JSON.stringify({ code: 'PGRST116', message: 'no rows' })))
    res.setHeader('content-range', `0-${rows.length - 1}/${rows.length}`)
    return res.end(JSON.stringify(rows))
  }
  res.end(one ? '{}' : '[]')
}

/** 啟動假 Supabase，回傳 server（用完 close） */
export function startFakeSupabase(port) {
  return new Promise((resolve) => {
    const server = http.createServer(handle)
    server.listen(port, '127.0.0.1', () => resolve(server))
  })
}
