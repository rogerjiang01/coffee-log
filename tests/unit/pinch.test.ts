// 雙指縮放的比例換算。
//
// 實際發生過：兩指一起往右滑，照片的縮放飄了 5%。原因是 cropper-image.$zoom
// 對正負值用不同公式，傳「比例 - 1」時一縮一放抵不掉。
// 下面的 cropperScale 照抄 @cropper/element-image 2.2.0 的 $zoom 開頭——
// 升級 cropperjs 時若那段公式改了，這個測試要跟著核對。

import { zoomArg } from '../../utils/pinch.ts'
import { createReport } from '../helpers/report.mjs'

/** @cropper/element-image 2.2.0 的 $zoom() 把參數換成倍率的那一段 */
function cropperScale(s: number) {
  return s < 0 ? 1 / (1 - s) : s + 1
}

const close = (a: number, b: number) => Math.abs(a - b) < 1e-9

export default function run() {
  const r = createReport('雙指縮放的比例換算')

  r.section('$zoom 剛好縮放 ratio 倍')
  for (const ratio of [0.5, 0.92, 0.999, 1, 1.001, 1.087, 2.25]) {
    const actual = cropperScale(zoomArg(ratio))
    r.check(close(actual, ratio), `比例 ${ratio} → 實際 ${actual.toFixed(6)}`)
  }

  r.section('兩指一起滑動：距離一縮一放，縮放不能累積')
  // 真實裝置一次送一根手指：距離 100 → 92 → 100，重複 8 次（實測的那一段）
  let fixed = 1
  let naive = 1
  for (let i = 0; i < 8; i++) {
    fixed *= cropperScale(zoomArg(92 / 100)) * cropperScale(zoomArg(100 / 92))
    naive *= cropperScale(92 / 100 - 1) * cropperScale(100 / 92 - 1)
  }
  r.check(close(fixed, 1), `8 次來回後縮放仍是 1（實際 ${fixed.toFixed(6)}）`)
  r.check(naive > 1.05, `對照：直接傳「比例 - 1」會飄到 ${naive.toFixed(4)}——就是實測到的 5%`)

  r.section('退化情況')
  r.check(zoomArg(0) === 0 && zoomArg(Number.NaN) === 0 && zoomArg(Number.POSITIVE_INFINITY) === 0,
    '兩指疊在同一點（比例 0、NaN 或無限大）時不縮放，不讓矩陣變成 0')

  return r.finish()
}
