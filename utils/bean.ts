// 豆子表單的欄位型別。放在 utils 讓 Nuxt 自動匯入——
// 元件 <script setup> 匯出的型別不會被自動匯入。
//
// roaster 的介面顯示文案是「咖啡店名」：台灣沒有「烘焙商／烘豆商」這個說法，
// 豆袋上寫的是咖啡店名或自家烘焙店名。資料庫欄位維持 roaster。
//
// region 是自由文字不是查表（《01》§3.4）：產區是開放集合，收不完，
// 且翻譯歧異嚴重（耶加雪菲／耶加雪夫／Yirgacheffe），用查表會失控。

import { restDayLabel, restDays } from './roast.ts'

export interface BeanFormValues {
  name: string
  roaster: string
  roast_date: string
  roast_level: RoastLevel | null
  country_id: string | null
  region: string
  processing_method_id: string | null
  variety_id: string | null
  official_notes: string
}

/**
 * 豆子列表第二行的養豆（2026-11-27，《03》§4.5.2）：寫法照 restDayLabel（「養豆第 N 天」、0 是「烘焙當天」），
 * 算不出來就不顯示。**已喝完的豆子不顯示**，和豆子詳情一致（《04》「養豆天數」）。
 */
export function beanListRest(roastDate: string | null | undefined, isFinished: boolean, now: Date = new Date()): string | null {
  if (isFinished) return null
  return restDayLabel(restDays(roastDate, now))
}

/**
 * 豆子列表每一列的無障礙名稱：看得到的文字全部在裡面（WCAG 2.5.3），用「，」隔開讓報讀停頓。
 * 連結通往豆子詳情，不是編輯，所以開頭不加動詞（器材列表的開頭是「編輯」，equipmentRowLabel）
 */
export function beanRowLabel(parts: { name: string, roaster: string | null, rest: string | null }): string {
  return [parts.name, parts.roaster?.trim() || null, parts.rest].filter(Boolean).join('，')
}
