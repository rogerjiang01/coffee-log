// 相對上一版的差異（《01-資料庫規格》§8、《02-功能規格》§7）。
//
// **不存進資料庫，一律即時計算。** 存下來會在來源紀錄被編輯時失準。
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
 * 各段停留秒數的顯示字串。資料庫存的就是這個數字，不必反推。
 * 沒有分段是「沒填」；有分段但沒記錄時間是「沒記錄」。
 * 最後一段永遠沒有停留（沒有下一注），尾端的空值不列出來。
 */
function holdSecondsText(steps: StepRow[]) {
  if (!steps.length) return '沒填'
  if (!hasStepTiming(steps)) return '沒記錄'
  const values = steps.map(step => step.hold_seconds)
  while (values.length && values.at(-1) === null) values.pop()
  return values.map(value => (value === null ? '—' : value)).join(' / ')
}

export function computeBrewDiff(after: DiffSubject, before: DiffSubject): BrewDiff[] {
  const diffs: BrewDiff[] = []

  const push = (field: string, label: string, b: string, a: string) => {
    if (b !== a) diffs.push({ field, label, before: b, after: a })
  }

  push('dose', '粉重', num(before.dose, ' g'), num(after.dose, ' g'))
  push('water_temp', '水溫', num(before.water_temp, ' °C'), num(after.water_temp, ' °C'))
  push('grind_setting', '研磨刻度', num(before.grind_setting), num(after.grind_setting))

  // 器材與手法比對 id，顯示名稱——同名的不同筆器材仍是不同器材
  if (before.grinder_id !== after.grinder_id) {
    diffs.push({ field: 'grinder_id', label: '磨豆機', before: name(before.grinderName), after: name(after.grinderName) })
  }
  if (before.dripper_id !== after.dripper_id) {
    diffs.push({ field: 'dripper_id', label: '濾杯', before: name(before.dripperName), after: name(after.dripperName) })
  }
  if (before.kettle_id !== after.kettle_id) {
    diffs.push({ field: 'kettle_id', label: '手沖壺', before: name(before.kettleName), after: name(after.kettleName) })
  }
  if (before.brew_method_id !== after.brew_method_id) {
    diffs.push({ field: 'brew_method_id', label: '沖煮手法', before: name(before.methodName), after: name(after.methodName) })
  }

  push(
    'total_time', '總沖煮時間',
    before.total_time === null ? '沒填' : secondsToClock(before.total_time),
    after.total_time === null ? '沒填' : secondsToClock(after.total_time),
  )

  // 分段結構：段數、各段累積水量、各段停留秒數，三者分開列
  const beforeSteps = sortedSteps(before.steps)
  const afterSteps = sortedSteps(after.steps)

  push('step_count', '段數', `${beforeSteps.length} 段`, `${afterSteps.length} 段`)

  const waterBefore = beforeSteps.map(step => Number(step.cumulative_water)).join(' / ')
  const waterAfter = afterSteps.map(step => Number(step.cumulative_water)).join(' / ')
  push('step_water', '各段水量', waterBefore || '沒填', waterAfter || '沒填')

  // 兩邊都沒記錄分段時間就不比對：分段時間是可選的進階參數（分段注水區的
  // 「記錄停水時間」預設關閉），沒記錄的 hold_seconds 全是 null，
  // 比出來只會是一排空值。只有一邊有記錄時照常列出，另一邊顯示「沒記錄」。
  if (hasStepTiming(beforeSteps) || hasStepTiming(afterSteps)) {
    push('step_time', '各段停留秒數', holdSecondsText(beforeSteps), holdSecondsText(afterSteps))
  }

  return diffs
}
