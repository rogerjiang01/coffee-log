// 沖煮表單的型別。放在 utils 讓 Nuxt 自動匯入。

/** 四個維度皆為 1–5 的整數，皆可省略（§3.5） */
export interface Intensity {
  acidity?: number
  sweetness?: number
  body?: number
  bitterness?: number
}

/** 強度的四個維度：名稱與順序。表單（IntensityPicker）與唯讀的顯示（IntensityDisplay）共用 */
export const INTENSITY_DIMENSIONS: { key: keyof Intensity, label: string }[] = [
  { key: 'acidity', label: '酸質' },
  { key: 'sweetness', label: '甜感' },
  { key: 'body', label: '醇厚' },
  { key: 'bitterness', label: '苦味' },
]

export interface BrewFormValues {
  bean_id: string | null
  brew_method_id: string | null
  dose: number | null
  water_temp: number | null
  grinder_id: string | null
  grind_setting: number | null
  dripper_id: string | null
  kettle_id: string | null
  filter_id: string | null
  server_id: string | null
  total_time: number | null
  brewed_at: string
  rating: number | null
  is_favorite: boolean
  tasting_notes: string
  intensity: Intensity
}

/** datetime-local 需要本地時間字串；資料庫存 UTC，轉換在前端完成（§0.7） */
export function toLocalInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function fromLocalInput(value: string): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}
