// 結算頁主圖捲動時的模糊淡出（《03》§4.17，BrewHero.vue；2026-11-26 第三版）。
//
// 不在捲動時改 filter（iOS Safari 上每一幀重算模糊容易卡）。改成兩層疊起來，捲動時只改兩層的透明度：
//   上層  清楚的圖
//   下層  同一張圖，預先套好靜態的模糊（--hero-blur-end）
// 目標是兩件事同時、都跟著捲動進度 t（0–1）線性變化：
//   看起來的模糊程度  ＝ t        （模糊那一層在畫面上佔的比例）
//   整體的透明度 o    ＝ 1 − t(1 − end)   （end 是終點的透明度，--hero-opacity-end）
// 清楚的一層 c 疊在模糊的一層 b 上面：整體 ＝ c ＋ b(1 − c)，模糊佔的比例 ＝ b(1 − c) / 整體。解出來：
//   c ＝ o(1 − t)
//   b ＝ o·t / (1 − c)      t ＝ 0 時 c ＝ 1，模糊層整個被蓋住，取 1
// 一律由程式逐格用這裡算（2026-11-27 起不再用 CSS 的捲動連動動畫，BrewHero.vue），進度限制在 0 到 1。

/** 捲動進度 t（0–1）時兩層的透明度。end：終點的透明度（0–1） */
export function heroLayers(t: number, end: number): { clear: number, blurred: number } {
  const p = Math.min(1, Math.max(0, t))
  const e = Math.min(1, Math.max(0, end))
  const o = 1 - p * (1 - e)
  const clear = o * (1 - p)
  const blurred = p === 0 ? 1 : (o * p) / (1 - clear)
  return { clear, blurred }
}
