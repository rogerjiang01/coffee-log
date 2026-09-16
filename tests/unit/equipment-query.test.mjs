// user_equipment 的查詢定義只有一份（結構檢查）。
//
// 器材管理頁與沖煮表單共用 equipment:all 這個快取 key，卻各自寫了一份
// select：管理頁只要 `equipment_catalog ( brand, model, variant )`，
// 表單還要六個 grind_scale_*。先開管理頁再進表單，刻度規格全部是 undefined，
// 磨豆機的範圍提示就消失，超出範圍填 87 也沒人攔——而 console 什麼都沒說。
//
// 執行期的檢查（utils/cacheKeys.ts 的欄位集合比對）只在開發模式跑，
// 而且要真的照那個順序走過一遍才會發現。這裡把它釘在原始碼上：
// user_equipment 的欄位集合只准出現在 utils/equipment.ts。

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { createReport } from '../helpers/report.mjs'

const root = new URL('../../', import.meta.url)
const read = path => readFileSync(new URL(path, root), 'utf8')

function sourceFiles(dir) {
  const out = []
  for (const name of readdirSync(new URL(dir, root))) {
    const path = `${dir}/${name}`
    if (statSync(new URL(path, root)).isDirectory()) out.push(...sourceFiles(path))
    else if (/\.(vue|ts)$/.test(name)) out.push(path)
  }
  return out
}

/** `from('user_equipment')` 之後接的 select 引數（原樣，含引號或識別字） */
function equipmentSelects(text) {
  const out = []
  // 中間不可以再出現 .from(——Promise.all 裡緊接著的下一個查詢不算
  const pattern = /from\(\s*["']user_equipment["']\s*\)(?:(?!\.from\()[\s\S]){0,200}?\.select\(\s*([^)\n]+?)\s*\)/g
  for (const match of text.matchAll(pattern)) out.push(match[1])
  return out
}

export default function run() {
  const r = createReport('器材查詢的單一定義')

  const sources = [
    ...sourceFiles('components'), ...sourceFiles('pages'),
    ...sourceFiles('utils'), ...sourceFiles('composables'),
  ]

  r.section('欄位集合只有一份')
  const shared = read('utils/equipment.ts')
  const scaleColumns = [
    'grind_scale_min', 'grind_scale_max', 'grind_scale_increment',
    'grind_scale_suggested_min', 'grind_scale_suggested_max', 'grind_scale_note',
  ]
  const constant = (shared.match(/const CATALOG_COLUMNS = \[[\s\S]*?USER_EQUIPMENT_SELECT[\s\S]*?\n\n/) || [''])[0]
  r.check(/export const USER_EQUIPMENT_SELECT/.test(shared), 'utils/equipment.ts 匯出 USER_EQUIPMENT_SELECT')
  r.check(/export const EQUIPMENT_CATALOG_SELECT/.test(shared),
    '型錄表自己的查詢也從同一份欄位清單來——它與內嵌的欄位本來就該一樣')
  for (const column of [...scaleColumns, 'note', 'is_default', 'catalog_id']) {
    r.check(constant.includes(column), `共用的 select 含 ${column}`)
  }

  r.section('沒有第二個呼叫端自己寫欄位')
  // 存在性檢查（沖煮表單存檔前確認器材還在）只要 id，沒有經過快取，
  // 不會與任何人共用 key——那是唯一允許的例外
  const offenders = []
  for (const path of sources) {
    if (path === 'utils/equipment.ts') continue
    for (const argument of equipmentSelects(read(path))) {
      if (argument === 'USER_EQUIPMENT_SELECT') continue
      if (/^["']id["']$/.test(argument)) continue
      offenders.push(`${path} → select(${argument})`)
    }
  }
  r.check(offenders.length === 0,
    `user_equipment 的欄位一律走 USER_EQUIPMENT_SELECT${offenders.length ? `：${offenders.join('、')}` : ''}`)

  // 刻度欄位散落在別處等同於「又有人自己寫了一份型錄欄位」
  const scattered = sources
    .filter(path => path !== 'utils/equipment.ts')
    .filter(path => scaleColumns.some(column => read(path).includes(column)))
  r.check(scattered.length === 0,
    `grind_scale_* 的欄位名只出現在 utils/equipment.ts${scattered.length ? `：${scattered.join('、')}` : ''}`)

  r.section('排序也只寫一次')
  // 三個地方各寫一份排序，遲早有一處漏掉 id 這個決勝鍵，
  // 然後同一批資料在不同頁面排出不同順序
  r.check(/export function orderUserEquipment/.test(shared), '排序抽成 orderUserEquipment')
  const handRolled = sources
    .filter(path => path !== 'utils/equipment.ts')
    .filter(path => /from\(\s*["']user_equipment["']\s*\)(?:(?!\.from\()[\s\S]){0,200}?\.order\(/.test(read(path)))
  r.check(handRolled.length === 0,
    `沒有人自己排 user_equipment${handRolled.length ? `：${handRolled.join('、')}` : ''}`)

  r.section('刻度規格的組裝也是一份')
  r.check(/export function grindScaleOf/.test(shared), '型錄列轉 GrindScaleSpec 走 grindScaleOf')
  const assemblers = sources
    .filter(path => path !== 'utils/equipment.ts')
    .filter(path => /suggestedMin:/.test(read(path)))
  r.check(assemblers.length === 0,
    `沒有人自己拼 GrindScaleSpec${assemblers.length ? `：${assemblers.join('、')}` : ''}`)

  r.section('空值判斷同時處理 null 與 undefined')
  // 缺欄位的查詢結果給的是 undefined，`=== null` 會判成「有這個值」
  r.check(/export function unset\(/.test(shared), '有 unset() 這個單一判斷')
  const strictChecks = (shared.match(/spec\.\w+ === null/g) || [])
  r.check(strictChecks.length === 0,
    `刻度欄位不用 === null 判斷${strictChecks.length ? `：${strictChecks.join('、')}` : ''}`)

  return r.finish()
}
