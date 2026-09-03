// 豆子詳情頁的比較表（《02-功能規格》§8、《03-介面規範》§4.6）。
//
// 這張表是本產品對 Excel 使用者最實在的差異化。Excel 在電腦上做得比這好，
// 但在手機上做得極差——而喝咖啡的當下，人都在手機上。
//
// 「與前一列不同的數值加上視覺標記」是讓使用者一眼看出自己改了什麼的關鍵，
// 所以比對的是**顯示後的字串**而不是原始值：使用者看到的是「1:15.0」，
// 那就以他看到的為準，避免 15 與 15.0 被判成不同。

export interface CompareBrew {
  id: string
  brewed_at: string
  dose: number | null
  water_temp: number | null
  grind_setting: number | null
  total_time: number | null
  is_favorite: boolean
  totalWater: number | null
}

export interface CompareCell {
  value: string
  changed: boolean
}

export interface CompareRow {
  id: string
  date: string
  isFavorite: boolean
  cells: CompareCell[]
}

/** 欄位標題。第一欄的日期固定不動，不在這個清單裡。 */
export const compareColumns = ['養豆', '粉重', '粉水比', '水溫', '刻度', '時間']

const EMPTY = '—'

function formatDate(iso: string) {
  const date = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(date.getMonth() + 1)}/${pad(date.getDate())}`
}

function cellValues(brew: CompareBrew, roastDate: string | null): string[] {
  const rested = restDays(roastDate, new Date(brew.brewed_at))
  const ratio = brewRatioLabel(brew.totalWater, brew.dose)
  return [
    rested === null ? EMPTY : `${rested}天`,
    brew.dose === null ? EMPTY : `${Number(brew.dose)}g`,
    ratio ?? EMPTY,
    brew.water_temp === null ? EMPTY : `${brew.water_temp}°`,
    brew.grind_setting === null ? EMPTY : String(Number(brew.grind_setting)),
    brew.total_time === null ? EMPTY : secondsToClock(brew.total_time),
  ]
}

/**
 * 依 brewed_at 由舊到新排序，讓演變方向由上而下。
 * 每一格標記它與前一列是否不同；第一列沒有前一列，一律不標記。
 */
export function buildCompareRows(brews: CompareBrew[], roastDate: string | null): CompareRow[] {
  const sorted = [...brews].sort((a, b) =>
    new Date(a.brewed_at).getTime() - new Date(b.brewed_at).getTime(),
  )

  let previous: string[] | null = null

  return sorted.map((brew) => {
    const values = cellValues(brew, roastDate)
    const cells = values.map((value, index) => ({
      value,
      // 養豆天數本來就每次都不同，標記它只會製造噪音
      changed: index !== 0 && previous !== null && previous[index] !== value,
    }))
    previous = values
    return {
      id: brew.id,
      date: formatDate(brew.brewed_at),
      isFavorite: brew.is_favorite,
      cells,
    }
  })
}
