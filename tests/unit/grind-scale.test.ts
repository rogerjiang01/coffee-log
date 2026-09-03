// 磨豆機刻度的四欄制驗證（《01-資料庫規格》§3.2）。
// **所有結果都是提示，呼叫端不得用它阻擋儲存。**

import {
  grindScaleHints, grindScaleRangeLabel, grindScaleSuggestionLabel, isFreeformScale,
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

export default function run() {
  const r = createReport('刻度的四欄制驗證')

  r.section('increment 表達精度')
  r.check(grindScaleHints(22, C40).length === 0, 'C40 填 22 沒有提示')
  r.check(grindScaleHints(22.5, C40).some(h => h.includes('整數')), 'C40 填 22.5 提示只能停在整數格')
  r.check(grindScaleHints(4.5, R440).length === 0, 'R440 填 4.5 沒有提示')
  r.check(grindScaleHints(4.3, R440).some(h => h.includes('0.5')), 'R440 填 4.3 提示最小間隔')

  r.section('EK43 的浮點陷阱')
  r.check(grindScaleHints(12.3, EK43).length === 0, '填 12.3 沒有提示（12.3 % 0.1 的浮點誤差已處理）')
  r.check(grindScaleHints(9.7, EK43).length === 0, '填 9.7 沒有提示')
  r.check(grindScaleHints(1.05, EK43).some(h => h.includes('0.1')), '填 1.05 提示間隔')
  r.check(grindScaleHints(20, EK43).some(h => h.includes('16')), '填 20 提示超出上限')

  r.section('increment 為 null：不驗倍數，範圍照驗')
  r.check(grindScaleHints(7.348, ODE).length === 0, 'Fellow Ode 填 7.348 不驗倍數')
  r.check(grindScaleHints(15, ODE).some(h => h.includes('11')), 'Fellow Ode 填 15 仍提示超出上限')

  r.section('max 為 null：不做上限檢查')
  r.check(grindScaleHints(80, NICHE).length === 0, 'Niche Zero 填 80 沒有任何提示')
  r.check(grindScaleHints(-1, NICHE).some(h => h.includes('0')), 'Niche Zero 填 -1 仍提示下限')
  r.check(grindScaleRangeLabel(NICHE) === '0 以上', 'Niche Zero 的範圍顯示為「0 以上」')

  r.section('三者皆 null：完全自由')
  r.check(isFreeformScale(N500), '小飛馬 500N 判定為完全無刻度')
  r.check(grindScaleHints(999, N500).length === 0, '填 999 沒有提示')
  r.check(grindScaleHints(-50, N500).length === 0, '填 -50 也沒有提示')
  r.check(grindScaleRangeLabel(N500) === null, '不顯示範圍')

  r.section('實用範圍與空值')
  r.check(grindScaleSuggestionLabel(C2) === '手沖常用 6–30', 'Timemore C2 顯示建議範圍')
  r.check(grindScaleSuggestionLabel(C40) === null, '沒有建議範圍就不顯示')
  r.check(grindScaleHints(null, EK43).length === 0, '沒填不提示')
  r.check(grindScaleHints(Number.NaN, EK43).length === 0, 'NaN 不提示')

  return r.finish()
}
