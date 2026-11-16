// 和比較對象的差異（《01-資料庫規格》§8、《02-功能規格》§7）。
// 比較對象怎麼選見 utils/compareTarget.ts。
//
// **不存進資料庫，一律即時計算。** 存下來會在來源紀錄被編輯時失準。
//
// **兩邊都有值才比較，一邊沒填就略過**（2026-10-06 決定）。比較對象不一定是複製來源了——
// 同一支豆子的上一杯可能只記了粉重，列出一排「沒填 → 92 °C」只是在說兩筆記得詳細程度不同，
// 不是使用者做了調整。
//
// 比對範圍僅限以下欄位，其餘不比對：
//   dose、water_temp、grind_setting、grinder_id、dripper_id、kettle_id、
//   brew_method_id、total_time，以及 brew_steps 的整體結構
//   （段數、各段累積水量、各段時間點）。
//
// 這個功能的意義：使用者不需要多做任何事，只是照原本的動線複製、改數字、
// 儲存，系統就在背後留下他的調整軌跡。

export interface BrewDiff {
  field: string
  label: string
  before: string
  after: string
}

/** 比對用的一筆紀錄。名稱欄位供顯示，id 欄位供比對。 */
export interface DiffSubject {
  dose: number | null
  water_temp: number | null
  grind_setting: number | null
  total_time: number | null
  grinder_id: string | null
  dripper_id: string | null
  kettle_id: string | null
  brew_method_id: string | null
  grinderName: string | null
  dripperName: string | null
  kettleName: string | null
  methodName: string | null
  steps: StepRow[]
}

function num(value: number | null, unit = '') {
  if (value === null) return '沒填'
  // numeric 欄位讀回來可能是 15.0，去掉無意義的尾數
  const text = String(Number(value))
  return unit ? `${text}${unit}` : text
}

function name(value: string | null) {
  return value ?? '沒填'
}

function sortedSteps(steps: StepRow[]) {
  return [...steps].sort((a, b) => a.step_index - b.step_index)
}

/**
 * 各段停水時長的顯示字串。資料庫存的就是這個數字，不必反推。
 * 最後一段永遠沒有停留（沒有下一注），尾端的空值不列出來。
 */
function holdSecondsText(steps: StepRow[]) {
  const values = steps.map(step => step.hold_seconds)
  while (values.length && values.at(-1) === null) values.pop()
  return values.map(value => (value === null ? '—' : value)).join(' / ')
}

export function computeBrewDiff(after: DiffSubject, before: DiffSubject): BrewDiff[] {
  const diffs: BrewDiff[] = []

  const push = (field: string, label: string, b: string, a: string) => {
    if (b !== a) diffs.push({ field, label, before: b, after: a })
  }
  const both = (b: unknown, a: unknown) => b !== null && b !== undefined && a !== null && a !== undefined

  if (both(before.dose, after.dose)) push('dose', '粉重', num(before.dose, ' g'), num(after.dose, ' g'))
  if (both(before.water_temp, after.water_temp)) push('water_temp', '水溫', num(before.water_temp, ' °C'), num(after.water_temp, ' °C'))
  if (both(before.grind_setting, after.grind_setting)) push('grind_setting', '研磨刻度', num(before.grind_setting), num(after.grind_setting))

  // 器材與手法比對 id，顯示名稱——同名的不同筆器材仍是不同器材
  const equipment = [
    ['grinder_id', '磨豆機', before.grinder_id, after.grinder_id, before.grinderName, after.grinderName],
    ['dripper_id', '濾杯', before.dripper_id, after.dripper_id, before.dripperName, after.dripperName],
    ['kettle_id', '手沖壺', before.kettle_id, after.kettle_id, before.kettleName, after.kettleName],
    ['brew_method_id', '沖煮手法', before.brew_method_id, after.brew_method_id, before.methodName, after.methodName],
  ] as const
  for (const [field, label, b, a, bName, aName] of equipment) {
    if (both(b, a) && b !== a) diffs.push({ field, label, before: name(bName), after: name(aName) })
  }

  if (both(before.total_time, after.total_time)) {
    push('total_time', '沖煮時間', secondsToClock(before.total_time!), secondsToClock(after.total_time!))
  }

  // 分段結構：段數、各段累積水量、各段停水時長，三者分開列。一邊沒有分段就整組略過
  const beforeSteps = sortedSteps(before.steps)
  const afterSteps = sortedSteps(after.steps)
  if (!beforeSteps.length || !afterSteps.length) return diffs

  push('step_count', '段數', `${beforeSteps.length} 段`, `${afterSteps.length} 段`)

  const waterBefore = beforeSteps.map(step => Number(step.cumulative_water)).join(' / ')
  const waterAfter = afterSteps.map(step => Number(step.cumulative_water)).join(' / ')
  push('step_water', '各段累積水量', waterBefore, waterAfter)

  // 分段時間是可選的進階參數（分段注水區的「記錄停水時長」預設關閉），
  // 沒記錄的 hold_seconds 全是 null。兩邊都有記錄才比對
  if (hasStepTiming(beforeSteps) && hasStepTiming(afterSteps)) {
    push('step_time', '各段停水時長', holdSecondsText(beforeSteps), holdSecondsText(afterSteps))
  }

  return diffs
}

/**
 * 評分那一列（紀錄詳情與結算頁）。兩邊都有評分才有，相同也列出——
 * 「參數和 M/D 那一杯相同」時，評分那一列照樣顯示。它不是參數，不算進「有改參數」。
 */
export function ratingDiff(before: number | null | undefined, after: number | null | undefined): BrewDiff | null {
  if (before === null || before === undefined || after === null || after === undefined) return null
  return { field: 'rating', label: '評分', before: String(before), after: String(after) }
}
