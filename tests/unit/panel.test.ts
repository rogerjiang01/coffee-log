// 浮層的定位。
//
// 這裡曾經有個高度下限，會強迫浮層至少 240px、在空間不足時伸出視窗外。
// position: fixed 讓頁面捲不到它，底部的動作因此永遠點不到，
// 而且不會有任何錯誤訊息——所以這組測試存在。

import { computePanelPlacement } from '../../composables/useAnchoredPanel.ts'
import { createReport } from '../helpers/report.mjs'

const rect = (top: number, height = 44) => ({ top, bottom: top + height, left: 20, width: 300 })

function fitsInViewport(style: Record<string, string>, viewport: number) {
  const height = Number.parseFloat(style.maxHeight!)
  if (style.top !== undefined) return Number.parseFloat(style.top) + height <= viewport + 0.01
  return Number.parseFloat(style.bottom!) + height <= viewport + 0.01
}

export default function run() {
  const r = createReport('浮層定位')

  r.section('空間充足')
  const roomy = computePanelPlacement(rect(100), 812)
  r.check(roomy.top !== undefined, '往下開')
  r.check(Number.parseFloat(roomy.maxHeight!) === 360, '高度取上限')
  r.check(roomy.left === '20px' && roomy.width === '300px', '左緣與寬度跟著觸發元素')

  r.section('絕不超出視窗（舊版的失敗區間）')
  for (const below of [150, 205, 220, 250, 300, 500]) {
    const anchorTop = 812 - below - 44
    const style = computePanelPlacement(rect(anchorTop), 812)
    r.check(fitsInViewport(style, 812),
      `下方剩 ${below}px 時浮層不超出視窗（舊版會固定成 240px）`)
  }

  r.section('翻面')
  r.check(computePanelPlacement(rect(600), 812).bottom !== undefined, '下方明顯不足時往上開')
  r.check(computePanelPlacement(rect(812 - 300 - 44), 812).top !== undefined,
    '下方還有 300px 時維持往下開，不為了幾像素翻面')

  r.section('極端情況')
  const tiny = computePanelPlacement(rect(400), 500)
  r.check(Number.parseFloat(tiny.maxHeight!) >= 0, '視窗很矮時高度不會是負值')
  r.check(fitsInViewport(tiny, 500), '極端情況下仍然不超出視窗')
  const atTop = computePanelPlacement(rect(0), 812)
  r.check(atTop.top !== undefined && Number.parseFloat(atTop.maxHeight!) > 0,
    '欄位貼在視窗頂端時往下開且有高度')

  return r.finish()
}
