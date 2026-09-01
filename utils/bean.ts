// 豆子表單的欄位型別。放在 utils 讓 Nuxt 自動匯入——
// 元件 <script setup> 匯出的型別不會被自動匯入。
//
// roaster 的介面顯示文案是「咖啡店名」：台灣沒有「烘焙商／烘豆商」這個說法，
// 豆袋上寫的是咖啡店名或自家烘焙店名。資料庫欄位維持 roaster。

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
  is_finished: boolean
}
