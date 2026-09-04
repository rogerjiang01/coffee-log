// 表單自動暫存的純邏輯（《02-功能規格》§6）。
//
// 背景：競品最大的缺陷是填到一半按返回會全部消失。那是使用者只會遇到
// 一次然後再也不回來的錯誤，所以這組測試守的是「不會弄丟使用者填的東西」。

import { packDraft, unpackDraft, pruneMissingIds, collectIds, draftKey, DRAFT_TTL_MS }
  from '../../utils/draft.ts'
import { createReport, equal } from '../helpers/report.mjs'

export default function run() {
  const r = createReport('表單自動暫存')
  const NOW = 1_700_000_000_000

  r.section('key 格式')
  r.check(draftKey('brew', null) === 'draft:brew:new', '新增沖煮紀錄')
  r.check(draftKey('brew', 'abc') === 'draft:brew:abc', '編輯沖煮紀錄')
  r.check(draftKey('bean', null) === 'draft:bean:new', '新增豆子')

  r.section('存取與還原')
  const data = { name: '耶加雪菲', dose: 15, tags: ['a', 'b'] }
  const packed = packDraft(data, NOW)
  r.check(equal(unpackDraft(packed, NOW), data), '存進去什麼就讀回什麼')
  r.check(equal(unpackDraft(packed, NOW + 1000), data), '一秒後仍然有效')

  r.section('七天失效')
  r.check(unpackDraft(packed, NOW + DRAFT_TTL_MS - 1) !== null, '第七天之內仍然有效')
  r.check(unpackDraft(packed, NOW + DRAFT_TTL_MS + 1) === null, '超過七天回 null')

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

  return r.finish()
}
