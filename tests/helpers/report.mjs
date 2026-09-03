// 極簡的測試回報。不引入測試框架——這些測試的價值在於守住幾條
// 不可回歸的規則，不需要 watch mode、快照或 mock。

export function createReport(title) {
  let pass = 0
  let fail = 0
  const failures = []

  console.log(`\n${title}`)

  return {
    section(name) {
      console.log(`\n  ${name}`)
    },
    check(condition, message) {
      if (condition) {
        pass++
        console.log(`    ✔ ${message}`)
      }
      else {
        fail++
        failures.push(message)
        console.log(`    ✘ ${message}`)
      }
    },
    ok(message) {
      pass++
      console.log(`    ✔ ${message}`)
    },
    async mustReject(promise, message) {
      try {
        await promise
        fail++
        failures.push(message)
        console.log(`    ✘ ${message}（竟然成功）`)
      }
      catch {
        pass++
        console.log(`    ✔ ${message}`)
      }
    },
    finish() {
      console.log(`\n  通過 ${pass}，失敗 ${fail}`)
      return { pass, fail, failures }
    },
  }
}

export const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b)
