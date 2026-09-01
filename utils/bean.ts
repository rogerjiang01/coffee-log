// 豆子表單的欄位型別。放在 utils 讓 Nuxt 自動匯入——
// 元件 <script setup> 匯出的型別不會被自動匯入。

export interface BeanFormValues {
  name: string
  roaster: string
  roast_date: string
  roast_level: RoastLevel | null
  country_id: string | null
  region_id: string | null
  processing_method_id: string | null
  variety_id: string | null
  official_notes: string
}
