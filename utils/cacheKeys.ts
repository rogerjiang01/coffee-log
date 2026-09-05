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
  equipmentAll: () => 'equipment:all',

  lookup: (table: string) => `lookup:${table}`,
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
