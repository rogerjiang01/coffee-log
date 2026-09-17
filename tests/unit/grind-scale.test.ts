// 磨豆機刻度的四欄制驗證（《01-資料庫規格》§3.2）。
// **所有結果都是提示，呼叫端不得用它阻擋儲存。**

import {
  grindScaleNotice, grindScaleRangeLabel, grindScaleSuggestionLabel, isFreeformScale,
} from '../../utils/equipment.ts'
import type { GrindScaleSpec } from '../../utils/equipment.ts'
import { createReport } from '../helpers/report.mjs'

const spec = (min: number | null, max: number | null, inc: number | null,
  sMin: number | null = null, sMax: number | null = null, note: string | null = null): GrindScaleSpec =>
  ({ min, max, increment: inc, suggestedMin: sMin, suggestedMax: sMax, note })

// 型錄中的實際條目
const C40 = spec(0, 40, 1, null, null, '一圈 40 格')
const C2 = spec(0, 36, 1, 6, 30)
const EK43 = spec(1, 16, 0.1, null, null, '無段微調，可對齊至 0.1')
const R440 = spec(1, 10, 0.5)
const NICHE = spec(0, null, null, null, null, '無段；超過 50 可繼續旋轉至更粗')
const ODE = spec(1, 11, null)
const N500 = spec(null, null, null, null, null, '轉盤面板無刻度標示')

/** 提示文字，沒有提示時是空字串——斷言寫起來比每次判 null 短 */
const hint = (value: number | null, s: GrindScaleSpec) => grindScaleNotice(value, s)?.text ?? ''
const kind = (value: number | null, s: GrindScaleSpec) => grindScaleNotice(value, s)?.kind ?? null

export default function run() {
  const r = createReport('刻度的四欄制驗證')

  r.section('increment 表達精度')
  r.check(hint(22, C40) === '', 'C40 填 22 沒有提示')
  r.check(hint(22.5, C40) === '不符最小間隔', 'C40 填 22.5 提示不符最小間隔——整數格機型也是同一句')
  r.check(hint(4.5, R440) === '', 'R440 填 4.5 沒有提示')
  r.check(hint(4.3, R440) === '不符最小間隔', 'R440 填 4.3 提示不符最小間隔')

  r.section('EK43 的浮點陷阱')
  r.check(hint(12.3, EK43) === '', '填 12.3 沒有提示（12.3 % 0.1 的浮點誤差已處理）')
  r.check(hint(9.7, EK43) === '', '填 9.7 沒有提示')
  r.check(hint(1.05, EK43) === '不符最小間隔', '填 1.05 提示間隔')
  r.check(hint(20, EK43) === '超出磨豆機刻度範圍', '填 20 提示超出範圍')

  r.section('increment 為 null：不驗倍數，範圍照驗')
  r.check(hint(7.348, ODE) === '', 'Fellow Ode 填 7.348 不驗倍數')
  r.check(hint(15, ODE) === '超出磨豆機刻度範圍', 'Fellow Ode 填 15 仍提示超出範圍')

  r.section('max 為 null：不做上限檢查')
  r.check(hint(80, NICHE) === '', 'Niche Zero 填 80 沒有任何提示')
  r.check(hint(-1, NICHE) === '低於磨豆機刻度範圍', 'Niche Zero 填 -1 仍提示低於下限')
  r.check(grindScaleRangeLabel(NICHE) === '0 以上', 'Niche Zero 的範圍顯示為「0 以上」')

  r.section('三者皆 null：完全自由')
  r.check(isFreeformScale(N500), '小飛馬 500N 判定為完全無刻度')
  r.check(hint(999, N500) === '', '填 999 沒有提示')
  r.check(hint(-50, N500) === '', '填 -50 也沒有提示')
  r.check(grindScaleRangeLabel(N500) === null, '不顯示範圍')

  r.section('實用範圍與空值')
  r.check(grindScaleSuggestionLabel(C2) === '手沖常用 6–30', 'Timemore C2 顯示建議範圍')
  r.check(grindScaleSuggestionLabel(C40) === null, '沒有建議範圍就不顯示')
  r.check(hint(null, EK43) === '', '沒填不提示')
  r.check(hint(Number.NaN, EK43) === '', 'NaN 不提示')

  r.section('undefined 與 null 同義')
  // 缺欄位的查詢結果給的是 undefined 不是 null。`=== null` 會判成
  // 「有這個值」，於是提示變成「這台的最小間隔是 undefined」、
  // 範圍顯示「刻度 undefined–undefined」——不會報錯，只會印在使用者臉上。
  // 真正的來源（equipment:all 被兩種欄位的查詢共用）已經收斂成單一查詢定義，
  // 這裡是第二道防線。
  const MISSING: GrindScaleSpec = {
    min: undefined, max: undefined, increment: undefined,
    suggestedMin: undefined, suggestedMax: undefined, note: undefined,
  }
  r.check(hint(87, MISSING) === '', '欄位是 undefined 時不給任何提示')
  r.check(grindScaleRangeLabel(MISSING) === null, '不顯示「刻度 undefined–undefined」')
  r.check(grindScaleSuggestionLabel(MISSING) === null, '不顯示 undefined 的建議範圍')
  r.check(isFreeformScale(MISSING), '判定為無刻度，整段提示都不出現')
  r.check(hint(87, { ...C40, max: undefined }) === '',
    '只有 max 缺欄位時不做上限檢查，不會拿 undefined 去比大小')

  r.section('提示的文案與分類')
  // 文案不講「這台的刻度到 40 為止」那種定義句：使用者要知道的是
  // 「這個數字有問題」，不是這台機器的規格——規格就寫在同一行的左邊
  r.check(hint(87, C40) === '超出磨豆機刻度範圍', '高於上限：超出磨豆機刻度範圍')
  r.check(hint(-3, C40) === '低於磨豆機刻度範圍', '低於下限：低於磨豆機刻度範圍')
  r.check(kind(87, C40) === 'range', '超出範圍歸類為 range')
  r.check(kind(22.5, C40) === 'increment', '間隔不符歸類為 increment——兩者畫在同一個位置，分類只用來決定優先序')

  r.section('同時超出範圍又不符間隔時只講範圍')
  // R440 是 1–10、半格定位。87.3 兩邊都不符，但要先讓使用者確認有沒有看錯行
  r.check(hint(87.3, R440) === '超出磨豆機刻度範圍', '只回範圍那一則')
  r.check(hint(0.3, R440) === '低於磨豆機刻度範圍', '低於下限時同理')
  r.check(kind(87.3, R440) === 'range', '分類也只有一則')

  r.section('自建器材完全不提示')
  // 型錄沒有這台機器的資料，系統對它一無所知，憑什麼說 87 不對
  const NO_CATALOG: GrindScaleSpec = {
    min: null, max: null, increment: null, suggestedMin: null, suggestedMax: null, note: null,
  }
  r.check(grindScaleNotice(87, NO_CATALOG) === null, '沒有型錄資料時不給範圍提示')

  return r.finish()
}
