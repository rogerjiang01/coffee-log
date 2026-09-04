// 查表欄位的即時過濾與模糊比對。
// 用途是即時過濾而不是事後攔截——使用者打「厭氧」就看到既有項目。

import { filterLookup, hasExactMatch, findSimilar, normalize, splitBySource } from '../../utils/lookup.ts'
import { catalogDisplayName } from '../../utils/equipment.ts'
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

  r.section('器材型錄的顯示與搜尋')
  // 顯示成「Hario · V60 02」——品牌看得見，但不必為它多開一層分組
  const row = (brand: string, model: string, variant: string | null = null) =>
    ({ brand, model, variant } as Parameters<typeof catalogDisplayName>[0])
  r.check(catalogDisplayName(row('Hario', 'V60 02')) === 'Hario · V60 02', '品牌與型號用中點分隔')
  r.check(catalogDisplayName(row('Kalita', 'Wave 155')) === 'Kalita · Wave 155', '型號本身有空格也不受影響')
  r.check(catalogDisplayName(row('楊家', '小飛馬', '600N')) === '楊家 · 小飛馬 600N',
    'variant 接在型號後面，不再加一個中點')

  // 中點是顯示用的分隔符，不該影響搜尋。normalize 已經把它連同空白一起去掉，
  // 所以「hario v60」這種跨越中點的輸入仍然找得到——改格式時最容易壞掉的就是這裡。
  const catalog = [
    { brand: 'Hario', model: 'V60 02', variant: null },
    { brand: 'Kalita', model: 'Wave 155', variant: null },
    { brand: '星芒濾杯', model: '2 代目「極」Kiwami', variant: null },
  ].map((c, i) => ({ id: String(i), name: catalogDisplayName(c as never), aliases: [c.brand, c.model], user_id: null }))

  const find = (q: string) => filterLookup(q, catalog).map(x => x.id)
  r.check(equal(find('hario'), ['0']), '只打品牌找得到')
  r.check(equal(find('v60'), ['0']), '只打型號找得到')
  r.check(equal(find('hario v60'), ['0']), '品牌加型號一起打，跨過中點仍找得到')
  r.check(equal(find('Hario·V60'), ['0']), '自己打中點也找得到')
  r.check(equal(find('wave'), ['1']), '型號的第一個字')
  r.check(equal(find('kiwami'), ['2']), '中文型號裡夾雜的英文找得到')
  r.check(equal(find('星芒'), ['2']), '中文品牌找得到')

  return r.finish()
}
