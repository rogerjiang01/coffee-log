// 測試執行器。用 node --experimental-strip-types 直接跑 .ts，
// 不引入測試框架——這些測試的價值在於守住幾條不可回歸的規則。
//
// 執行：pnpm test

const suites = [
  // 第一優先：分段注水的單位轉換。寫反了不會報錯，
  // 只會讓所有既有紀錄的時間資料悄悄失真。
  ['unit/brew-steps.test.ts', '分段注水的單位轉換'],
  ['unit/brew-template.test.ts', '手法的分段模板'],
  ['unit/template-trigger.test.ts', '手法模板的重算時機'],
  ['unit/template-trigger-wiring.test.mjs', '模板重算的接線'],
  ['unit/brew-diff.test.ts', '差異計算'],
  ['unit/bean-compare.test.ts', '豆子比較表'],
  ['unit/lookup.test.ts', '查表欄位的比對'],
  ['unit/countries.test.ts', '產國的洲別分組'],
  ['unit/grind-scale.test.ts', '刻度四欄制'],
  ['unit/equipment-query.test.mjs', '器材查詢的單一定義'],
  ['unit/last-used.test.ts', '器材的上次使用時間'],
  ['unit/panel.test.ts', '浮層定位'],
  ['unit/overlay-history.test.ts', '浮層與返回鍵'],
  ['unit/navigation.test.ts', '導覽規則'],
  ['unit/navigation-wiring.test.mjs', '導覽架構的接線'],
  ['unit/load-state.test.ts', '編輯頁的載入狀態'],
  ['unit/load-state-wiring.test.mjs', '載入失敗時的頁面接線'],
  ['unit/draft.test.ts', '表單自動暫存'],
  ['unit/draft-status.test.ts', '暫存狀態指示'],
  ['unit/draft-status-wiring.test.mjs', '暫存狀態指示的接線'],
  ['unit/icon-stroke.test.mjs', '圖示的實際線寬與字級下限'],
  ['unit/form-draft-unmount.test.ts', '離開表單時的暫存'],
  ['unit/inline-draft.test.ts', '就地新增的暫存'],
  ['unit/cache.test.ts', '客戶端快取'],
  ['unit/query-cache.test.ts', 'SWR 快取'],
  ['unit/photo-url-cache.test.ts', '照片簽名網址的快取'],
  ['unit/error-message.test.ts', '錯誤訊息中文化'],
  ['unit/css.test.mjs', '全域 CSS 的關鍵規則'],
  ['unit/portal.test.mjs', '浮層的 teleport 目標'],
  ['unit/photo-cropper.test.mjs', '照片裁切'],
  ['unit/pinch.test.ts', '雙指縮放的比例換算'],
  ['unit/draft-photos.test.ts', '暫存中的豆袋照片'],
  ['unit/user-isolation.test.ts', '換帳號時的資料隔離'],
  ['unit/user-isolation-wiring.test.mjs', '資料隔離的接線'],
  ['unit/draft-photos-wiring.test.mjs', '照片暫存的接線'],
  ['unit/step-times-toggle.test.mjs', '記錄分段時間的開關'],
  ['unit/compare-table.test.mjs', '比較表的可點擊線索'],
  ['unit/interaction-time.test.ts', '記錄時間的量法'],
  ['unit/interaction-time-wiring.test.mjs', '記錄時間的接線'],
  ['unit/save-event.test.ts', '每次儲存都記一筆耗時'],
  ['unit/sample-badge-wiring.test.mjs', '範例標籤的接線'],
  ['unit/glossary.test.mjs', '介面用詞'],
  ['db/schema.test.mjs', 'Schema、RLS 與 seed'],
  ['db/sample-data.test.mjs', '新使用者的範例資料'],
  ['db/function-grants.test.mjs', 'public schema 的函式執行權'],
  ['db/brews.test.mjs', '分段與複製（資料庫）'],
]

let totalPass = 0
let totalFail = 0
const failedSuites = []

for (const [file, label] of suites) {
  try {
    const module = await import(`./${file}`)
    const result = await module.default()
    totalPass += result.pass
    totalFail += result.fail
    if (result.fail > 0) failedSuites.push({ label, failures: result.failures })
  }
  catch (error) {
    totalFail++
    failedSuites.push({ label, failures: [`測試檔本身出錯：${error.message}`] })
    console.log(`\n${label}\n    ✘ 測試檔本身出錯：${error.message}`)
  }
}

console.log(`\n${'─'.repeat(52)}`)
console.log(`總計：通過 ${totalPass}，失敗 ${totalFail}`)

if (failedSuites.length) {
  console.log('\n失敗的項目：')
  for (const suite of failedSuites) {
    for (const failure of suite.failures) console.log(`  ${suite.label} → ${failure}`)
  }
  process.exit(1)
}
