// 結算頁主圖捲動時的模糊淡出（utils/heroFade.ts，《03》§4.17）。
// 兩層（上層清楚、下層預先模糊）只改透明度，要做到：看起來的模糊程度 ＝ t、整體透明度 ＝ 1 − t(1 − 終點)，兩個都線性。

import { HERO_FADE_STOPS, heroLayers } from '../../utils/heroFade.ts'
import { createReport } from '../helpers/report.mjs'

export default function run() {
  const r = createReport('結算頁主圖的模糊淡出')
  const near = (a: number, b: number) => Math.abs(a - b) < 1e-9

  r.section('起點與終點')
  r.check(heroLayers(0, 0).clear === 1 && heroLayers(0, 0).blurred === 1, '捲動 0：清楚的一層完全不透明（模糊的一層被蓋住）')
  r.check(heroLayers(1, 0).clear === 0 && heroLayers(1, 0).blurred === 0, '終點、透明度 0：兩層都透明')
  r.check(heroLayers(1, 0.3).clear === 0 && near(heroLayers(1, 0.3).blurred, 0.3), '終點的透明度調成 0.3：只剩模糊的一層，30%')
  r.check(heroLayers(-1, 0).clear === 1 && heroLayers(2, 0).clear === 0, '超出 0–1 的進度：夾回範圍內（iOS 的回彈）')

  r.section('疊起來的結果：模糊程度與整體透明度都隨進度線性變化')
  for (const end of [0, 0.25, 0.6]) {
    for (const t of [0.1, 0.25, 0.5, 0.75, 0.9]) {
      const { clear, blurred } = heroLayers(t, end)
      const total = clear + blurred * (1 - clear)
      r.check(near(total, 1 - t * (1 - end)) && near((blurred * (1 - clear)) / total, t),
        `終點 ${end}、進度 ${t}：整體 ${total.toFixed(3)}，模糊佔 ${((blurred * (1 - clear)) / total).toFixed(2)}`)
    }
  }
  r.check(HERO_FADE_STOPS.join() === '0,0.25,0.5,0.75,1', 'CSS 的關鍵影格在 0、25、50、75、100%（BrewHero.vue 照這五個點寫）')

  return r.finish()
}
