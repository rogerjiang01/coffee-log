// 結算頁的回饋句（《02》§5「結算頁」、《03》§5.5 的例外）。
//
// **出現條件：有比較對象，而且兩筆都有評分。** 否則不出現——第一杯的情況比較區已經處理了。
//
// 判斷：
//   有改參數                比較結果至少有一項不同（評分那一列不是參數，不算）
//   評分變高／變低／不變    比兩筆的評分
//   一次改了三個以上的參數  不同的項目三項以上、沖煮手法與器材都沒改、評分變低或不變。
//                           符合時優先，取代一般「有改參數」那兩組
// 同一種情況有多句時隨機選一句。文案照規格抄，不改字。

import type { BrewDiff } from './brewDiff.ts'

export type FeedbackCase =
  | 'changed-up' | 'changed-down' | 'changed-same' | 'too-many'
  | 'same-same-high' | 'same-same-low' | 'same-up' | 'same-down'

export const FEEDBACK_LINES: Record<FeedbackCase, readonly string[]> = {
  'changed-up': ['{參數}這一步改得好。', '漂亮，方向對了。', '調整有效，下次從這杯出發。'],
  'changed-down': ['勇於嘗試，繼續試試看。', '好心情也是一種沖煮參數。', '每次調整都在縮小範圍。'],
  'changed-same': ['沒關係，下次換個參數試試。'],
  'too-many': ['一次改一個參數，方便找出變因。'],
  'same-same-high': ['很好，手法很穩定。'],
  'same-same-low': ['也許可以嘗試調整參數。'],
  'same-up': ['不錯喔，手法進步了。', '可能是豆子養得更熟了。'],
  'same-down': ['今天的豆子比較任性。'],
}

/** 器材與手法：改了這些就不算「一次改太多個小參數」 */
const SETUP_FIELDS = new Set(['grinder_id', 'dripper_id', 'kettle_id', 'brew_method_id'])

export function feedbackCase(
  diffs: readonly BrewDiff[],
  ratingBefore: number | null | undefined,
  ratingAfter: number | null | undefined,
  hasTarget: boolean,
): FeedbackCase | null {
  if (!hasTarget || ratingBefore == null || ratingAfter == null) return null
  const params = diffs.filter(diff => diff.field !== 'rating')
  const trend = ratingAfter > ratingBefore ? 'up' : ratingAfter < ratingBefore ? 'down' : 'same'

  if (params.length) {
    const setupChanged = params.some(diff => SETUP_FIELDS.has(diff.field))
    if (params.length >= 3 && !setupChanged && trend !== 'up') return 'too-many'
    return trend === 'up' ? 'changed-up' : trend === 'down' ? 'changed-down' : 'changed-same'
  }
  if (trend === 'same') return ratingAfter >= 4 ? 'same-same-high' : 'same-same-low'
  return trend === 'up' ? 'same-up' : 'same-down'
}

/** {參數}：一項寫名稱；兩項寫「A和B」（中文之間不加空格，例如「粉重和水溫」）；三項以上寫「這幾個參數」 */
export function paramsPhrase(diffs: readonly BrewDiff[]): string {
  const labels = diffs.filter(diff => diff.field !== 'rating').map(diff => diff.label)
  if (labels.length === 1) return labels[0]!
  if (labels.length === 2) return `${labels[0]}和${labels[1]}`
  return '這幾個參數'
}

/** random 回傳 [0, 1)，測試時注入 */
export function feedbackLine(
  diffs: readonly BrewDiff[],
  ratingBefore: number | null | undefined,
  ratingAfter: number | null | undefined,
  hasTarget: boolean,
  random: () => number = Math.random,
): string | null {
  const which = feedbackCase(diffs, ratingBefore, ratingAfter, hasTarget)
  if (!which) return null
  const lines = FEEDBACK_LINES[which]
  const line = lines[Math.min(lines.length - 1, Math.floor(random() * lines.length))]!
  return line.replace('{參數}', paramsPhrase(diffs))
}
