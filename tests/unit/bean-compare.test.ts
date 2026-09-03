// 比較表的排序與差異標記。

import * as brewSteps from '../../utils/brewSteps.ts'
import * as roast from '../../utils/roast.ts'
Object.assign(globalThis, {
  brewRatioLabel: brewSteps.brewRatioLabel,
  secondsToClock: brewSteps.secondsToClock,
  restDays: roast.restDays,
})
const { buildCompareRows, compareColumns } = await import('../../utils/beanCompare.ts')
import { createReport, equal } from '../helpers/report.mjs'

type Brew = Parameters<typeof buildCompareRows>[0][number]

const brew = (over: Partial<Brew> & { id: string, brewed_at: string }): Brew => ({
  dose: 15, water_temp: 92, grind_setting: 22, total_time: 150,
  is_favorite: false, totalWater: 225, ...over,
})

export default function run() {
  const r = createReport('豆子比較表')

  r.section('排序')
  const rows = buildCompareRows([
    brew({ id: 'c', brewed_at: '2026-03-15T09:00:00Z' }),
    brew({ id: 'a', brewed_at: '2026-03-12T09:00:00Z' }),
    brew({ id: 'b', brewed_at: '2026-03-14T09:00:00Z' }),
  ], '2026-03-01')
  r.check(equal(rows.map(x => x.id), ['a', 'b', 'c']),
    '由舊到新排序，演變方向由上而下（傳入順序不影響結果）')

  r.section('差異標記')
  const changed = buildCompareRows([
    brew({ id: '1', brewed_at: '2026-03-12T09:00:00Z', grind_setting: 22 }),
    brew({ id: '2', brewed_at: '2026-03-14T09:00:00Z', grind_setting: 20 }),
    brew({ id: '3', brewed_at: '2026-03-15T09:00:00Z', grind_setting: 20, water_temp: 90 }),
  ], '2026-03-01')
  const grindIndex = compareColumns.indexOf('刻度')
  const tempIndex = compareColumns.indexOf('水溫')
  r.check(changed[0]!.cells.every(c => !c.changed), '第一列沒有前一列，一律不標記')
  r.check(changed[1]!.cells[grindIndex]!.changed, '第二列的刻度變了，標記')
  r.check(!changed[1]!.cells[tempIndex]!.changed, '第二列的水溫沒變，不標記')
  r.check(!changed[2]!.cells[grindIndex]!.changed, '第三列的刻度與前一列相同，不標記')
  r.check(changed[2]!.cells[tempIndex]!.changed, '第三列的水溫變了，標記')

  r.section('養豆天數不標記')
  r.check(changed.every(row => !row.cells[0]!.changed),
    '養豆天數本來就每次都不同，標記它只會製造噪音')

  r.section('顯示格式')
  const one = buildCompareRows([brew({ id: '1', brewed_at: '2026-03-12T09:00:00Z' })], '2026-03-01')[0]!
  r.check(one.cells[compareColumns.indexOf('粉水比')]!.value === '1:15.0', '粉水比顯示 1:15.0')
  r.check(one.cells[compareColumns.indexOf('時間')]!.value === '2:30', '總時間顯示分:秒')
  r.check(one.cells[compareColumns.indexOf('粉重')]!.value === '15g', '粉重帶單位')

  r.section('空值')
  const sparse = buildCompareRows([
    brew({ id: '1', brewed_at: '2026-03-12T09:00:00Z', water_temp: null, total_time: null, totalWater: null }),
  ], null)
  r.check(sparse[0]!.cells[0]!.value === '—', '沒有烘焙日期時養豆天數顯示破折號')
  r.check(sparse[0]!.cells[compareColumns.indexOf('水溫')]!.value === '—', '沒填的欄位顯示破折號')
  r.check(sparse[0]!.cells[compareColumns.indexOf('粉水比')]!.value === '—', '沒有分段時粉水比顯示破折號')

  r.section('比對的是顯示字串')
  const equivalent = buildCompareRows([
    brew({ id: '1', brewed_at: '2026-03-12T09:00:00Z', dose: 15 }),
    brew({ id: '2', brewed_at: '2026-03-13T09:00:00Z', dose: 15.0 }),
  ], '2026-03-01')
  r.check(!equivalent[1]!.cells[compareColumns.indexOf('粉重')]!.changed,
    '15 與 15.0 顯示相同，不算改動')

  r.section('收藏與空清單')
  const fav = buildCompareRows([brew({ id: '1', brewed_at: '2026-03-12T09:00:00Z', is_favorite: true })], null)
  r.check(fav[0]!.isFavorite, '收藏狀態帶進列')
  r.check(buildCompareRows([], null).length === 0, '沒有紀錄時回空陣列')

  return r.finish()
}
