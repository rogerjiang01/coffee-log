// 表單膠囊上的日期與時刻（utils/formDate.ts，《03》§4.1）。
// 原生的日期與時刻攤成透明蓋在膠囊上，看得到的字由這裡決定：寫法和紀錄詳情頁的沖煮日期相同。

import { brewedDate, brewedTime, pillDate, pillTime } from '../../utils/formDate.ts'
import { createReport } from '../helpers/report.mjs'

export default function run() {
  const r = createReport('表單膠囊上的日期與時刻')

  r.section('格式：YYYY/MM/DD、24 小時制 HH:mm，補零（紀錄詳情頁的寫法）')
  r.check(pillDate('2026-11-03') === '2026/11/03', '2026-11-03 → 2026/11/03（補零留著）')
  r.check(pillDate('2026-01-31') === '2026/01/31', '只換分隔符號，不經過 Date：不會因為時區差一天')
  r.check(pillTime('13:32') === '13:32', '13:32 原樣')
  r.check(pillTime('00:09') === '00:09', '午夜之後：00:09，不寫成 12:09')
  r.check(pillTime('08:05:30') === '08:05', '有秒數時只留到分')

  r.section('空值：回 null，膠囊改寫「選填」')
  r.check(pillDate('') === null && pillDate(null) === null && pillDate(undefined) === null, '日期是空的')
  r.check(pillTime('') === null && pillTime(null) === null, '時刻是空的')
  r.check(pillDate('2026/11/03') === null && pillTime('1:32 PM') === null, '不是原生 value 的格式：不猜')

  r.section('標題下的沖煮日期（紀錄詳情、分享頁、結算頁）：日期與時刻分開給，畫面上各自不斷行')
  // 用本地時間建出來再轉 ISO：不論測試機在哪個時區，讀回來的本地欄位都一樣
  const iso = new Date(2026, 0, 5, 7, 3).toISOString()
  r.check(brewedDate(iso) === '2026/01/05', '日期：YYYY/MM/DD，補零（和表單的膠囊一致）')
  r.check(brewedTime(iso) === '07:03', '時刻：24 小時制 HH:mm，補零')
  r.check(brewedTime(new Date(2026, 10, 26, 0, 9).toISOString()) === '00:09', '午夜之後：00:09')

  return r.finish()
}
