// 紀錄卡片上的沖煮日期與五欄參數（utils/brewCard.ts，《03》§4.21）。

import { CARD_EMPTY, cardBrewDate, cardParams } from '../../utils/brewCard.ts'
import { createReport } from '../helpers/report.mjs'

// 本地時間建出來的日期，不受執行測試的機器時區影響
const local = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min).toISOString()
const now = new Date(2026, 10, 23, 12, 0)

const full = { dose: 18, grindSetting: 28, waterTemp: 92, totalTime: 132, totalWater: 288 }

export default function run() {
  const r = createReport('紀錄卡片')

  r.section('沖煮日期（今年）：M/D 週X，只到日')
  r.check(cardBrewDate(local(2026, 11, 21, 8, 30), now) === '11/21 週六', `今年：11/21 週六（實際 ${cardBrewDate(local(2026, 11, 21, 8, 30), now)}）`)
  r.check(cardBrewDate(local(2026, 3, 5, 7, 4), now) === '3/5 週四', '月日不補零：3/5 週四')
  r.check(cardBrewDate(local(2026, 1, 1, 0, 0), now) === '1/1 週四', '午夜算當天：1/1 週四')
  r.check(cardBrewDate(local(2026, 11, 22, 23, 59), now) === '11/22 週日', '23:59 也還是當天：11/22 週日')
  r.check(!/:/.test(cardBrewDate(local(2026, 11, 22, 23, 59), now)), '不寫時刻（完整的日期時間在紀錄詳情頁）')

  r.section('沖煮日期（不是今年）：YYYY/M/D，不加星期')
  r.check(cardBrewDate(local(2025, 11, 21, 8, 30), now) === '2025/11/21', `去年：2025/11/21（實際 ${cardBrewDate(local(2025, 11, 21, 8, 30), now)}）`)
  r.check(cardBrewDate(local(2025, 3, 5, 8, 30), now) === '2025/3/5', '月日不補零：2025/3/5')
  r.check(cardBrewDate(local(2025, 12, 31, 23, 0), new Date(2026, 0, 1, 1, 0)) === '2025/12/31', '跨年後的第一天看前一晚：帶年份')
  r.check(cardBrewDate(local(2027, 1, 2, 9, 0), now) === '2027/1/2', '未來的年份也帶年份')
  r.check(!/週/.test(cardBrewDate(local(2025, 11, 21, 8, 30), now)), '不加星期')

  r.section('五欄的順序與格式（和紀錄詳情頁同一套）')
  const params = cardParams(full)
  r.check(params.map(p => p.label).join('、') === '粉重、刻度、水溫、時間、粉水比', `順序照 Figma：${params.map(p => p.label).join('、')}`)
  r.check(params.map(p => p.value).join('｜') === '18 g｜28｜92 °C｜2:12｜1:16.0', `數值：${params.map(p => p.value).join('｜')}`)
  r.check(cardParams({ ...full, dose: 20.5, grindSetting: 8.5 })[0]!.value === '20.5 g', '粉重有小數照原樣')
  r.check(cardParams({ ...full, grindSetting: 0.1 })[1]!.value === '0.1', '刻度 0.1 不出現浮點尾數（EK43）')
  r.check(cardParams({ ...full, totalTime: 0 })[3]!.value === '0:00', '沖煮時間 0 秒是 0:00，不是「—」')
  r.check(cardParams({ ...full, totalTime: 605 })[3]!.value === '10:05', '超過十分鐘：10:05')

  r.section('沒填的欄位顯示「—」，位置保留')
  const empty = cardParams({ dose: 15, grindSetting: null, waterTemp: null, totalTime: null, totalWater: null })
  r.check(empty.length === 5, '五欄都在，沒有因為沒填就收掉')
  r.check(empty.slice(1).every(p => p.value === CARD_EMPTY), `沒填的四欄都是「—」：${empty.map(p => p.value).join('｜')}`)
  r.check(CARD_EMPTY === '—', '「—」是破折號 U+2014，不是連字號')
  r.check(cardParams({ ...full, totalWater: null })[4]!.value === CARD_EMPTY, '沒有總水量：粉水比是「—」')
  r.check(cardParams({ ...full, dose: null })[4]!.value === CARD_EMPTY && cardParams({ ...full, dose: null })[0]!.value === CARD_EMPTY,
    '沒有粉重（舊資料不該發生，但不能壞）：粉重與粉水比都是「—」')

  return r.finish()
}
