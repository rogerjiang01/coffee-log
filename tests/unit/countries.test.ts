// 產國的洲別分組。
//
// 分組本身壞掉很明顯（畫面上看得出來），但**組內順序被前端重排**
// 不明顯——它看起來仍然是一份合理的清單，只是常見的產國不再排在前面，
// 而那正是這次分組要解決的問題。所以下面特別驗「不重排」。

import { groupByContinent, toLookupShape, CONTINENT_ORDER, CONTINENT_LABELS } from '../../utils/countries.ts'
import { filterLookup } from '../../utils/lookup.ts'
import { createReport, equal } from '../helpers/report.mjs'

type Country = Parameters<typeof groupByContinent>[0][number]
const c = (id: string, zh: string, en: string, iso: string, continent: Country['continent']): Country =>
  ({ id, name_zh: zh, name_en: en, iso_code: iso, continent })

// 依 sort_order 查出來的順序（常見度）
const rows: Country[] = [
  c('1', '衣索比亞', 'Ethiopia', 'ET', 'africa'),
  c('2', '肯亞', 'Kenya', 'KE', 'africa'),
  c('3', '葉門', 'Yemen', 'YE', 'africa'),
  c('4', '巴拿馬', 'Panama', 'PA', 'americas'),
  c('5', '哥倫比亞', 'Colombia', 'CO', 'americas'),
  c('6', '臺灣', 'Taiwan', 'TW', 'asia'),
  c('7', '印尼', 'Indonesia', 'ID', 'asia'),
  c('8', '巴布亞紐幾內亞', 'Papua New Guinea', 'PG', 'asia'),
]

export default function run() {
  const r = createReport('產國的洲別分組')

  r.section('分組')
  const groups = groupByContinent(rows)
  r.check(equal(groups.map(g => g.key), ['africa', 'americas', 'asia']), '三洲依固定順序')
  r.check(equal(groups.map(g => g.label), ['非洲', '美洲', '亞洲']), '標題是中文')
  r.check(equal(groups.map(g => g.items.length), [3, 2, 3]), '每一國都被分到組裡，沒有漏掉')

  r.section('組內順序照傳進來的，不重排')
  // sort_order 是依台灣市場常見度排的。前端若照筆畫或字母重排，
  // 常見的產國就不再排前面——分組做了，但要解決的問題沒解決。
  r.check(equal(groups[0]!.items.map(x => x.name_zh), ['衣索比亞', '肯亞', '葉門']),
    '非洲維持衣索比亞 → 肯亞 → 葉門')
  r.check(equal(groups[2]!.items.map(x => x.name_zh), ['臺灣', '印尼', '巴布亞紐幾內亞']),
    '亞洲維持臺灣排第一')

  r.section('葉門放非洲，巴布亞紐幾內亞放亞洲')
  // 葉門地理上屬西亞，但咖啡產區慣例與非洲東岸一起討論（摩卡港）。
  // 巴布亞紐幾內亞屬大洋洲，42 國裡只有它一個，不為單一項目開一組。
  r.check(groups[0]!.items.some(x => x.iso_code === 'YE'), '葉門在非洲組')
  r.check(!groups.find(g => g.key === 'asia')!.items.some(x => x.iso_code === 'YE'), '葉門不在亞洲組')
  r.check(groups[2]!.items.some(x => x.iso_code === 'PG'), '巴布亞紐幾內亞在亞洲組')

  r.section('空的組不出現')
  const onlyAsia = groupByContinent(rows.filter(x => x.continent === 'asia'))
  r.check(onlyAsia.length === 1 && onlyAsia[0]!.key === 'asia',
    '搜尋過濾後某洲一個都不剩時，不留一個空標題')
  r.check(groupByContinent([]).length === 0, '完全沒有結果時回空陣列')

  r.section('搜尋比對名稱、英文名與 ISO 碼')
  const shaped = toLookupShape(rows)
  const find = (q: string) => filterLookup(q, shaped).map(x => x.name)
  r.check(equal(find('衣索'), ['衣索比亞']), '中文名')
  r.check(equal(find('ethiopia'), ['衣索比亞']), '英文名（不分大小寫）')
  r.check(equal(find('PG'), ['巴布亞紐幾內亞']), 'ISO 碼')
  r.check(equal(find('papua new'), ['巴布亞紐幾內亞']), '英文名含空白也找得到')
  r.check(shaped.every(x => x.user_id === null), '產國是純系統表，沒有自建項目')

  r.section('常數')
  r.check(CONTINENT_ORDER.length === 3, '只有三洲')
  r.check(Object.keys(CONTINENT_LABELS).length === 3, '標題與洲別一一對應')

  return r.finish()
}
