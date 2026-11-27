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
// 兩條路都用這裡（BrewHero.vue，2026-11-27 第二版）：支援捲動時間軸的瀏覽器在合成器上跑，關鍵影格由 heroKeyframes 照這條曲線取樣；
// 不支援的由程式逐格用 heroLayers 算，進度限制在 0 到 1。

/** 捲動進度 t（0–1）時兩層的透明度。end：終點的透明度（0–1） */
export function heroLayers(t: number, end: number): { clear: number, blurred: number } {
  const p = Math.min(1, Math.max(0, t))
  const e = Math.min(1, Math.max(0, end))
  const o = 1 - p * (1 - e)
  const clear = o * (1 - p)
  const blurred = p === 0 ? 1 : (o * p) / (1 - clear)
  return { clear, blurred }
}

/** 合成器上的時間軸長度（px）：和背景的抵銷平移（BrewHero 的 --hero-follow）同一個。頁面捲不到這麼遠，動畫永遠不會結束 */
export const HERO_TIMELINE_RANGE = 10000

/**
 * 合成器路徑的關鍵影格（2026-11-27）：時間軸是 0 到 HERO_TIMELINE_RANGE px 的捲動，
 * 淡出在 fadeEnd px 結束，所以進度 t 落在 offset ＝ t × fadeEnd ÷ HERO_TIMELINE_RANGE；終點之後到 1 都是終點的值。
 * 曲線照 heroLayers 取樣：0、0.005（清楚層蓋住時模糊層從 1 換成實際的值，跳變壓在第一小段裡）、1/16、2/16……1，
 * 18 個取樣點，再加上 offset 1 的終點值，一共 19 個；中間線性內插（和 heroLayers 差 0.002 以內）。
 */
export function heroKeyframes(fadeEnd: number, end: number): { offset: number, clear: number, blurred: number }[] {
  const ts = [0, 0.005, ...Array.from({ length: 16 }, (_, i) => (i + 1) / 16)]
  const scale = Math.min(1, Math.max(0, fadeEnd) / HERO_TIMELINE_RANGE)
  const frames = ts.map(t => ({ offset: t * scale, ...heroLayers(t, end) }))
  return [...frames, { offset: 1, ...heroLayers(1, end) }]
}
