// 器材相關的共用邏輯。

import { toError } from './errorMessage.ts'

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
 *
 * **型別允許 undefined，判斷一律走 unset()。** 值是從查詢結果拼出來的，
 * 而缺欄位的查詢結果給的是 undefined 不是 null：`=== null` 會判成
 * 「有這個值」，於是提示變成「這台的最小間隔是 undefined」、
 * 範圍顯示「刻度 undefined–undefined」。實際發生過一次（見 utils/cacheKeys.ts
 * 的欄位集合檢查），來源是 equipment:all 這個 key 被兩種欄位的查詢共用。
 * 那個來源已經收斂成單一查詢定義，這裡的寬鬆判斷是第二道防線——
 * 這種壞法不會報錯，只會把 undefined 印在使用者臉上。
 */
type ScaleValue = number | null | undefined

export interface GrindScaleSpec {
  min: ScaleValue
  max: ScaleValue
  increment: ScaleValue
  suggestedMin: ScaleValue
  suggestedMax: ScaleValue
  note: string | null | undefined
}

/** 沒有這個值：null（型錄明講沒有）與 undefined（查詢沒帶這個欄位）都算 */
export function unset(value: ScaleValue | string | null | undefined): boolean {
  return value === null || value === undefined
}

export const emptyGrindScale: GrindScaleSpec = {
  min: null, max: null, increment: null, suggestedMin: null, suggestedMax: null, note: null,
}

/** 面板完全無刻度標示（型錄中只有楊家小飛馬 500N 屬於這種） */
export function isFreeformScale(spec: GrindScaleSpec) {
  return unset(spec.min) && unset(spec.max) && unset(spec.increment)
}

// 0.1 這種間隔用 % 會踩到浮點誤差（12.3 % 0.1 不等於 0），改用比值判斷
function isMultipleOf(value: number, increment: number) {
  if (increment <= 0) return true
  const ratio = value / increment
  return Math.abs(ratio - Math.round(ratio)) < 1e-6
}

/**
 * 刻度提示。**回傳的一律是提示，呼叫端不得用它阻擋儲存。**
 * 使用者可能改裝、可能記錯、可能用型錄未涵蓋的方式讀數。
 *
 * 一次只回一則，而且**超出範圍優先於間隔不符**：兩者同時成立時
 * （例如 1–8、半格定位的機器填了 87.3），先講範圍。範圍是「你可能看錯行了」，
 * 間隔只是「這台停不到那個位置」——前者才是使用者需要先確認的那件事，
 * 兩則一起出現只會讓他兩則都不讀。
 *
 * kind 決定呈現方式（《03》§4.1 的三層）：
 *   range      針對輸入值出現，接在參考資訊那一行後面，用 --notice
 *   increment  維持原樣：獨立一行、--text-muted
 */
export type GrindNoticeKind = 'range' | 'increment'

export interface GrindNotice {
  kind: GrindNoticeKind
  text: string
}

export function grindScaleNotice(value: number | null, spec: GrindScaleSpec): GrindNotice | null {
  if (value === null || Number.isNaN(value)) return null

  // max 為 null 代表無上限，不做上限檢查（Niche Zero 超過 50 仍可繼續轉）
  if (!unset(spec.max) && value > spec.max!) return { kind: 'range', text: '超出磨豆機刻度範圍' }
  if (!unset(spec.min) && value < spec.min!) return { kind: 'range', text: '低於磨豆機刻度範圍' }

  // increment 為 null 代表連續無段，不檢查倍數，但範圍檢查照常
  if (!unset(spec.increment) && !isMultipleOf(value, spec.increment!)) {
    // 整數格機型也用同一句：間隔的數字就寫在同一行左邊（「最小間隔 1」），
    // 提示只需要說這個值對不上
    return { kind: 'increment', text: '不符最小間隔' }
  }
  return null
}

/** 輸入框旁顯示的範圍，例如「1–16」「0 以上」 */
export function grindScaleRangeLabel(spec: GrindScaleSpec) {
  if (unset(spec.min) && unset(spec.max)) return null
  if (unset(spec.max)) return `${spec.min} 以上`
  if (unset(spec.min)) return `${spec.max} 以下`
  return `${spec.min}–${spec.max}`
}

/** 實用範圍提示，服務不知道從哪裡起步的新手。留空則不顯示。 */
export function grindScaleSuggestionLabel(spec: GrindScaleSpec) {
  if (unset(spec.suggestedMin) || unset(spec.suggestedMax)) return null
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

// ══════════════════════════════════════════════════════════════
// user_equipment 的唯一查詢定義
// ══════════════════════════════════════════════════════════════
//
// **欄位集合集中在這裡，三個呼叫端（器材管理頁、沖煮表單、器材選擇器）
// 都用同一份。** 之前器材管理頁只取 `equipment_catalog ( brand, model,
// variant )`，沖煮表單另外取了六個 grind_scale_* 欄位，兩者卻共用
// `equipment:all` 這個快取 key——先開器材管理頁再進沖煮表單，
// 刻度規格全部是 undefined，範圍提示變成「刻度 undefined–undefined」，
// 沒有錯誤、沒有 console 訊息，背景重新驗證回來才自己好。
//
// 收斂成一份的代價是器材管理頁多拿六個用不到的欄位（每列幾十 bytes，
// 器材撐死幾十台）。那比「兩份欄位集合慢慢分岔」便宜太多。
//
// 加欄位時只改這裡，順便確認 UserEquipmentRow 也跟著加。

/**
 * 型錄的欄位。**這張表存在的唯一目的是讓刻度可以被正確解讀**（《01》§3.2），
 * 所以刻度那六個欄位缺一不可——少拿一個，前端就少一種提示而且不會報錯。
 */
const CATALOG_COLUMNS = [
  'brand', 'model', 'variant',
  'grind_scale_min', 'grind_scale_max', 'grind_scale_increment',
  'grind_scale_suggested_min', 'grind_scale_suggested_max', 'grind_scale_note',
]

/** 型錄表自己的查詢（器材表單的型號選單）。比內嵌時多一個 id */
export const EQUIPMENT_CATALOG_SELECT = ['id', ...CATALOG_COLUMNS].join(', ')

export const USER_EQUIPMENT_SELECT
  = `id, catalog_id, type, custom_name, is_default, is_sample, note, equipment_catalog ( ${CATALOG_COLUMNS.join(', ')} )`

/** USER_EQUIPMENT_SELECT 回傳的一列。放在 utils 讓 Nuxt 自動匯入。 */
export interface UserEquipmentRow {
  id: string
  catalog_id: string | null
  type: EquipmentType
  custom_name: string | null
  is_default: boolean
  /** 註冊時自動建立的範例器材（《01》§13）。只多一個標籤，其他行為完全相同 */
  is_sample: boolean
  note: string | null
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

/**
 * 器材列表的排序：常用在前，再依建立時間，最後用 id 當決勝鍵。
 * 跟欄位集合一樣只寫一次——三個地方各寫一份，遲早有一處漏掉決勝鍵，
 * 然後同一批資料在不同頁面排出不同順序。
 */
export function orderUserEquipment<T extends {
  order: (column: string, options?: { ascending?: boolean }) => T
}>(query: T): T {
  return query
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
}

/** 從器材列拼出刻度規格。欄位名稱的對應只寫一次。 */
export function grindScaleOf(catalog: UserEquipmentRow['equipment_catalog'] | CatalogRow | null | undefined): GrindScaleSpec {
  if (!catalog) return emptyGrindScale
  return {
    min: catalog.grind_scale_min,
    max: catalog.grind_scale_max,
    increment: catalog.grind_scale_increment,
    suggestedMin: catalog.grind_scale_suggested_min,
    suggestedMax: catalog.grind_scale_suggested_max,
    note: catalog.grind_scale_note,
  }
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

/** 器材表單（/equipment/new、/equipment/[id]/edit）的值 */
export interface EquipmentFormValues {
  type: EquipmentType
  catalog_id: string | null
  custom_name: string
  note: string
  is_default: boolean
}

/**
 * 每個類型只能有一台常用（DB 有 partial unique index，欄位名仍是 is_default）。
 * 設新的常用之前先把同類型的既有常用清掉，否則會撞上唯一約束，
 * 把資料庫層的錯誤訊息丟到使用者面前。編輯時 exceptId 是正在編輯的那一台。
 */
export async function clearDefaultEquipment(
  supabase: { from: (table: string) => any },
  userId: string,
  type: EquipmentType,
  exceptId?: string,
) {
  let request = supabase
    .from('user_equipment')
    .update({ is_default: false })
    .eq('user_id', userId)
    .eq('type', type)
    .eq('is_default', true)
  if (exceptId) request = request.neq('id', exceptId)
  const { error } = await request
  if (error) throw toError(error)
}
