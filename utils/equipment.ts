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

/** 型錄列的顯示名稱：品牌 型號 版本 */
export function catalogDisplayName(row: CatalogRow) {
  return `${row.brand} ${row.model}${row.variant ? ` ${row.variant}` : ''}`
}

/** 使用者器材的顯示名稱：有型錄就用型錄的名字，否則用自訂名稱 */
export function equipmentOptionName(item: {
  custom_name: string | null
  equipment_catalog: { brand: string, model: string, variant: string | null } | null
}) {
  if (item.equipment_catalog) {
    const c = item.equipment_catalog
    return `${c.brand} ${c.model}${c.variant ? ` ${c.variant}` : ''}`
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
