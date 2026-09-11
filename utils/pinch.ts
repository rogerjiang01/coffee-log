// 雙指縮放的比例換算。
//
// cropper-image 的 $zoom(s) 對正負值用不同公式：s ≥ 0 放大成 1 + s 倍，
// s < 0 縮小成 1 / (1 - s) 倍。直接傳「比例 - 1」的話，縮小 0.92 倍會變成
// 1 / 1.08 ≈ 0.926 倍——一縮一放抵不掉。真實裝置一次只送一根手指的移動，
// 兩指一起滑動時距離會一縮一放地抖，每一步多放大 0.65%，滑一段就飄了 5%。
// 這裡反推出能讓 $zoom 剛好縮放 ratio 倍的參數。

/** 讓 cropper-image.$zoom 剛好縮放 `ratio` 倍的參數 */
export function zoomArg(ratio: number): number {
  // 兩指疊在同一點時比例是 0 或無限大；不縮放，免得矩陣變成 0
  if (!(ratio > 0) || !Number.isFinite(ratio)) return 0
  return ratio >= 1 ? ratio - 1 : 1 - 1 / ratio
}

// ── 照片永遠蓋滿裁切框 ─────────────────────────────────────
//
// 只有一條規則：**照片永遠不該小於裁切框**（iOS 內建與 Instagram 裁切的行為）。
// 由它推出三件事：
//   初始  短邊剛好等於框的邊長，置中於框
//   縮放  縮到短邊等於框就停住——不回彈、不超過
//   拖曳  照片邊緣碰到框就停住，框內不會出現空白
//
// 兩條路徑共用這裡的函式，約束才會一致：
//   雙指（PhotoCropper 自己處理）→ clampPinchRatio 先把這一步的比例限制在下限
//   單指（cropperjs 的 $move）  → cropper-image 的 transform 事件裡用 clampToCover 修正
// clampToCover 也會把倍率拉回下限，所以雙指即使有浮點誤差也不會漏過去。
//
// 座標一律是視窗座標（getBoundingClientRect）。cropper-image 的 transform-origin
// 是它自己的中心，所以矩陣的 e、f 正好是「照片中心相對於未變形位置的位移」，
// 而縮放不會移動中心——倍率與位置因此可以分開約束。

export type Matrix = [number, number, number, number, number, number]
export interface Size { width: number, height: number }
export interface Box extends Size { x: number, y: number }
export interface Point { x: number, y: number }

/** 短邊剛好等於框的倍率。再小，框內就會露出空白 */
export function minCoverScale(natural: Size, frame: Size): number {
  return Math.max(frame.width / natural.width, frame.height / natural.height)
}

/** 照片未變形時的中心：量到的外框中心，扣掉目前矩陣的位移 */
export function untransformedCenter(rect: Box, matrix: Matrix): Point {
  return { x: rect.x + rect.width / 2 - matrix[4], y: rect.y + rect.height / 2 - matrix[5] }
}

/** 初始狀態：短邊等於框的邊長、置中於框。直式照片框貼左右，橫式貼上下 */
export function initialCover(natural: Size, origin: Point, frame: Box): Matrix {
  const scale = minCoverScale(natural, frame)
  return [scale, 0, 0, scale, frame.x + frame.width / 2 - origin.x, frame.y + frame.height / 2 - origin.y]
}

/** 雙指這一步的比例。縮到下限就停在下限，放大不受影響 */
export function clampPinchRatio(ratio: number, currentScale: number, minScale: number): number {
  return Math.max(ratio, minScale / currentScale)
}

/** 把矩陣拉回「照片蓋滿框」的範圍。本來就在範圍內的，數值不變 */
export function clampToCover(matrix: Matrix, natural: Size, origin: Point, frame: Box): Matrix {
  const scale = Math.max(matrix[0], minCoverScale(natural, frame))
  const halfWidth = natural.width * scale / 2
  const halfHeight = natural.height * scale / 2
  // 照片中心能落的範圍：左緣不能跑進框左緣的右邊，右緣不能跑進框右緣的左邊
  const cx = clamp(origin.x + matrix[4], frame.x + frame.width - halfWidth, frame.x + halfWidth)
  const cy = clamp(origin.y + matrix[5], frame.y + frame.height - halfHeight, frame.y + halfHeight)
  return [scale, matrix[1], matrix[2], scale, cx - origin.x, cy - origin.y]
}

export function sameMatrix(a: Matrix, b: Matrix, epsilon = 1e-6): boolean {
  return a.every((value, i) => Math.abs(value - (b[i] ?? Number.NaN)) <= epsilon)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}
