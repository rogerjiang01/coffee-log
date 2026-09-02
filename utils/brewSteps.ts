// 分段注水的單位轉換（《01-資料庫規格》§3.6、《02-功能規格》§5 區塊三）。
//
// 這是整個專案最容易寫反的地方，兩個欄位的方向不同：
//
//   累積水量  介面輸入「注到 160 g」→ 資料庫直接存 160。**不換算。**
//             使用者沖煮時看的是磅秤上的累積數字。
//
//   時間      介面輸入「停 30 秒」→ 資料庫存「累積時間點」time_offset。
//             **要換算。** 使用者的心智是「注到 160g，停 30 秒」，
//             不是「在第 75 秒時」。資料庫一律只認 time_offset。
//
// 換算方向：
//   存檔  time_offset[1] = 0；time_offset[n] = time_offset[n-1] + 停留秒數[n-1]
//   讀取  停留秒數[n] = time_offset[n+1] − time_offset[n]
//         最後一段用 total_time − time_offset[n]（§8）
//
// 注意最後一段的停留秒數不影響任何 time_offset——它是最後一次注水之後的
// 時間，由 total_time 表達，因此不另外儲存。

export type StepType = 'bloom' | 'pour' | 'stir' | 'wait'

/** 介面上的一段 */
export interface StepInput {
  stepType: StepType
  cumulativeWater: number | null
  holdSeconds: number | null
}

/** 資料庫裡的一段 */
export interface StepRow {
  step_index: number
  time_offset: number
  cumulative_water: number
  step_type: StepType
}

export function emptyStep(stepType: StepType = 'pour'): StepInput {
  return { stepType, cumulativeWater: null, holdSeconds: null }
}

/** 悶蒸就是 step_index = 1 且 step_type = 'bloom' 的那一筆，沒有獨立欄位 */
export function initialSteps(): StepInput[] {
  return [emptyStep('bloom'), emptyStep('pour')]
}

/**
 * 介面 → 資料庫。
 * cumulative_water 是 NOT NULL，因此沒填水量的列視為使用者沒填完，直接丟掉。
 */
export function toStepRows(steps: StepInput[]): StepRow[] {
  const filled = steps.filter(step => step.cumulativeWater !== null)
  const rows: StepRow[] = []
  let offset = 0

  filled.forEach((step, index) => {
    if (index > 0) {
      // 累加的是「前一段」的停留秒數，不是自己的
      offset += filled[index - 1]!.holdSeconds ?? 0
    }
    rows.push({
      step_index: index + 1,
      time_offset: offset,
      cumulative_water: step.cumulativeWater!,
      step_type: step.stepType,
    })
  })

  return rows
}

/**
 * 資料庫 → 介面。totalTime 用來還原最後一段的停留秒數。
 */
export function toStepInputs(rows: StepRow[], totalTime: number | null): StepInput[] {
  const sorted = [...rows].sort((a, b) => a.step_index - b.step_index)

  return sorted.map((row, index) => {
    const next = sorted[index + 1]
    let holdSeconds: number | null
    if (next) {
      holdSeconds = next.time_offset - row.time_offset
    }
    else if (totalTime !== null) {
      const remaining = totalTime - row.time_offset
      // total_time 比最後一段的時間點還早時不硬湊出負數
      holdSeconds = remaining >= 0 ? remaining : null
    }
    else {
      holdSeconds = null
    }
    return { stepType: row.step_type, cumulativeWater: row.cumulative_water, holdSeconds }
  })
}

/** 每段增量水量。第一段即其本身（§8）。 */
export function incrementalWater(steps: StepInput[]): (number | null)[] {
  let previous = 0
  return steps.map((step) => {
    if (step.cumulativeWater === null) return null
    const delta = step.cumulativeWater - previous
    previous = step.cumulativeWater
    return delta
  })
}

/** 總水量＝最後一段的累積水量。衍生值，不設輸入欄位、不存資料庫。 */
export function totalWater(steps: StepInput[]): number | null {
  const values = steps.map(step => step.cumulativeWater).filter((v): v is number => v !== null)
  return values.length ? Math.max(...values) : null
}

/** 粉水比，顯示成 1:15.0。衍生值，不可編輯、不存資料庫。 */
export function brewRatioLabel(water: number | null, dose: number | null): string | null {
  if (water === null || dose === null || dose <= 0) return null
  return `1:${(water / dose).toFixed(1)}`
}

/** 總沖煮時間的顯示與輸入都是分:秒，資料庫存秒數 */
export function secondsToClock(total: number | null): string {
  if (total === null || total < 0) return ''
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function clockToSeconds(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const match = trimmed.match(/^(\d+):([0-5]?\d)$/)
  if (match) return Number(match[1]) * 60 + Number(match[2])
  // 只打數字時當成秒
  if (/^\d+$/.test(trimmed)) return Number(trimmed)
  return null
}
