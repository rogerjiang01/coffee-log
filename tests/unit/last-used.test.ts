// 器材的「上次使用時間」。
//
// 相對時間的邊界特別容易寫錯，而且錯了不會報錯——只會顯示
// 「六天前用過」而其實是上週。這種錯沒有人會回報，只會慢慢
// 侵蝕使用者對這個欄位的信任。

import { relativeUsed, lastUsedFromBrews, EQUIPMENT_COLUMNS } from '../../utils/equipment.ts'
import { createReport, equal } from '../helpers/report.mjs'

// 固定「現在」，否則測試會在跨日的那一刻變成不穩定
const NOW = new Date(2026, 8, 7, 14, 0, 0) // 2026-09-07 14:00
const daysAgo = (n: number, hour = 10) => {
  const d = new Date(NOW)
  d.setDate(d.getDate() - n)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}

export default function run() {
  const r = createReport('器材的上次使用時間')

  r.section('以「日」為單位，不是以 24 小時')
  // 昨天 23:00 到今天 01:00 只差兩小時，但使用者說的是「昨天」
  r.check(relativeUsed(daysAgo(0, 1), NOW) === '今天用過', '今天凌晨也算今天')
  r.check(relativeUsed(daysAgo(0, 13), NOW) === '今天用過', '今天稍早')
  r.check(relativeUsed(daysAgo(1, 23), NOW) === '昨天用過',
    '昨天深夜——只差 15 小時，但跨了日就是昨天')

  r.section('各級距的邊界')
  r.check(relativeUsed(daysAgo(2), NOW) === '兩天前用過', '2 天')
  r.check(relativeUsed(daysAgo(6), NOW) === '六天前用過', '6 天仍是「天」')
  r.check(relativeUsed(daysAgo(7), NOW) === '上週用過', '7 天進「上週」')
  r.check(relativeUsed(daysAgo(13), NOW) === '上週用過', '13 天仍是上週')
  r.check(relativeUsed(daysAgo(14), NOW) === '兩週前用過', '14 天進「兩週前」')
  r.check(relativeUsed(daysAgo(29), NOW) === '四週前用過', '29 天仍是週')
  r.check(relativeUsed(daysAgo(30), NOW) === '上個月用過', '30 天進「上個月」')
  r.check(relativeUsed(daysAgo(59), NOW) === '上個月用過', '59 天仍是上個月')
  r.check(relativeUsed(daysAgo(60), NOW) === '兩個月前用過', '60 天進「兩個月前」')
  r.check(relativeUsed(daysAgo(329), NOW) === '十個月前用過', '329 天是十個月')
  r.check(relativeUsed(daysAgo(330), NOW) === '十一個月前用過', '330 天是十一個月——月份上限')
  r.check(relativeUsed(daysAgo(364), NOW) === '一年前用過',
    '364 天說「一年前」而不是「12 個月前」——後者要讀的人自己換算')
  r.check(relativeUsed(daysAgo(365), NOW) === '一年前用過', '365 天進「一年前」')
  r.check(relativeUsed(daysAgo(730), NOW) === '兩年前用過', '兩年')

  r.section('沒用過就留空')
  // 不顯示「從未使用」——那是解釋現況（《03》§5.6）
  r.check(relativeUsed(null, NOW) === null, 'null')
  r.check(relativeUsed(undefined, NOW) === null, 'undefined')
  r.check(relativeUsed('', NOW) === null, '空字串')
  r.check(relativeUsed('不是日期', NOW) === null, '壞掉的值不會炸掉，也不亂猜')

  r.section('未來的時間不猜')
  const tomorrow = new Date(NOW); tomorrow.setDate(tomorrow.getDate() + 1)
  r.check(relativeUsed(tomorrow.toISOString(), NOW) === null,
    '資料有問題時回 null，不要顯示「-1 天前」')

  r.section('一次抓回全部再配對')
  // 五個類型逐台查就是十幾趟來回。傳入的列必須已由新到舊排序。
  const rows = [
    { brewed_at: '2026-09-06', grinder_id: 'g1', dripper_id: 'd1', filter_id: null, kettle_id: null, server_id: null },
    { brewed_at: '2026-09-01', grinder_id: 'g2', dripper_id: 'd1', filter_id: 'f1', kettle_id: null, server_id: null },
    { brewed_at: '2026-08-20', grinder_id: 'g1', dripper_id: null, filter_id: null, kettle_id: 'k1', server_id: null },
  ]
  const used = lastUsedFromBrews(rows, EQUIPMENT_COLUMNS)
  r.check(used.get('g1') === '2026-09-06', '同一台出現多次時取最新的那筆')
  r.check(used.get('g2') === '2026-09-01', '只出現一次')
  r.check(used.get('d1') === '2026-09-06', '不同類型的欄位一起掃')
  r.check(used.get('k1') === '2026-08-20', '較舊的那筆也收得到')
  r.check(!used.has('f2'), '沒出現過的 id 不在結果裡')
  r.check(used.size === 5, `五台器材（實際 ${used.size}）`)

  r.check(EQUIPMENT_COLUMNS.length === 5, '五個類型的欄位都涵蓋')
  r.check(lastUsedFromBrews([], EQUIPMENT_COLUMNS).size === 0, '沒有紀錄時回空 Map')
  r.check(lastUsedFromBrews([{ brewed_at: null, grinder_id: 'g1' }], EQUIPMENT_COLUMNS).size === 0,
    '沒有 brewed_at 的列跳過')

  r.section('接起來')
  r.check(relativeUsed(used.get('g1') ?? null, new Date(2026, 8, 7)) === '昨天用過',
    '查到的時間直接餵給格式化')

  return r.finish()
}
