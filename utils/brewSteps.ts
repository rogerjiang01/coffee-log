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
  /** 自由文字備註。與 stepType 是兩件事：前者是結構化標記，後者是自由文字。 */
  note: string
}

/** 資料庫裡的一段 */
export interface StepRow {
  step_index: number
  time_offset: number
  cumulative_water: number
  step_type: StepType
  note: string | null
}

export function emptyStep(stepType: StepType = 'pour'): StepInput {
  return { stepType, cumulativeWater: null, holdSeconds: null, note: '' }
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
      note: (step.note ?? '').trim() || null,
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
    return {
      stepType: row.step_type,
      cumulativeWater: row.cumulative_water,
      holdSeconds,
      note: row.note ?? '',
    }
  })
}

/** 分段模板裡每一段的水量基準（《01-資料庫規格》§3.7） */
export type StepBasis = 'dose' | 'total' | 'remaining'

export interface MethodTemplateStep {
  type: StepType
  basis: StepBasis
  factor: number
  duration: number
  note?: string
}

/** 沖煮手法的分段模板 */
export interface MethodTemplate {
  steps: MethodTemplateStep[]
}

export interface TemplateResult {
  steps: StepInput[]
  /** 觸發邊界保護時的提示，介面要顯示出來 */
  notice: string | null
}

/** 悶蒸吃掉超過這個比例的水就不合理，觸發邊界保護 */
const BLOOM_LIMIT = 0.5

/**
 * 依手法模板換算成實際分段。
 *
 * **基準由模板自己宣告，不由系統統一決定**，因為兩種需求本質不同：
 *   dose       水量 = 粉重 × factor。悶蒸是物理需求——要讓粉床濕透、
 *              排出二氧化碳，需求量由粉重決定，跟總水量無關。
 *   total      水量 = 總水量 × factor。4:6 的第一注不是悶蒸，
 *              它是「前 40% 分兩注」這個結構的一部分，綁粉重會破壞手法本身。
 *   remaining  水量 = 該組基準 × factor。基準在**該組第一段時算一次**
 *              （總水量 − 當時已分配），之後固定不變。
 *
 * remaining 的基準為什麼固定而不是每段重算：規格要求同一組 remaining 的
 * factor 總和為 1。若每段都用「當下剩餘」重算，四個 0.25 會得到
 * 60/45/34/101 這種遞減後暴增的分配，總和為 1 這條規則不產生任何保證，
 * 而且五個手法的描述（等分四注、高頻補水小水量）全部對不上。
 * 基準固定時四個 0.25 就是實實在在的四等分。
 *
 * 兩個計算規則：
 *   一、每段四捨五入到整數 ml。
 *   二、**最後一段用「總水量 − 前面所有段的累計」**而不是公式計算，
 *       確保總和精確等於總水量，不讓小數誤差累積。
 *
 * 帶入之後使用者可以自由修改任何數值、增減段數，brew_method_id 保持不變。
 * 系統不得在儲存時檢查實際分段是否符合模板（§3.7）。
 */
export function stepsFromTemplate(
  template: MethodTemplate | null,
  dose: number | null,
  defaultRatio: number | null,
): TemplateResult | null {
  if (!template?.steps?.length || dose === null || defaultRatio === null) return null
  if (dose <= 0 || defaultRatio <= 0) return null

  const total = dose * defaultRatio
  let notice: string | null = null
  let allocated = 0
  // 每一組連續的 remaining 共用一個基準，在該組第一段時決定
  let remainingBase: number | null = null

  const increments = template.steps.map((step, index) => {
    // 最後一段一律用剩下的全部，不套公式——這樣總和才會精確等於總水量
    if (index === template.steps.length - 1) {
      return Math.max(0, Math.round(total - allocated))
    }

    let amount: number
    if (step.basis === 'dose') {
      amount = dose * step.factor
      // 邊界保護：粉水比極端到悶蒸會吃掉一半的水時，不採用這個數值
      if (amount > total * BLOOM_LIMIT) {
        amount = total * BLOOM_LIMIT
        notice = '粉水比偏低，悶蒸水量已改用總水量比例計算，請確認是否合理'
      }
    }
    else if (step.basis === 'total') {
      amount = total * step.factor
    }
    else {
      if (remainingBase === null) remainingBase = total - allocated
      amount = remainingBase * step.factor
    }

    // 離開 remaining 群組時把基準清掉，下一組會重新計算
    if (step.basis !== 'remaining') remainingBase = null

    const rounded = Math.max(0, Math.round(amount))
    allocated += rounded
    return rounded
  })

  let cumulative = 0
  const steps = template.steps.map((step, index) => {
    cumulative += increments[index]!
    return {
      stepType: step.type,
      // 磅秤讀的是累積數字，這裡直接給累積值
      cumulativeWater: cumulative,
      holdSeconds: step.duration,
      note: step.note ?? '',
    }
  })

  return { steps, notice }
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
