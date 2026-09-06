// 產國的洲別分組。
//
// 42 筆平鋪的清單要使用者自己找。分成三洲之後，他先確定「這支是非洲的」
// 再在十來筆裡挑，比在 42 筆裡掃快得多。
//
// 組內順序來自資料庫的 sort_order，那是依**台灣市場的常見度**排的，
// 不是字母序也不是 ISO 碼序——使用者不是在查字典，是在找他手上那包豆子。

export type Continent = 'africa' | 'americas' | 'asia'

export interface CountryOption {
  id: string
  name_zh: string
  name_en: string
  iso_code: string
  continent: Continent
}

/** 分組的顯示順序。與 sort_order 的號段一致（非洲 10–、美洲 100–、亞洲 200–） */
export const CONTINENT_ORDER: readonly Continent[] = ['africa', 'americas', 'asia']

export const CONTINENT_LABELS: Record<Continent, string> = {
  africa: '非洲',
  americas: '美洲',
  asia: '亞洲',
}

export interface ContinentGroup {
  key: Continent
  label: string
  items: CountryOption[]
}

/**
 * 依洲別分組。**傳入的順序就是組內的順序**——呼叫端負責照 sort_order 查，
 * 這裡不重排，否則資料庫上排好的常見度會被前端洗掉。
 *
 * 空的組不回傳：搜尋過濾之後某一洲可能一個都不剩，那時不該留一個空標題。
 */
export function groupByContinent(items: CountryOption[]): ContinentGroup[] {
  return CONTINENT_ORDER
    .map(key => ({
      key,
      label: CONTINENT_LABELS[key],
      items: items.filter(item => item.continent === key),
    }))
    .filter(group => group.items.length > 0)
}

/**
 * 給模糊比對用的形狀。
 *
 * 英文名與 ISO 碼放進 aliases：打「ethiopia」或「ET」都找得到。
 * 產國是純系統表，沒有自建項目，所以 user_id 一律 null。
 */
export function toLookupShape(items: CountryOption[]) {
  return items.map(item => ({
    id: item.id,
    name: item.name_zh,
    aliases: [item.name_en, item.iso_code],
    user_id: null as string | null,
  }))
}
