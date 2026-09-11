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
