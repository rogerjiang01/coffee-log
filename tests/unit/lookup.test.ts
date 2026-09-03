// 查表欄位的即時過濾與模糊比對。
// 用途是即時過濾而不是事後攔截——使用者打「厭氧」就看到既有項目。

import { filterLookup, hasExactMatch, findSimilar, normalize, splitBySource } from '../../utils/lookup.ts'
import { createReport, equal } from '../helpers/report.mjs'

const items = [
  { id: '1', name: '厭氧日曬', aliases: ['Anaerobic Natural'], user_id: null },
  { id: '2', name: '厭氧水洗', aliases: ['Anaerobic Washed'], user_id: null },
  { id: '3', name: '水洗', aliases: ['Washed'], user_id: null },
  { id: '4', name: 'Gesha 藝伎', aliases: ['Geisha', '瑰夏'], user_id: null },
  { id: '5', name: '我的自創法', aliases: [], user_id: 'u1' },
]

export default function run() {
  const r = createReport('查表欄位的比對')

  r.section('即時過濾')
  r.check(equal(filterLookup('厭氧', items).map(i => i.name), ['厭氧日曬', '厭氧水洗']), '打「厭氧」列出兩筆')
  r.check(filterLookup('厭氧發酵', items).length === 2, '打「厭氧發酵」仍看得到那兩筆（退回模糊比對）')
  r.check(filterLookup('washed', items).length === 2, '英文別名可過濾，大小寫無關')
  r.check(filterLookup('', items).length === 5, '空字串顯示全部')

  r.section('是否已有完全相符')
  r.check(hasExactMatch('水洗', items), '名稱完全相符時不顯示新增')
  r.check(hasExactMatch('Washed', items), '別名完全相符也算')
  r.check(!hasExactMatch('厭氧發酵', items), '沒有完全相符時顯示新增')

  r.section('模糊比對的邊界')
  r.check(findSimilar('瑰夏', items)[0]?.name === 'Gesha 藝伎', '別名命中')
  r.check(findSimilar('完全不相干的東西', items).length === 0, '不相干的輸入不亂提示')
  r.check(findSimilar('', items).length === 0, '空輸入不提示')
  r.check(normalize('SL-28') === normalize('sl 28'), '連接符與空白被抹平')
  const honey = items.concat([{ id: '6', name: '黃蜜', aliases: [], user_id: null }])
  r.check(!findSimilar('紅蜜', honey).some(i => i.name === '黃蜜'),
    '「紅蜜」不會誤判成「黃蜜」——只差一字但語意不同')

  r.section('系統與自建分組')
  const grouped = splitBySource(items)
  r.check(grouped.system.length === 4 && grouped.mine.length === 1, '系統項目排前面，自建排後面')

  return r.finish()
}
