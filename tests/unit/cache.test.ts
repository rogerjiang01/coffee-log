// 客戶端快取的 key 規則與失效對應。
//
// **這組測試的價值全在失效那一半。** 漏掉一條的症狀是：存完東西回上一頁，
// 畫面少一筆或多一筆，重新整理又正常了——沒有錯誤訊息、沒有 console，
// 而且因為要「先看過 A 頁再存 B 再回 A」才會發生，回報者通常重現不出來。
//
// 所以下面每一條都對照《快取失效對應關係》逐項驗，而不是驗「有清東西」。

import {
  cacheKeys, invalidationsFor, matchesPattern,
  checkCacheShape, describeShape, __resetCacheShapes,
} from '../../utils/cacheKeys.ts'
import { createReport, equal } from '../helpers/report.mjs'

/** 某個 key 會不會被這次寫入清掉 */
function cleared(key: string, mutation: Parameters<typeof invalidationsFor>[0]) {
  return invalidationsFor(mutation).some(pattern => matchesPattern(key, pattern))
}

export default function run() {
  const r = createReport('客戶端快取')

  const BEAN = 'bean-1'
  const OTHER_BEAN = 'bean-2'
  const BREW = 'brew-1'
  const SOURCE = 'brew-0'

  r.section('key 的形狀')
  r.check(cacheKeys.bean(BEAN) === 'beans:item:bean-1', '個別豆子')
  r.check(cacheKeys.beanList() === 'beans:list', '豆子列表')
  r.check(cacheKeys.beanActive() === 'beans:active', '首頁的沖煮中豆子')
  r.check(cacheKeys.brewPage(20) === 'brews:page:20', '時間軸分頁帶 range 起點')
  r.check(cacheKeys.brewsByBean(BEAN) === 'brews:bean:bean-1', '某支豆子的全部紀錄')
  r.check(cacheKeys.lookup('varieties') === 'lookup:varieties', '查表')
  r.check(cacheKeys.beanList() !== cacheKeys.beanActive(),
    '列表與首頁上區是兩個 key——查詢條件不同（後者只取未喝完）')

  r.section('前綴比對')
  r.check(matchesPattern('brews:item:x', 'brews:*'), '星號結尾是前綴')
  r.check(!matchesPattern('beans:item:x', 'brews:*'), '前綴不同就不中')
  r.check(matchesPattern('beans:list', 'beans:list'), '沒有星號要完全相同')
  r.check(!matchesPattern('beans:list:x', 'beans:list'), '沒有星號時不做前綴比對')

  // ── 沖煮紀錄 ────────────────────────────────────────────
  r.section('新增／編輯／刪除沖煮紀錄')
  const brew = { kind: 'brew' } as const
  r.check(cleared(cacheKeys.brewPage(0), brew), '首頁時間軸第一頁')
  r.check(cleared(cacheKeys.brewPage(20), brew), '時間軸的其他頁也要清，不然接下來會接到舊資料')
  r.check(cleared(cacheKeys.brewsByBean(BEAN), brew), '該豆子的紀錄列表')
  r.check(cleared(cacheKeys.brewsByBean(OTHER_BEAN), brew),
    '別支豆子的也清——編輯時可能把紀錄改掛到另一支豆子上')
  r.check(cleared(cacheKeys.brewCounts(), brew), '豆子卡片的沖煮次數與收藏次數')
  r.check(cleared(cacheKeys.brew(BREW), brew), '該筆紀錄本身')
  r.check(cleared(cacheKeys.brewSteps(BREW), brew), '該筆紀錄的分段')
  r.check(cleared(cacheKeys.brewTags(BREW), brew), '該筆紀錄的風味標籤')
  r.check(cleared(cacheKeys.brew(SOURCE), brew),
    '來源紀錄也清——差異是拿本筆與來源比出來的，來源被編輯過就會算錯')
  r.check(cleared(cacheKeys.brewSteps(SOURCE), brew), '來源的分段同理（差異含分段結構）')
  r.check(!cleared(cacheKeys.beanList(), brew), '不動豆子列表——紀錄不影響豆子本身的欄位')
  r.check(!cleared(cacheKeys.equipment('grinder'), brew), '不動器材')

  // ── 豆子 ────────────────────────────────────────────────
  r.section('新增／編輯豆子')
  const bean = { kind: 'bean' } as const
  r.check(cleared(cacheKeys.beanList(), bean), '豆子列表')
  r.check(cleared(cacheKeys.beanActive(), bean), '首頁的沖煮中豆子區')
  r.check(cleared(cacheKeys.bean(BEAN), bean), '該豆子詳情')
  r.check(cleared(cacheKeys.beanOptions(), bean), '沖煮表單的豆子選單')
  // 豆子的欄位被內嵌在沖煮查詢裡：時間軸帶 beans(name)，
  // 紀錄詳情帶 beans(id, name, roast_date)，養豆天數是拿 roast_date 算的。
  r.check(cleared(cacheKeys.brewPage(0), bean),
    '時間軸也要清——它顯示的豆名是內嵌查來的，改豆名不清會留著舊名字')
  r.check(cleared(cacheKeys.brew(BREW), bean),
    '紀錄詳情也要清——養豆天數是拿豆子的 roast_date 算的')

  r.section('刪除豆子會連帶刪掉它的紀錄')
  // 外鍵是 cascade，確認對話框上就寫著「連同這支豆子的 N 筆紀錄一起刪掉」。
  r.check(cleared(cacheKeys.brewPage(0), bean), '時間軸不能留著已經不存在的紀錄')
  r.check(cleared(cacheKeys.brewCounts(), bean), '次數統計')
  r.check(cleared(cacheKeys.brewsByBean(BEAN), bean), '該豆子的紀錄列表')

  r.section('標記已喝完')
  const finished = { kind: 'bean-finished' } as const
  r.check(cleared(cacheKeys.beanList(), finished), '豆子列表的分組（未喝完在前）')
  r.check(cleared(cacheKeys.beanActive(), finished), '首頁的沖煮中豆子區要把它移掉')
  r.check(cleared(cacheKeys.bean(BEAN), finished), '詳情頁自己的開關狀態')
  r.check(cleared(cacheKeys.beanOptions(), finished), '豆子選單的分組（已喝完排後面）')
  r.check(!cleared(cacheKeys.brewPage(0), finished),
    '不動時間軸——is_finished 沒有被內嵌到任何沖煮查詢裡')

  r.section('新增／刪除器材')
  const equip = { kind: 'equipment' } as const
  r.check(cleared(cacheKeys.equipmentAll(), equip), '器材列表')
  r.check(cleared(cacheKeys.equipment('grinder'), equip), '表單的磨豆機選單')
  r.check(cleared(cacheKeys.equipment('dripper'), equip), '濾杯選單也清——預設器材可能改到別的類型')
  r.check(!cleared(cacheKeys.brewPage(0), equip), '不動時間軸')

  r.section('自建查表項目')
  const variety = { kind: 'lookup', table: 'varieties' } as const
  r.check(cleared(cacheKeys.lookup('varieties'), variety), '對應的查表選單')
  r.check(!cleared(cacheKeys.lookup('processing_methods'), variety),
    '只清那一張表——新增品種不影響處理法的選單')
  r.check(!cleared(cacheKeys.beanList(), variety), '不動豆子列表')

  r.section('照片的簽名網址永遠不進快取')
  // 簽名網址有時效，快取起來過期之後圖會裂掉。
  // 這裡驗的是「沒有幫它留 key」——沒有 key 就不可能被存進去。
  r.check(!Object.keys(cacheKeys).some(name => /photo|signed|url/i.test(name)),
    'cacheKeys 裡沒有任何照片網址的 key')

  r.section('同一個 key 的欄位集合必須一致')
  // 這件事實際發生過：BeanForm 用 'countries' 只查 id 與 name_zh，
  // CountrySelect 需要 continent。誰先跑誰決定，後到的拿到缺欄位的資料，
  // 洲別分組全部落空而畫面只顯示「找不到相符的」——沒有例外、沒有 console。
  __resetCacheShapes()
  const narrow = [{ id: '1', name_zh: '衣索比亞' }]
  const wide = [{ id: '1', name_zh: '衣索比亞', continent: 'africa', name_en: 'Ethiopia' }]

  r.check(checkCacheShape('countries', narrow) === null, '第一次只記錄，不警告')
  const warning = checkCacheShape('countries', wide)
  r.check(warning !== null, '第二次換了欄位就警告')
  r.check(!!warning && warning.includes('countries'), '警告帶出是哪一個 key')
  r.check(!!warning && warning.includes('continent'), '警告帶出這次的欄位，看得出差在哪')
  r.check(!!warning && warning.includes('不會有錯誤'),
    '警告說明為什麼要在意——它的症狀本來就不像錯誤')

  // 基準是第一次記下的那份，不會被後來的覆蓋——所以出錯的那個呼叫端
  // 每次都會警告，而不是只在第一次出現、之後就靜了
  r.check(checkCacheShape('countries', wide) !== null, '不相符的查詢每次都警告，不是只警告一次')
  r.check(checkCacheShape('countries', narrow) === null, '與基準相符的那一邊不警告')
  r.check(checkCacheShape('beans:list', wide) === null, '不同 key 各自獨立')

  r.section('欄位順序不影響判斷')
  __resetCacheShapes()
  checkCacheShape('k', [{ a: 1, b: 2 }])
  r.check(checkCacheShape('k', [{ b: 2, a: 1 }]) === null,
    'select 的欄位順序不同不算變更——會壞掉的是缺欄位，不是順序')

  r.section('無從判斷時不亂警告')
  __resetCacheShapes()
  r.check(describeShape([]) === null, '空陣列取不到代表列')
  r.check(describeShape(null) === null, 'null')
  r.check(describeShape('字串') === null, '非物件')
  r.check(checkCacheShape('k', []) === null, '空結果不記錄也不警告')
  r.check(checkCacheShape('k', wide) === null, '空結果之後的第一筆才開始記錄')

  r.section('單一物件也適用')
  __resetCacheShapes()
  checkCacheShape('beans:item:x', { id: '1', name: 'a', region: 'b' })
  r.check(checkCacheShape('beans:item:x', { id: '1', name: 'a' }) !== null,
    'maybeSingle 回傳的單一物件同樣比對得到')

  return r.finish()
}
