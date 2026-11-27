// 結算頁主圖捲動時的模糊淡出（utils/heroFade.ts，《03》§4.17）。
// 兩層（上層清楚、下層預先模糊）只改透明度，要做到：看起來的模糊程度 ＝ t、整體透明度 ＝ 1 − t(1 − 終點)，兩個都線性。

import { HERO_TIMELINE_RANGE, heroKeyframes, heroLayers } from '../../utils/heroFade.ts'
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

  r.section('合成器路徑的關鍵影格：0 到 10000px 的時間軸，終點之後維持終點的值')
  const sample = (frames: ReturnType<typeof heroKeyframes>, offset: number, key: 'clear' | 'blurred') => {
    const i = frames.findIndex(f => f.offset >= offset)
    if (frames[i].offset === offset) return frames[i][key]
    const a = frames[i - 1], b = frames[i]
    return a[key] + ((b[key] - a[key]) * (offset - a.offset)) / (b.offset - a.offset)
  }
  for (const [fadeEnd, end] of [[259.6, 0], [122, 0], [282, 0.3]] as const) {
    const frames = heroKeyframes(fadeEnd, end)
    r.check(HERO_TIMELINE_RANGE === 10000 && frames.length >= 12 && frames.length <= 20 && frames[0].offset === 0 && frames.at(-1)!.offset === 1
      && frames.every((f, i) => i === 0 || f.offset > frames[i - 1].offset),
      `終點 ${fadeEnd}px：${frames.length} 個點，offset 從 0 遞增到 1`)
    r.check(near(frames.at(-2)!.offset, fadeEnd / 10000) && frames.at(-2)!.clear === frames.at(-1)!.clear && frames.at(-2)!.blurred === frames.at(-1)!.blurred,
      `終點 ${fadeEnd}px：終點落在 ${fadeEnd} ÷ 10000，之後到 1 都是終點的值`)
    let worst = 0
    for (let y = fadeEnd * 0.01; y <= fadeEnd * 1.5; y += fadeEnd / 200) {
      const want = heroLayers(y / fadeEnd, end)
      const total = (c: number, b: number) => c + b * (1 - c)
      const got = { clear: sample(frames, y / 10000, 'clear'), blurred: sample(frames, y / 10000, 'blurred') }
      worst = Math.max(worst, Math.abs(got.clear - want.clear), Math.abs(total(got.clear, got.blurred) - total(want.clear, want.blurred)))
    }
    r.check(worst < 0.005, `終點 ${fadeEnd}px：線性內插和 heroLayers 差 ${worst.toFixed(4)}（清楚層與疊起來的整體）`)
  }

  return r.finish()
}
