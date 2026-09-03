// 測試執行器。用 node --experimental-strip-types 直接跑 .ts，
// 不引入測試框架——這些測試的價值在於守住幾條不可回歸的規則。
//
// 執行：pnpm test

const suites = [
  // 第一優先：分段注水的單位轉換。寫反了不會報錯，
  // 只會讓所有既有紀錄的時間資料悄悄失真。
  ['unit/brew-steps.test.ts', '分段注水的單位轉換'],
  ['unit/brew-template.test.ts', '手法的分段模板'],
  ['unit/brew-diff.test.ts', '差異計算'],
  ['unit/bean-compare.test.ts', '豆子比較表'],
  ['unit/lookup.test.ts', '查表欄位的比對'],
  ['unit/grind-scale.test.ts', '刻度四欄制'],
  ['unit/panel.test.ts', '浮層定位'],
  ['db/schema.test.mjs', 'Schema、RLS 與 seed'],
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
