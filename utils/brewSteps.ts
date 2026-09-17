// 分段注水（《01-資料庫規格》§3.6、《02-功能規格》§5 區塊三）。
//
// **介面填什麼就存什麼，沒有換算層。**
//   累積水量  「注到 160 g」→ cumulative_water = 160
//   停留秒數  「停 30 秒」  → hold_seconds = 30
//
// 停留＝注完之後到下一注之前的**純停水時間**，不含注水動作本身。
//
// 舊版存的是累積時間點（time_offset），「停留」被定義成「這段開始注水到
// 下一段開始注水」的全部時間。那個定義要求使用者提供一個他不知道的數字
// ——注水花了幾秒——兩位實機測試者都填不出來（「我以為是下沖的時間」；
// 被告知定義之後仍然「不知道怎麼填」）。給水速率依器材與手法而異，
// 還有行動誤差，無法預期；能預期、也真的在被調整的是停水時間。
// **換算層與它的測試一起移除了，不要再加回來。**
//
// 最後一段不存停留秒數（一律 null）：最後一注之後沒有下一注，「停水」
// 這件事不存在，剩下的只是等它滴完，那段時間由 total_time 記錄。
//
// hold_seconds 可為 NULL：沒記錄就是 NULL。舊版 NOT NULL 逼得「沒記錄」
// 與「停 0 秒」共用同一個值，才需要「全為 0 視為沒記錄」那個變通。

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
  /** 純停水秒數。沒記錄是 null；最後一段永遠是 null */
  hold_seconds: number | null
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
 * 介面 → 資料庫。**沒有換算，填什麼存什麼。**
 *
 * cumulative_water 是 NOT NULL，因此沒填水量的列視為使用者沒填完，直接丟掉。
 * 最後一段的停留一律 null——介面上那一格本來就不顯示，這裡再守一次：
 * 刪掉尾段時，原本的倒數第二段會變成最後一段，它殘留的值不該被存下來。
 */
export function toStepRows(steps: StepInput[]): StepRow[] {
  const filled = steps.filter(step => step.cumulativeWater !== null)

  return filled.map((step, index) => ({
    step_index: index + 1,
    hold_seconds: index === filled.length - 1 ? null : step.holdSeconds,
    cumulative_water: step.cumulativeWater!,
    step_type: step.stepType,
    note: (step.note ?? '').trim() || null,
  }))
}

/**
 * 這筆紀錄有沒有記錄分段時間。**判斷一律走這裡，不在各處自己寫條件。**
 *
 * hold_seconds 可為 NULL，「沒記錄」直接由資料表達：全部都是 null。
 * 停 0 秒是真的 0，與沒記錄不再共用同一個值。
 *
 * 最後一段永遠是 null，所以只有一段的紀錄必然回 false——那一段本來就
 * 沒有下一注可以停。
 */
export function hasStepTiming(rows: Pick<StepRow, 'hold_seconds'>[]): boolean {
  return rows.some(row => row.hold_seconds !== null)
}

/** 資料庫 → 介面。同樣沒有換算，欄位一對一。 */
export function toStepInputs(rows: StepRow[]): StepInput[] {
  return [...rows]
    .sort((a, b) => a.step_index - b.step_index)
    .map(row => ({
      stepType: row.step_type,
      cumulativeWater: row.cumulative_water,
      // numeric 欄位讀回來可能是字串
      holdSeconds: row.hold_seconds === null ? null : Number(row.hold_seconds),
      note: row.note ?? '',
    }))
}

/** 分段模板裡每一段的水量基準（《01-資料庫規格》§3.7） */
export type StepBasis = 'dose' | 'total' | 'remaining'

export interface MethodTemplateStep {
  type: StepType
  basis: StepBasis
  factor: number
  /** 該段的純停水秒數。最後一段沒有下一注，是 null */
  duration: number | null
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
        notice = '粉水比偏低，請確認悶蒸水量是否合理'
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
      // 模板的 duration 是純停水秒數，直接給，不換算
      holdSeconds: step.duration ?? null,
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

/**
 * 手法模板要不要重算這一組分段。
 *
 * 只有一條規則：**段數與模板一致就重算，不一致就不動。**
 * 不一致代表使用者自己增減過段落，結構已經與模板無關。
 *
 * 曾經做過逐段快照、只重算「沒被手動改過」的那幾段。撤掉了：
 * 使用者不記得自己改過哪幾格，也看不到系統記著什麼，
 * 所以每次改粉重的結果他都無法預測，實測起來時有時無。
 * 整組重算偶爾會蓋掉他的修改，但那是他能在腦中模擬的規則。
 *
 * 整組還空白時一律重算——那是「選了手法但粉重晚點才填」的情況，
 * 此時段數本來就還停在預設的兩段。
 */
export function shouldRegenerateSteps(current: StepInput[], templateLength: number): boolean {
  if (current.every(step => step.cumulativeWater === null)) return true
  return current.length === templateLength
}

/**
 * 累積水量遞減的提示。
 *
 * 磅秤上的數字只會往上加，後段小於前段代表填錯了。
 * **只提示不阻擋儲存**，與刻度驗證同一個原則——使用者可能有我們想不到的
 * 記法，擋住輸入的代價高於容忍異常值。
 *
 * 只比對注水段：stir 不注水，它的累積水量與前一段相同是合法的，
 * 不參與比對也不會被標記。相等不提示，只有嚴格遞減才提示。
 *
 * （step_type 的 wait 目前介面不露出；之後若露出，它同樣不注水，
 * 需要比照 stir 排除。）
 */
export function waterOrderHints(steps: StepInput[]): (string | null)[] {
  let previous: number | null = null

  return steps.map((step) => {
    if (step.stepType === 'stir') return null
    if (step.cumulativeWater === null) return null

    const hint = previous !== null && step.cumulativeWater < previous
      ? '填寫磅秤顯示的累積水量'
      : null

    previous = step.cumulativeWater
    return hint
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
