// 客戶端快取的 key 規則與失效對應。
//
// 抽成純函式是刻意的：**失效漏掉一條的後果是使用者看到不一致的畫面，
// 而那種 bug 極難重現**——存完紀錄回首頁少一筆，重新整理又正常了。
// 放在這裡才有辦法用測試把每一條對應關係釘住。
//
// key 一律是「命名空間:細節」。同一個命名空間下的東西一起失效，
// 所以命名空間的切法就是失效的粒度。

export const cacheKeys = {
  /** 豆子列表頁：含已喝完 */
  beanList: () => 'beans:list',
  /** 首頁上區：只有未喝完 */
  beanActive: () => 'beans:active',
  bean: (id: string) => `beans:item:${id}`,
  /** 沖煮表單的豆子選單。欄位與列表頁不同，所以是獨立的 key */
  beanOptions: () => 'beans:options',

  /** 時間軸的一頁。from 是 range 起點 */
  brewPage: (from: number) => `brews:page:${from}`,
  brew: (id: string) => `brews:item:${id}`,
  brewSteps: (id: string) => `brews:steps:${id}`,
  brewTags: (id: string) => `brews:tags:${id}`,
  /** 某支豆子的全部紀錄。豆子詳情的次數統計與比較表都靠它 */
  brewsByBean: (beanId: string) => `brews:bean:${beanId}`,
  /** 首頁豆子卡片的沖煮次數與收藏次數 */
  brewCounts: () => 'brews:counts',

  equipment: (type: string) => `equipment:${type}`,
  /**
   * 每台器材最後一次被用到的時間。從 brews 反查，所以放在 brews: 底下——
   * 新增或刪除紀錄都會改變它，掛在 equipment: 底下就不會被清掉。
   */
  equipmentLastUsed: () => 'brews:equipment-last-used',
  equipmentAll: () => 'equipment:all',

  lookup: (table: string) => `lookup:${table}`,

  /**
   * 豆袋照片的簽名網址，掛在 photo_path 上。
   *
   * **刻意不放在 beans: 底下。** 豆子的任何寫入都會清掉 beans:*，
   * 但那不影響照片網址是否有效——放進去的話每改一次豆名，
   * 列表上所有照片的網址都要重新產生，瀏覽器快取又全部失效。
   * 真正會讓網址失效的只有換照片與刪照片，由 useBeanPhotos 明確清掉。
   *
   * 這一格不走 useQueryCache 的 SWR：過期的網址不能先拿來用再背景換新，
   * 那樣畫面會先出現一張裂圖。見 utils/photoUrlCache.ts。
   */
  photoUrl: (path: string) => `photo-url:${path}`,

  /**
   * 使用者偏好（profiles 的偏好欄位，目前只有 record_step_times）。
   * 沒有任何寫入事件需要清它：唯一的寫入點是分段注水區的切換入口，存成功後直接覆寫這一格。
   */
  profilePrefs: () => 'profile:prefs',
}

/** 寫入事件。欄位只放「決定要失效什麼」需要的資訊 */
export type Mutation =
  | { kind: 'brew' }
  | { kind: 'bean' }
  | { kind: 'bean-finished' }
  | { kind: 'equipment' }
  | { kind: 'lookup', table: string }

/**
 * 一次寫入要清掉哪些快取。回傳的是**樣式**，結尾的 `*` 代表前綴比對。
 *
 * 幾個判斷要說明：
 *
 * **沖煮紀錄一動就清掉整個 `brews:`。** 看起來太粗，但差異區塊讓它變得
 * 必要：某筆紀錄的差異是拿它與來源比出來的，所以編輯 X 會改變所有
 * 「複製自 X」的紀錄要顯示的差異。我們沒辦法便宜地列出誰複製了 X，
 * 而漏掉的後果是差異顯示錯誤的數字——那比多發幾次查詢嚴重得多。
 * 代價只是下次打開別筆紀錄時多一趟來回。
 *
 * **動到豆子就要一起清 `brews:`**，刪除與編輯都是，理由不同：
 * 刪除是因為外鍵 cascade，紀錄會跟著消失（確認對話框上就寫著「連同這支
 * 豆子的 N 筆紀錄一起刪掉」），不清的話時間軸會留著已經不存在的紀錄。
 * 編輯是因為豆子的欄位被**內嵌在沖煮查詢裡**——時間軸帶 `beans(name)`，
 * 紀錄詳情帶 `beans(id, name, roast_date)`，而養豆天數是拿 roast_date
 * 算出來的。改豆名或烘焙日期而不清 `brews:`，時間軸會顯示舊豆名、
 * 詳情頁會顯示錯的養豆天數。
 *
 * **但「已喝完」不必清 `brews:`**：is_finished 沒有被內嵌到任何沖煮查詢，
 * 它只影響豆子列表的分組與首頁上區的收錄。
 *
 * **已喝完與編輯豆子清一樣的東西**：它同時影響列表的分組、首頁上區
 * 的收錄與詳情頁自己的狀態，三個都在 `beans:` 底下。
 */
export function invalidationsFor(mutation: Mutation): string[] {
  switch (mutation.kind) {
    case 'brew':
      // brews:page:*（時間軸）、brews:item:*、brews:steps:*、
      // brews:bean:*（比較表與次數）、brews:counts 全在這個前綴底下
      return ['brews:*']

    case 'bean':
      return ['beans:*', 'brews:*']

    case 'bean-finished':
      return ['beans:*']

    case 'equipment':
      return ['equipment:*']

    case 'lookup':
      return [cacheKeys.lookup(mutation.table)]
  }
}

/** `*` 結尾是前綴比對，其餘要完全相同 */
export function matchesPattern(key: string, pattern: string): boolean {
  return pattern.endsWith('*')
    ? key.startsWith(pattern.slice(0, -1))
    : key === pattern
}

// ══════════════════════════════════════════════════════════════
// 同一個 key 的欄位集合必須一致
// ══════════════════════════════════════════════════════════════
//
// **一個 key 只能對應一種查詢。** 兩個元件用同一個 key 但 select 的欄位
// 不同時，誰先跑誰決定快取內容，後到的那個會拿到缺欄位的資料。
//
// 這件事實際發生過：BeanForm 用 'countries' 只查 id 與 name_zh，
// CountrySelect 需要 continent 與英文名。若 BeanForm 先跑，
// CountrySelect 拿到的每一筆都沒有 continent，洲別分組會把它們全部
// 過濾掉，畫面顯示「找不到相符的」——**沒有例外、沒有 console 訊息，
// 只是一份空清單**。那次是把查詢整個移進 CountrySelect 解決的。
//
// 兩條規則：
//   1. 需要不同欄位就用不同的 key（例如 'countries:options'）
//   2. 或者把查詢收斂到單一元件，讓那個 key 只有一個來源
//
// 下面的檢查只在開發模式跑：記住每個 key 第一次拿到的欄位集合，
// 之後對不上就在 console 警告。比對的是**回傳的欄位**而不是 select
// 字串——實際會壞掉的是欄位，而不是怎麼寫的。
//
// **內嵌關聯要一起比。** 第一版只看最外層的欄位名，結果漏掉了實際發生的
// 第二次：器材管理頁與沖煮表單都查 `equipment_catalog ( … )`，最外層
// 七個欄位一模一樣，差別全在內嵌那一層——一邊只有 brand/model/variant，
// 另一邊多六個 grind_scale_*。檢查說沒事，畫面上印出「刻度 undefined–undefined」。
// 所以 describeShape 會遞迴進內嵌物件，寫成 `equipment_catalog(brand,model)`。

const shapes = new Map<string, ShapeTree>()

// 只看前面幾列就夠：需要的只是「某個內嵌欄位長什麼樣」的一個代表值。
// 全掃的話時間軸那種上千列的查詢每次重新驗證都要走一遍。
// 代價是前 20 列的內嵌關聯剛好都是 null 時判不出來——那與空陣列同類，
// 一律當作「無從判斷」跳過，不誤報。
const SAMPLE_ROWS = 20

/**
 * 取一筆代表列的欄位集合，內嵌關聯遞迴展開成 `欄位(子欄位,子欄位)`。
 * 陣列取前幾列；取不到任何物件就是無從判斷，回 null。
 */
export function describeShape(data: unknown): string | null {
  return describeRows(Array.isArray(data) ? data.slice(0, SAMPLE_ROWS) : [data])
}

function describeRows(values: unknown[]): string | null {
  const rows = values.filter(
    (value): value is Record<string, unknown> =>
      !!value && typeof value === 'object' && !Array.isArray(value),
  )
  if (!rows.length) return null

  const keys = Object.keys(rows[0]!)
  if (!keys.length) return null

  return keys.slice().sort().map((key) => {
    // 內嵌關聯可能是單筆（物件）或多筆（陣列），也可能整欄都是 null。
    // 純量值在 describeRows 裡會被濾掉，回 null，於是只留欄位名。
    const nested = describeRows(rows.flatMap(row => (Array.isArray(row[key]) ? row[key] as unknown[] : [row[key]])))
    return nested ? `${key}(${nested})` : key
  }).join(',')
}

/** 欄位樹。值為 null 代表「不知道底下長怎樣」：純量，或這次取樣全是 null 的內嵌 */
type ShapeTree = Map<string, ShapeTree | null>

function parseShape(shape: string): ShapeTree {
  const tree: ShapeTree = new Map()
  let name = ''
  let depth = 0
  let nested = ''
  for (const char of shape) {
    if (depth > 0) {
      if (char === '(') depth++
      if (char === ')') {
        depth--
        if (depth === 0) {
          tree.set(name, parseShape(nested))
          name = ''
          nested = ''
          continue
        }
      }
      nested += char
    }
    else if (char === '(') depth++
    else if (char === ',') {
      if (name) tree.set(name, null)
      name = ''
    }
    else name += char
  }
  if (name) tree.set(name, null)
  return tree
}

/**
 * 比對兩棵欄位樹，回傳對不上的欄位路徑。
 *
 * **「這一層不知道長怎樣」（null）與任何東西都相容。** 內嵌關聯在某次取樣裡
 * 可能整批都是 null（例如器材全是自建的，沒有一台有型錄），那時看不出它的
 * 子欄位——那是資料的樣子，不是查詢換了欄位。把它當成衝突會在使用者
 * 新增第一台型錄器材時誤報。真正要抓的是**同一層的欄位名對不上**。
 */
function conflicts(known: ShapeTree, next: ShapeTree, prefix = ''): string[] {
  const found: string[] = []
  for (const key of new Set([...known.keys(), ...next.keys()])) {
    const path = prefix ? `${prefix}.${key}` : key
    if (!known.has(key) || !next.has(key)) {
      found.push(path)
      continue
    }
    const a = known.get(key)
    const b = next.get(key)
    if (a && b) found.push(...conflicts(a, b, path))
  }
  return found
}

/** 兩邊都沒有衝突時，把知道得比較細的那一邊留下來當基準 */
function mergeShapes(known: ShapeTree, next: ShapeTree): ShapeTree {
  const merged: ShapeTree = new Map()
  for (const [key, a] of known) {
    const b = next.get(key)
    merged.set(key, a && b ? mergeShapes(a, b) : (a ?? b ?? null))
  }
  return merged
}

function printShape(tree: ShapeTree): string {
  return [...tree.keys()].map((key) => {
    const child = tree.get(key)
    return child ? `${key}(${printShape(child)})` : key
  }).join(',')
}

/**
 * 記錄並比對某個 key 的欄位集合。
 * 對不上時回傳警告文字，相符或無從判斷時回 null。
 *
 * **不要拿去檢查 prime()。** 從列表帶進詳情頁的半成品本來就欄位比較少，
 * 那是刻意的，不是錯誤。
 */
export function checkCacheShape(key: string, data: unknown): string | null {
  const shape = describeShape(data)
  if (!shape) return null

  const known = shapes.get(key)
  if (!known) {
    shapes.set(key, parseShape(shape))
    return null
  }

  const next = parseShape(shape)
  const mismatched = conflicts(known, next)
  if (!mismatched.length) {
    // 基準只在沒有衝突時更新，而且只會變得更細——出錯的那個呼叫端
    // 每次都要警告，不能被它自己覆蓋成新基準之後就靜下來
    shapes.set(key, mergeShapes(known, next))
    return null
  }

  return `[cache] 「${key}」這個 key 被兩種不同欄位的查詢共用了。`
    + `對不上的欄位：${mismatched.join('、')}。`
    + `先前：${printShape(known)}；這次：${shape}。`
    + '誰先跑誰決定快取內容，後到的元件會拿到缺欄位的資料，而且不會有錯誤。'
    + '請改用不同的 key，或把查詢收斂到單一元件。'
}

/** 測試用 */
export function __resetCacheShapes() {
  shapes.clear()
}
