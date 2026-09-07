// 器材相關的共用邏輯。

export type EquipmentType = 'grinder' | 'dripper' | 'filter' | 'kettle' | 'server'

export const equipmentTypes: EquipmentType[] = ['grinder', 'dripper', 'filter', 'kettle', 'server']

export const equipmentLabels: Record<EquipmentType, string> = {
  grinder: '磨豆機',
  dripper: '濾杯',
  filter: '濾紙',
  kettle: '手沖壺',
  server: '分享壺',
}

/**
 * 刻度規格（《01-資料庫規格》§3.2 的四欄制）。
 *
 * 刻度系統不是「有段／無段」的二分，而是範圍與精度兩個獨立維度：
 *   increment  null = 連續無段；否則是最小刻度間隔
 *   max        null = 無上限
 *   三者皆 null = 面板完全沒有刻度標示
 */
export interface GrindScaleSpec {
  min: number | null
  max: number | null
  increment: number | null
  suggestedMin: number | null
  suggestedMax: number | null
  note: string | null
}

export const emptyGrindScale: GrindScaleSpec = {
  min: null, max: null, increment: null, suggestedMin: null, suggestedMax: null, note: null,
}

/** 面板完全無刻度標示（型錄中只有楊家小飛馬 500N 屬於這種） */
export function isFreeformScale(spec: GrindScaleSpec) {
  return spec.min === null && spec.max === null && spec.increment === null
}

// 0.1 這種間隔用 % 會踩到浮點誤差（12.3 % 0.1 不等於 0），改用比值判斷
function isMultipleOf(value: number, increment: number) {
  if (increment <= 0) return true
  const ratio = value / increment
  return Math.abs(ratio - Math.round(ratio)) < 1e-6
}

/**
 * 刻度驗證。**回傳的一律是提示，呼叫端不得用它阻擋儲存。**
 * 使用者可能改裝、可能記錯、可能用型錄未涵蓋的方式讀數。
 */
export function grindScaleHints(value: number | null, spec: GrindScaleSpec): string[] {
  if (value === null || Number.isNaN(value)) return []
  const hints: string[] = []

  if (spec.min !== null && value < spec.min) hints.push(`這台的刻度從 ${spec.min} 開始`)
  // max 為 null 代表無上限，不做上限檢查（Niche Zero 超過 50 仍可繼續轉）
  if (spec.max !== null && value > spec.max) hints.push(`這台的刻度到 ${spec.max} 為止`)
  // increment 為 null 代表連續無段，不檢查倍數，但範圍檢查照常
  if (spec.increment !== null && !isMultipleOf(value, spec.increment)) {
    hints.push(spec.increment === 1 ? '這台只能停在整數格' : `這台的最小間隔是 ${spec.increment}`)
  }
  return hints
}

/** 輸入框旁顯示的範圍，例如「1–16」「0 以上」 */
export function grindScaleRangeLabel(spec: GrindScaleSpec) {
  if (spec.min === null && spec.max === null) return null
  if (spec.max === null) return `${spec.min} 以上`
  if (spec.min === null) return `${spec.max} 以下`
  return `${spec.min}–${spec.max}`
}

/** 實用範圍提示，服務不知道從哪裡起步的新手。留空則不顯示。 */
export function grindScaleSuggestionLabel(spec: GrindScaleSpec) {
  if (spec.suggestedMin === null || spec.suggestedMax === null) return null
  return `手沖常用 ${spec.suggestedMin}–${spec.suggestedMax}`
}

/** 依 increment 決定輸入框的 step 與可接受的小數位 */
export function grindScaleStep(spec: GrindScaleSpec) {
  return spec.increment ?? 'any'
}

/** 器材型錄的一列。放在 utils 讓 Nuxt 自動匯入。 */
export interface CatalogRow {
  id: string
  brand: string
  model: string
  variant: string | null
  grind_scale_min: number | null
  grind_scale_max: number | null
  grind_scale_increment: number | null
  grind_scale_suggested_min: number | null
  grind_scale_suggested_max: number | null
  grind_scale_note: string | null
}

/**
 * 型錄列的顯示名稱：`Hario · V60 02`。
 *
 * 中點把品牌與型號分開，讓品牌看得見但不必為它多開一層分組——
 * 型錄只有數十筆，分組的瀏覽成本高於它省下的辨識成本。
 * 中點兩側留空格：`Hario·V60` 在中文字型裡會黏在一起。
 */
export function catalogDisplayName(row: CatalogRow) {
  return `${row.brand} · ${row.model}${row.variant ? ` ${row.variant}` : ''}`
}

/**
 * 使用者器材的顯示名稱：有型錄就用型錄的名字，否則用自訂名稱。
 * 刻意共用 catalogDisplayName，兩處各寫一份格式會慢慢分岔。
 */
export function equipmentOptionName(item: {
  custom_name: string | null
  equipment_catalog: { brand: string, model: string, variant: string | null } | null
}) {
  if (item.equipment_catalog) {
    return catalogDisplayName(item.equipment_catalog as CatalogRow)
  }
  return item.custom_name ?? '未命名器材'
}

/** 沖煮表單用的使用者器材（含型錄的刻度規格）。放在 utils 讓 Nuxt 自動匯入。 */
export interface EquipmentOption {
  id: string
  type: EquipmentType
  custom_name: string | null
  is_default: boolean
  catalog_id: string | null
  equipment_catalog: {
    brand: string
    model: string
    variant: string | null
    grind_scale_min: number | null
    grind_scale_max: number | null
    grind_scale_increment: number | null
    grind_scale_suggested_min: number | null
    grind_scale_suggested_max: number | null
    grind_scale_note: string | null
  } | null
}

// ══════════════════════════════════════════════════════════════
// 上次使用時間
// ══════════════════════════════════════════════════════════════

const SMALL_NUMBERS = ['', '一', '兩', '三', '四', '五', '六', '七', '八', '九', '十', '十一']

/** 二、三這種小數字用國字讀起來自然；超過十就用阿拉伯數字 */
function count(n: number) {
  return SMALL_NUMBERS[n] ?? String(n)
}

/**
 * 上次使用時間，相對表示。
 *
 * **刻意不顯示絕對日期。** 使用者要的是「這台最近有在用嗎」，
 * 「2026/07/14」得先在腦中減一次才回答得了這個問題。
 *
 * 從沒用過回 null，呼叫端留空即可——不要顯示「從未使用」，
 * 那是解釋現況（《03》§5.6）。
 *
 * 尺度刻意粗：兩年前與兩年又三個月前的差別，對「要不要用這台」沒有影響。
 */
export function relativeUsed(iso: string | null | undefined, now: Date = new Date()): string | null {
  if (!iso) return null
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return null

  // 以「日」為單位比較，不是以 24 小時為單位：
  // 昨天 23:00 到今天 01:00 只差兩小時，但使用者說的是「昨天」。
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.floor((startOfDay(now) - startOfDay(then)) / 86_400_000)

  if (days < 0) return null // 未來的時間，資料有問題，不猜
  if (days === 0) return '今天用過'
  if (days === 1) return '昨天用過'
  if (days < 7) return `${count(days)}天前用過`
  if (days < 14) return '上週用過'
  if (days < 30) return `${count(Math.floor(days / 7))}週前用過`
  if (days < 60) return '上個月用過'

  // 月份上限是十一：滿十二個月就該說「一年前」，
  // 不是「12 個月前」——後者要讀的人自己換算一次。
  const months = Math.floor(days / 30)
  if (months < 12) return `${count(months)}個月前用過`

  const years = Math.floor(days / 365)
  return years <= 1 ? '一年前用過' : `${count(years)}年前用過`
}

/**
 * 從沖煮紀錄反查每一台器材最後出現的時間。
 *
 * user_equipment 沒有這個欄位，也不該有——它是衍生值（《01》§8）。
 *
 * **一次抓回全部再在前端配對**，不要逐台查：五個類型、每個類型數台，
 * 逐台查就是十幾趟來回。傳入的列必須已依 brewed_at 由新到舊排序，
 * 每個 id 第一次出現的那筆就是最後一次使用。
 */
export function lastUsedFromBrews(
  rows: Record<string, string | null>[],
  columns: string[],
): Map<string, string> {
  const used = new Map<string, string>()
  for (const row of rows) {
    const brewedAt = row.brewed_at
    if (!brewedAt) continue
    for (const column of columns) {
      const id = row[column]
      if (id && !used.has(id)) used.set(id, brewedAt)
    }
  }
  return used
}

/** 五個器材類型對應到 brews 上的欄位 */
export const EQUIPMENT_COLUMNS = ['grinder_id', 'dripper_id', 'filter_id', 'kettle_id', 'server_id']
