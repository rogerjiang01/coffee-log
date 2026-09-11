// 雙指縮放的比例換算。
//
// 實際發生過：兩指一起往右滑，照片的縮放飄了 5%。原因是 cropper-image.$zoom
// 對正負值用不同公式，傳「比例 - 1」時一縮一放抵不掉。
// 下面的 cropperScale 照抄 @cropper/element-image 2.2.0 的 $zoom 開頭——
// 升級 cropperjs 時若那段公式改了，這個測試要跟著核對。

import {
  zoomArg, minCoverScale, initialCover, clampPinchRatio, clampToCover, sameMatrix,
  type Matrix, type Size, type Box, type Point,
} from '../../utils/pinch.ts'
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

  // ── 照片永遠蓋滿裁切框 ──
  // 實測畫面：375×812，框 338×338 在 (19, 198)。照片未變形時的中心就是自然尺寸的一半。
  const frame: Box = { x: 19, y: 198, width: 338, height: 338 }
  const landscape: Size = { width: 1200, height: 800 }
  const portrait: Size = { width: 800, height: 1200 }
  const originOf = (natural: Size): Point => ({ x: natural.width / 2, y: natural.height / 2 })
  const rectOf = (m: Matrix, natural: Size) => {
    const origin = originOf(natural)
    const width = natural.width * m[0]
    const height = natural.height * m[0]
    const left = origin.x + m[4] - width / 2
    const top = origin.y + m[5] - height / 2
    return { left, top, right: left + width, bottom: top + height }
  }
  const EPS = 1e-6
  const covers = (m: Matrix, natural: Size) => {
    const rect = rectOf(m, natural)
    return rect.left <= frame.x + EPS && rect.top <= frame.y + EPS
      && rect.right >= frame.x + frame.width - EPS && rect.bottom >= frame.y + frame.height - EPS
  }
  const near = (a: number, b: number) => Math.abs(a - b) < EPS

  r.section('初始：短邊剛好等於框的邊長')
  const wide = initialCover(landscape, originOf(landscape), frame)
  const wideRect = rectOf(wide, landscape)
  r.check(near(wideRect.top, frame.y) && near(wideRect.bottom, frame.y + frame.height),
    `橫式：上下緣貼齊框（${wideRect.top.toFixed(1)}–${wideRect.bottom.toFixed(1)}）`)
  r.check(near(frame.x - wideRect.left, wideRect.right - (frame.x + frame.width)),
    '橫式：左右多出來的部分兩邊一樣多——置中於框')
  const tall = initialCover(portrait, originOf(portrait), frame)
  const tallRect = rectOf(tall, portrait)
  r.check(near(tallRect.left, frame.x) && near(tallRect.right, frame.x + frame.width),
    `直式：左右緣貼齊框（${tallRect.left.toFixed(1)}–${tallRect.right.toFixed(1)}）`)
  const square = initialCover({ width: 1000, height: 1000 }, { x: 500, y: 500 }, frame)
  r.check(near(square[0] * 1000, frame.width), '正方形照片剛好等於框，一點不多')

  r.section('縮放下限：停在短邊等於框')
  const min = minCoverScale(landscape, frame)
  const current = min * 1.1
  r.check(near(current * clampPinchRatio(0.5, current, min), min),
    '雙指一口氣縮一半：停在下限，不是縮過頭再彈回來')
  r.check(clampPinchRatio(1.2, current, min) === 1.2, '放大不受下限影響')
  r.check(near(clampPinchRatio(0.9, min, min) * min, min), '已經在下限時再縮：原地不動')
  const shrunk = clampToCover([min * 0.7, 0, 0, min * 0.7, wide[4], wide[5]], landscape, originOf(landscape), frame)
  r.check(near(shrunk[0], min) && near(shrunk[3], min), '單指路徑遇到小於下限的倍率：拉回剛好是下限')

  r.section('拖曳邊界：框內不會出現空白')
  const pushed = clampToCover([wide[0], 0, 0, wide[0], wide[4] + 500, wide[5]], landscape, originOf(landscape), frame)
  r.check(near(rectOf(pushed, landscape).left, frame.x), '往右拖過頭：照片左緣停在框的左緣')
  const down = clampToCover([wide[0], 0, 0, wide[0], wide[4], wide[5] + 10], landscape, originOf(landscape), frame)
  r.check(near(down[5], wide[5]), '橫式在初始狀態上下已經貼齊：往下拖不動')
  const inside = clampToCover([wide[0], 0, 0, wide[0], wide[4] - 30, wide[5]], landscape, originOf(landscape), frame)
  r.check(sameMatrix(inside, [wide[0], 0, 0, wide[0], wide[4] - 30, wide[5]]), '範圍內的拖曳原樣通過，不被修改')

  r.section('雙指與單指的約束一致')
  // 兩條路徑交錯走 400 步：雙指以任意點為錨點縮放、單指任意拖曳，每一步都要蓋滿框
  let seed = 7
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  for (const natural of [landscape, portrait]) {
    const origin = originOf(natural)
    const floor = minCoverScale(natural, frame)
    let m = initialCover(natural, origin, frame)
    let everyStepCovers = true
    let neverBelowFloor = true
    for (let step = 0; step < 400; step++) {
      if (step % 2 === 0) {
        // 雙指：比例先過下限，再以錨點縮放
        const k = clampPinchRatio(0.6 + random() * 0.8, m[0], floor)
        const anchor = { x: random() * 375, y: random() * 734 }
        const cx = anchor.x + (origin.x + m[4] - anchor.x) * k
        const cy = anchor.y + (origin.y + m[5] - anchor.y) * k
        m = clampToCover([m[0] * k, 0, 0, m[0] * k, cx - origin.x, cy - origin.y], natural, origin, frame)
      }
      else {
        m = clampToCover([m[0], 0, 0, m[0], m[4] + (random() - 0.5) * 400, m[5] + (random() - 0.5) * 400], natural, origin, frame)
      }
      if (!covers(m, natural)) everyStepCovers = false
      if (m[0] < floor - EPS) neverBelowFloor = false
    }
    const label = natural === landscape ? '橫式' : '直式'
    r.check(everyStepCovers, `${label}：400 步裡每一步照片都蓋滿框`)
    r.check(neverBelowFloor, `${label}：倍率從未低於下限`)
  }

  return r.finish()
}
