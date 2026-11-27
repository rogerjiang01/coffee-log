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

// ── 沖煮日期的顯示（紀錄詳情、分享頁、結算頁的標題下方；2026-11-26 抽出來）──────────
// 日期與時刻分開給：畫面上各自包一層 white-space: nowrap、中間一個空格。
// 窄螢幕（320px）放不下時在兩者之間換行，不會在數字中間斷開（「2026/1」「1/21」）。
// 格式和表單的膠囊一致：YYYY/MM/DD、24 小時制 HH:mm，補零；照瀏覽器的本地時間。

const pad2 = (n: number) => String(n).padStart(2, '0')

/** ISO 時間 → YYYY/MM/DD（本地時間） */
export function brewedDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}/${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}`
}

/** ISO 時間 → HH:mm（本地時間、24 小時制） */
export function brewedTime(iso: string): string {
  const d = new Date(iso)
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}
