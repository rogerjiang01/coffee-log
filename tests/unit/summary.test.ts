// 結算頁的第一筆紀錄、第一杯的內容，以及縮圖佔位與範例標籤（utils/summary.ts、utils/roast.ts，《02》§5「結算頁」）。

import { firstCupBean, firstCupRows, isFirstRecord } from '../../utils/summary.ts'
import { roastFill } from '../../utils/roast.ts'
import type { StatBrew } from '../../utils/dashboard.ts'
import { createReport } from '../helpers/report.mjs'


let n = 0
const brew = (over: Partial<StatBrew> = {}): StatBrew => ({
  id: `r${++n}`, bean_id: 'b1', brewed_at: '2026-10-08T01:00:00Z', rating: null, dose: 15, is_sample: false,
  beans: { name: '耶加雪菲', photo_path: null, roast_level: null, is_finished: false }, ...over,
})
const step = (i: number, water: number) => ({ step_index: i, hold_seconds: null, cumulative_water: water, step_type: 'pour' as const, note: null })
const bean = {
  name: '耶加雪菲', roast_level: 'light' as const, roast_date: '2026-09-30', region: '耶加雪菲',
  countries: { name_zh: '衣索比亞' }, processing_methods: { name: '水洗' },
}

export default function run() {
  const r = createReport('結算頁的第一筆紀錄與第一杯')

  r.section('第一筆紀錄（不含範例紀錄）')
  const first = brew({ id: 'me' })
  r.check(isFirstRecord([first], 'me'), '只有這一筆：第一筆紀錄')
  r.check(isFirstRecord([first, brew({ is_sample: true }), brew({ is_sample: true })], 'me'), '範例紀錄不算：仍是第一筆')
  r.check(!isFirstRecord([first, brew()], 'me'), '之前已經有一筆：照舊顯示「第 N 筆紀錄」')
  r.check(!isFirstRecord([brew()], 'me'), '統計裡還沒有這一筆：不把別的那一筆當成它')
  r.check(!isFirstRecord([], 'me'), '統計是空的：不是')

  r.section('「這支豆子」：有填才顯示')
  const full = firstCupBean(bean, '2026-10-08T01:00:00Z', [first])
  r.check(full.rows.map(row => `${row.label}:${row.value}`).join() === '產國:衣索比亞,產區:耶加雪菲,處理法:水洗,烘焙度:淺焙',
    `產國、產區、處理法、烘焙度：${full.rows.map(row => row.value).join('、')}`)
  const empty = firstCupBean({ ...bean, roast_level: null, roast_date: null, region: '  ', countries: null, processing_methods: null }, '2026-10-08T01:00:00Z', [first])
  r.check(empty.rows.length === 0 && empty.restDay === null, '都沒填：一列都沒有，也沒有養豆天數')
  r.check(firstCupBean(null, '2026-10-08T01:00:00Z', [first]).rows.length === 0, '沒有豆子：一列都沒有')

  r.section('「養豆第 N 天」：算法與紀錄詳情相同（烘焙日到沖煮日期）')
  const days = firstCupBean(bean, new Date(2026, 9, 8, 9).toISOString(), [first]).restDay
  r.check(days === 8, `9/30 烘焙、10/8 沖：第 8 天（${days}）`)
  r.check(firstCupBean({ ...bean, roast_date: '2026-10-09' }, new Date(2026, 9, 8, 9).toISOString(), [first]).restDay === null,
    '烘焙日期在沖煮日期之後：不顯示')

  r.section('「第 N 支豆子」：有紀錄的豆子數，包含這一支，排除範例紀錄')
  const ordinal = (stats: StatBrew[]) => firstCupBean(bean, '2026-10-08T01:00:00Z', stats).beanOrdinal
  r.check(ordinal([first]) === 1, '第一支')
  r.check(ordinal([first, brew({ bean_id: 'b2' }), brew({ bean_id: 'b2' }), brew({ bean_id: 'b3' })]) === 3, '三支有紀錄的豆子，同一支算一次')
  r.check(ordinal([first, brew({ bean_id: 'sample', is_sample: true })]) === 1, '只有範例紀錄的豆子不算')

  r.section('「這一杯」：有值才列，格式與比較區相同')
  const rows = firstCupRows({ dose: 15, water_temp: 92, grind_setting: 22.5, brew_methods: { name: '四六法' } }, [step(1, 50), step(2, 225)])
  r.check(rows.map(row => `${row.label}:${row.value}`).join() === '粉重:15 g,粉水比:1:15.0,水溫:92 °C,研磨刻度:22.5,沖煮手法:四六法',
    `粉重、粉水比、水溫、研磨刻度、沖煮手法：${rows.map(row => row.value).join('、')}`)
  r.check(firstCupRows({ dose: 15, water_temp: null, grind_setting: null, brew_methods: null }, []).map(row => row.label).join() === '粉重',
    '只填粉重、沒有分段：只列粉重（粉水比要有總水量）')

  r.section('縮圖的佔位（全站共用）')
  r.check(roastFill('light').background === 'var(--roast-light)', '沒有照片、有烘焙度：烘焙度色塊')
  r.check(roastFill(null).background === 'var(--field-border)' && roastFill(undefined).background === 'var(--field-border)',
    '沒有照片、也沒填烘焙度：灰色（--field-border），不是白色')
  r.check(roastFill(null).background !== 'var(--surface)' && roastFill(null).background !== 'var(--border)',
    '不是卡片的白，也不是骨架的 --border（會被看成還在讀取）')

  return r.finish()
}
