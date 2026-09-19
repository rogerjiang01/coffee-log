// 表單自動暫存的純邏輯（《02-功能規格》§6）。
//
// 背景：競品最大的缺陷是填到一半按返回會全部消失。那是使用者只會遇到
// 一次然後再也不回來的錯誤，所以這組測試守的是「不會弄丟使用者填的東西」。

import {
  packDraft, unpackDraft, unpackDraftEnvelope, pruneMissingIds, collectIds, draftKey,
  newBrewDraftKey, sweepExpiredDrafts, clearAllDrafts,
  draftAge, droppedFieldsMessage, DRAFT_TTL_MS, DRAFT_AUTO_RESTORE_MS,
} from '../../utils/draft.ts'
import { createReport, equal } from '../helpers/report.mjs'

export default function run() {
  const r = createReport('表單自動暫存')
  const NOW = 1_700_000_000_000

  r.section('key 格式')
  r.check(draftKey('brew', null) === 'draft:brew:new', '新增沖煮紀錄')
  r.check(draftKey('brew', 'abc') === 'draft:brew:abc', '編輯沖煮紀錄')
  r.check(draftKey('bean', null) === 'draft:bean:new', '新增豆子')
  r.check(draftKey('bean', 'xyz') === 'draft:bean:xyz', '編輯豆子')

  r.section('新增沖煮紀錄：三種進入方式的 key 互不干擾')
  // 原本三者共用 draft:brew:new，複製 A 的暫存會被還原進複製 B 的表單
  const blank = newBrewDraftKey({})
  const copyA = newBrewDraftKey({ copy: 'A' })
  const copyB = newBrewDraftKey({ copy: 'B' })
  const beanX = newBrewDraftKey({ bean: 'X' })
  const beanY = newBrewDraftKey({ bean: 'Y' })
  r.check(blank === 'draft:brew:new', '空白新增：draft:brew:new（沿用，舊暫存只會被這裡讀到）')
  r.check(copyA === 'draft:brew:copy:A', '複製：draft:brew:copy:{來源 id}')
  r.check(beanX === 'draft:brew:bean:X', '指定豆子：draft:brew:bean:{豆子 id}')
  r.check(new Set([blank, copyA, copyB, beanX, beanY]).size === 5, '空白、複製 A、複製 B、豆子 X、豆子 Y 五個 key 都不同')
  r.check(newBrewDraftKey({ copy: 'A', bean: 'X' }) === copyA, '同時帶 copy 與 bean 時以 copy 為準（與頁面一致）')
  r.check(newBrewDraftKey({ copy: null, bean: null }) === blank, 'query 為 null 等同空白新增')
  r.check(![copyA, beanX].includes(draftKey('brew', 'A')) && ![copyA, beanX].includes(draftKey('brew', 'X')),
    '不會撞到編輯紀錄的 key（draft:brew:{id}）')

  r.section('過期的複製／指定豆子暫存主動清掉')
  const store = new Map<string, string>([
    ['draft:brew:copy:old', packDraft({ dose: 15 }, NOW - DRAFT_TTL_MS - 1)],
    ['draft:brew:copy:fresh', packDraft({ dose: 16 }, NOW - 1000)],
    ['draft:brew:bean:old', packDraft({ dose: 17 }, NOW - DRAFT_TTL_MS - 1)],
    ['draft:brew:bean:broken', '壞掉的'],
    ['draft:brew:new', packDraft({ dose: 18 }, NOW - DRAFT_TTL_MS - 1)],
    ['draft:bean:new', packDraft({ name: '豆' }, NOW - DRAFT_TTL_MS - 1)],
    ['other', 'x'],
  ])
  const storage = {
    get length() { return store.size },
    key: (i: number) => [...store.keys()][i] ?? null,
    getItem: (k: string) => store.get(k) ?? null,
    removeItem: (k: string) => { store.delete(k) },
  }
  const swept = sweepExpiredDrafts(storage, NOW)
  r.check(equal(swept.sort(), ['draft:brew:bean:broken', 'draft:brew:bean:old', 'draft:brew:copy:old']),
    `過期與壞掉的都清掉（實際 ${swept.join('、')}）`)
  r.check(store.has('draft:brew:copy:fresh'), '7 天內的保留')
  r.check(store.has('draft:bean:new') && store.has('draft:brew:new') && store.has('other'),
    '其他 key 不碰：豆子表單的照片在 IndexedDB，要走自己的清除流程')

  r.section('登出清掉所有暫存')
  {
    // 每一種 key 格式都放一份，新鮮的、過期的、壞掉的都有：登出不看時效
    const drafts = [
      draftKey('brew', null), draftKey('brew', 'abc'), draftKey('bean', null), draftKey('bean', 'abc'),
      newBrewDraftKey({ copy: 'abc' }), newBrewDraftKey({ bean: 'abc' }),
      'draft:bean:inline', 'draft:equipment:new', 'draft:equipment:abc',
    ]
    const store = new Map<string, string>(drafts.map(key => [key, packDraft({ dose: 15 }, NOW)]))
    store.set('draft:brew:copy:old', packDraft({ dose: 15 }, NOW - DRAFT_TTL_MS - 1))
    store.set('draft:bean:broken', '壞掉的')
    store.set('brew-advanced-open', 'true')
    const storage = {
      get length() { return store.size },
      key: (i: number) => [...store.keys()][i] ?? null,
      removeItem: (k: string) => { store.delete(k) },
    }
    const cleared = clearAllDrafts(storage)
    const left = [...store.keys()].filter(key => key.startsWith('draft:'))
    r.check(left.length === 0, `登出後沒有任何 draft: 開頭的 key（剩下 ${left.join('、') || '無'}）`)
    r.check(cleared.length === drafts.length + 2, '新鮮的、過期的、壞掉的一起清，不看 7 天時效')
    r.check(store.get('brew-advanced-open') === 'true', '收合區展開狀態這類介面偏好不碰')
  }

  r.section('存取與還原')
  const data = { name: '耶加雪菲', dose: 15, tags: ['a', 'b'] }
  const packed = packDraft(data, NOW)
  r.check(equal(unpackDraft(packed, NOW), data), '存進去什麼就讀回什麼')
  r.check(equal(unpackDraft(packed, NOW + 1000), data), '一秒後仍然有效')

  r.section('七天失效')
  r.check(unpackDraft(packed, NOW + DRAFT_TTL_MS - 1) !== null, '第七天之內仍然有效')
  r.check(unpackDraft(packed, NOW + DRAFT_TTL_MS + 1) === null, '超過七天回 null')

  r.section('依離開多久決定還原方式')
  r.check(draftAge(NOW, NOW) === 'recent', '剛存完就回來，直接填入')
  r.check(draftAge(NOW, NOW + 60_000) === 'recent', '一分鐘後，直接填入')
  r.check(draftAge(NOW, NOW + DRAFT_AUTO_RESTORE_MS - 1) === 'recent', '29 分 59 秒仍算剛離開')
  r.check(draftAge(NOW, NOW + DRAFT_AUTO_RESTORE_MS) === 'recent', '剛好 30 分鐘仍算剛離開')
  r.check(draftAge(NOW, NOW + DRAFT_AUTO_RESTORE_MS + 1) === 'stale', '超過 30 分鐘改成開口問')
  r.check(draftAge(NOW, NOW + 6 * 24 * 3600_000) === 'stale', '六天後仍在有效期內，但要問')
  r.check(DRAFT_AUTO_RESTORE_MS < DRAFT_TTL_MS, '自動填入的分界必然小於失效期限')

  r.section('信封同時帶回時間戳')
  const envelope = unpackDraftEnvelope<typeof data>(packed, NOW)
  r.check(envelope?.savedAt === NOW, '讀得到 savedAt，才能判斷離開多久')
  r.check(equal(envelope?.data, data), '內容一併帶回')
  r.check(unpackDraftEnvelope('壞掉的', NOW) === null, '壞掉的暫存回 null')

  r.section('壞掉的暫存不能讓表單開不起來')
  r.check(unpackDraft(null, NOW) === null, '沒有暫存')
  r.check(unpackDraft('', NOW) === null, '空字串')
  r.check(unpackDraft('not json at all', NOW) === null, '不是 JSON')
  r.check(unpackDraft('{"foo":1}', NOW) === null, '缺 savedAt 與 data')
  r.check(unpackDraft('{"savedAt":"昨天","data":{}}', NOW) === null, 'savedAt 不是數字')
  r.check(unpackDraft('null', NOW) === null, 'JSON 是 null')
  r.check(unpackDraft('[1,2,3]', NOW) === null, 'JSON 是陣列')
  r.check(unpackDraft(packDraft(null, NOW), NOW) === null, '存進去的 data 就是 null')

  r.section('指向已刪除資料的 id')
  const alive = new Set(['bean-1', 'grinder-1', 'tag-1'])
  const exists = (id: string) => alive.has(id)
  const draft = {
    bean_id: 'bean-1',
    grinder_id: 'grinder-gone',
    dripper_id: null,
    dose: 15,
    flavorTagIds: ['tag-1', 'tag-gone'],
  }
  const pruned = pruneMissingIds(draft, ['bean_id', 'grinder_id', 'dripper_id', 'flavorTagIds'], exists)
  r.check(pruned.data.bean_id === 'bean-1', '還在的 id 保留')
  r.check(pruned.data.grinder_id === null, '已刪除的 id 設為 null，不會撞外鍵')
  r.check(equal(pruned.data.flavorTagIds, ['tag-1']), '陣列欄位逐項過濾')
  r.check(pruned.data.dose === 15, '不在清單裡的欄位原樣保留')
  r.check(equal(pruned.dropped.sort(), ['flavorTagIds', 'grinder_id']), '回報哪些欄位被清掉，介面才能告知使用者')
  r.check(draft.grinder_id === 'grinder-gone', '不修改原物件')

  r.section('沒有東西被刪掉時')
  const intact = pruneMissingIds(
    { bean_id: 'bean-1', flavorTagIds: ['tag-1'] },
    ['bean_id', 'flavorTagIds'], exists)
  r.check(intact.dropped.length === 0, '不回報任何欄位，介面不顯示提示')

  r.section('收集要驗證的 id')
  r.check(equal(collectIds(draft, ['bean_id', 'grinder_id', 'dripper_id', 'flavorTagIds']).sort(),
    ['bean-1', 'grinder-gone', 'tag-1', 'tag-gone']), '字串與陣列欄位都收，null 略過')
  r.check(collectIds({ a: null, b: [] }, ['a', 'b']).length === 0, '全空時回空陣列')
  r.check(equal(collectIds({ a: 'x', b: ['x'] }, ['a', 'b']), ['x']), '重複的 id 只留一個')

  r.section('被清空的欄位要講出是哪幾格')
  // 只說「有幾個選項被刪掉了」等於沒說：使用者不知道要重填哪一格，
  // 而 bean_id 是必填，按下儲存會再撞一次驗證。
  r.check(droppedFieldsMessage(['bean_id']) === '豆子已被刪除，請重新選擇', '單一欄位')
  r.check(droppedFieldsMessage(['bean_id', 'processing_method_id'])
    === '豆子、處理法已被刪除，請重新選擇', '多個欄位用頓號串起來')
  r.check(droppedFieldsMessage(['grinder_id', 'dripper_id', 'kettle_id'])
    === '磨豆機、濾杯、手沖壺已被刪除，請重新選擇', '器材三件')
  r.check(droppedFieldsMessage(['flavorTagIds']) === '風味標籤已被刪除，請重新選擇',
    '陣列型欄位也有標籤')
  r.check(droppedFieldsMessage([]) === '', '沒有東西被刪就不出訊息')
  r.check(droppedFieldsMessage(['unknown_field']) === '',
    '對不上標籤的欄位跳過——寧可少講一項，也不要把資料庫欄位名吐到畫面上')
  r.check(droppedFieldsMessage(['bean_id', 'unknown_field']) === '豆子已被刪除，請重新選擇',
    '混著也只講認得的那些')

  return r.finish()
}
