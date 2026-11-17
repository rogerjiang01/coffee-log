// 表單膠囊上的日期與時刻（SelectField 的 text，2026-11-17）。
//
// 原生的日期與時刻輸入攤成透明蓋在膠囊上，看得到的是這裡寫的字：
// 原生的寫法隨瀏覽器變（Chromium「11/03/2026」、WebKit「2026/11/03」、iOS「2026年11月3日」），
// 寬度也不貼合文字。格式沿用紀錄詳情頁的沖煮日期（YYYY/MM/DD、24 小時制 HH:mm，補零）。
//
// 輸入是原生控制項的 value（YYYY-MM-DD、HH:mm 或 HH:mm:ss），只是換寫法——
// 不經過 Date，不會因為時區差一天。

/** YYYY-MM-DD → YYYY/MM/DD。空值或不是這個格式時回 null（膠囊改寫「選填」） */
export function pillDate(value: string | null | undefined): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '')
  return match ? `${match[1]}/${match[2]}/${match[3]}` : null
}

/** HH:mm 或 HH:mm:ss → HH:mm。空值或不是這個格式時回 null */
export function pillTime(value: string | null | undefined): string | null {
  const match = /^(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(value ?? '')
  return match ? `${match[1]}:${match[2]}` : null
}
