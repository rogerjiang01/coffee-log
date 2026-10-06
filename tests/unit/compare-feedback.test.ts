// 比較對象與回饋句（utils/compareTarget.ts、utils/feedback.ts，《02》§5.2、§7）。

import { compareTargetId, monthDay } from '../../utils/compareTarget.ts'
import { FEEDBACK_LINES, feedbackCase, feedbackLine, paramsPhrase } from '../../utils/feedback.ts'
import { createReport } from '../helpers/report.mjs'

const brew = (id: string, brewed_at: string, over: Record<string, unknown> = {}) =>
  ({ id, bean_id: 'b1', brewed_at, copied_from_brew_id: null as string | null, ...over })
const diff = (field: string, label = field) => ({ field, label, before: '1', after: '2' })

export default function run() {
  const r = createReport('比較對象與回饋句')

  r.section('比較對象')
  const r1 = brew('r1', '2026-10-01T01:00:00Z')
  const r2 = brew('r2', '2026-10-02T01:00:00Z')
  const r3 = brew('r3', '2026-10-03T01:00:00Z')
  const other = brew('x9', '2026-10-02T12:00:00Z', { bean_id: 'b2' })
  const all = [r1, r2, r3, other]
  r.check(compareTargetId({ ...r3, copied_from_brew_id: 'r1' }, all) === 'r1', '複製來的：比複製來源（即使中間還有別筆）')
  r.check(compareTargetId({ ...r3, copied_from_brew_id: 'x9' }, all) === 'x9', '複製來源是別支豆子的：仍比複製來源')
  r.check(compareTargetId(r3, all) === 'r2', '不是複製來的：同一支豆子在它之前的最近一筆（別支豆子不算）')
  r.check(compareTargetId(r2, all) === 'r1', '依沖煮日期，不依建立順序')
  r.check(compareTargetId(r1, all) === null, '這支豆子的第一杯：沒有比較對象')
  r.check(compareTargetId(brew('r0', '2026-09-30T00:00:00Z'), all) === null, '補記一筆更早的：它之前沒有，就是沒有')
  r.check(compareTargetId(brew('r5', '2026-10-02T12:00:00Z'), all) === 'r2', '補記在中間的：比它之前的那一筆，不是最新那筆')
  const tieA = brew('a', '2026-10-05T01:00:00Z')
  const tieB = brew('b', '2026-10-05T01:00:00Z')
  r.check(compareTargetId(tieB, [tieA, tieB]) === 'a' && compareTargetId(tieA, [tieA, tieB]) === null,
    '同時間的兩筆：依 id 排，與列表的排序一致')
  r.check(compareTargetId({ ...r3, bean_id: null }, all) === null, '沒有豆子：沒有比較對象')
  r.check(monthDay('2026-10-05T04:00:00Z') === `${new Date('2026-10-05T04:00:00Z').getMonth() + 1}/${new Date('2026-10-05T04:00:00Z').getDate()}`
    && !/\/0/.test(monthDay('2026-03-05T04:00:00Z')), 'M/D：本地時間、不補零')

  r.section('回饋句：出現條件')
  r.check(feedbackCase([], 3, 4, false) === null, '沒有比較對象：不出現')
  r.check(feedbackCase([], null, 4, true) === null && feedbackCase([], 4, null, true) === null, '任一筆沒有評分：不出現')

  r.section('回饋句：情況判斷')
  r.check(feedbackCase([diff('dose')], 3, 4, true) === 'changed-up', '有改參數、評分變高')
  r.check(feedbackCase([diff('dose')], 4, 3, true) === 'changed-down', '有改參數、評分變低')
  r.check(feedbackCase([diff('dose')], 4, 4, true) === 'changed-same', '有改參數、評分不變')
  const three = [diff('dose'), diff('water_temp'), diff('grind_setting')]
  r.check(feedbackCase(three, 4, 3, true) === 'too-many' && feedbackCase(three, 4, 4, true) === 'too-many',
    '三項以上、沒換器材與手法、評分變低或不變：一次改一個參數')
  r.check(feedbackCase(three, 3, 4, true) === 'changed-up', '三項以上但評分變高：一般的「改得好」')
  r.check(feedbackCase([...three, diff('grinder_id')], 4, 3, true) === 'changed-down', '換了磨豆機：不算「一次改太多」')
  r.check(feedbackCase([diff('dose'), diff('water_temp'), diff('brew_method_id')], 4, 4, true) === 'changed-same', '換了手法：不算')
  r.check(feedbackCase([diff('dose'), diff('water_temp')], 4, 3, true) === 'changed-down', '兩項：不算')
  r.check(feedbackCase([diff('rating', '評分')], 4, 4, true) === 'same-same-high', '評分那一列不算參數')
  r.check(feedbackCase([], 4, 4, true) === 'same-same-high' && feedbackCase([], 5, 5, true) === 'same-same-high', '參數相同、評分相同、4–5 星')
  r.check(feedbackCase([], 3, 3, true) === 'same-same-low' && feedbackCase([], 1, 1, true) === 'same-same-low', '參數相同、評分相同、1–3 星')
  r.check(feedbackCase([], 3, 5, true) === 'same-up', '參數相同、評分變高')
  r.check(feedbackCase([], 5, 2, true) === 'same-down', '參數相同、評分變低')

  r.section('回饋句：{參數} 的寫法')
  r.check(paramsPhrase([diff('grind_setting', '研磨刻度')]) === '研磨刻度', '一項：那一項的名稱')
  r.check(paramsPhrase([diff('dose', '粉重'), diff('water_temp', '水溫')]) === '粉重和水溫', '兩項：A和B')
  r.check(paramsPhrase([diff('dose', '粉重'), diff('water_temp', '水溫'), diff('total_time', '沖煮時間')]) === '這幾個參數', '三項以上：這幾個參數')
  r.check(paramsPhrase([diff('dose', '粉重'), diff('rating', '評分')]) === '粉重', '評分那一列不算')
  r.check(feedbackLine([diff('grind_setting', '研磨刻度')], 3, 4, true, () => 0) === '研磨刻度這一步改得好。', '代進第一句')

  r.section('回饋句：隨機選一句，文案照規格')
  const picks = new Set([0, 0.4, 0.99].map(x => feedbackLine([diff('dose', '粉重')], 3, 4, true, () => x)))
  r.check(picks.size === 3, `同一種情況有多句時隨機選：${[...picks].join('／')}`)
  r.check(feedbackLine([], 4, 4, true, () => 0.999) === '很好，手法很穩定。', '只有一句的情況永遠是那一句')
  const expected = {
    'changed-up': ['{參數}這一步改得好。', '漂亮，方向對了。', '調整有效，下次從這杯出發。'],
    'changed-down': ['勇於嘗試，繼續試試看。', '好心情也是一種沖煮參數。', '每次調整都在縮小範圍。'],
    'changed-same': ['沒關係，下次換個參數試試。'],
    'too-many': ['一次改一個參數，方便找出變因。'],
    'same-same-high': ['很好，手法很穩定。'],
    'same-same-low': ['也許可以嘗試調整參數。'],
    'same-up': ['不錯喔，手法進步了。', '可能是豆子養得更熟了。'],
    'same-down': ['今天的豆子比較任性。'],
  }
  r.check(JSON.stringify(FEEDBACK_LINES) === JSON.stringify(expected), '十五句與規格逐字相同')

  return r.finish()
}
