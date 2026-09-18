// 載入失敗時的頁面接線（結構檢查）。
//
// 編輯頁：表單只在 view === 'ready' 時渲染，每一個查詢的 error 都有檢查，
// 失敗時有重試，離開的入口（‹）不跟著狀態消失。
// 詳情頁：返回入口（‹）在所有狀態判斷之外，讀取失敗時仍然看得到。

import { readFileSync } from 'node:fs'
import { createReport } from '../helpers/report.mjs'

const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')
const templateOf = text => text.slice(text.indexOf('<template>'))

/** 某個位置之前最後一個 v-if／v-else-if／v-else 條件 */
function lastConditionBefore(template, index) {
  const conditions = [...template.slice(0, index).matchAll(/v-(?:else-)?if="([^"]+)"|v-else(?=[\s>])/g)]
  return conditions.at(-1)?.[1] ?? 'v-else'
}

export default function run() {
  const r = createReport('載入失敗時的頁面接線')

  const editPages = [
    ['pages/brews/[id]/edit.vue', '<BrewForm', /firstQueryError\(brewResult, stepResult, tagResult\)/],
    ['pages/beans/[id]/edit.vue', '<BeanForm', /firstQueryError\(result\)/],
    ['pages/equipment/[id]/edit.vue', '<EquipmentForm', /firstQueryError\(result\)/],
  ]
  for (const [path, formTag, checksErrors] of editPages) {
    const text = read(path)
    const template = templateOf(text)
    const form = template.indexOf(formTag)
    r.check(form > 0 && lastConditionBefore(template, form) === "view === 'ready'",
      `${path}：表單只在 view === 'ready' 時存在於 DOM`)
    r.check(!/v-else\s*>\s*<(BrewForm|BeanForm)/.test(template), `${path}：表單不在「其餘情況」的 v-else 裡`)
    r.check(checksErrors.test(text), `${path}：每一個查詢的 error 都檢查，不只看 data`)
    r.check(/loaded: initial\.value !== null/.test(text), `${path}：「已載入」看的是資料到位，不是沒有出錯`)
    r.check(/view === 'error'[\s\S]*?@click="load"[\s\S]*?重試/.test(template), `${path}：錯誤狀態有重試`)
    const header = template.indexOf('<PageHeader')
    r.check(header > 0 && header < template.indexOf("view === 'loading'") && header < template.indexOf("view === 'notFound'"),
      `${path}：離開的入口（‹）在讀取中、錯誤、找不到都看得到`)
  }

  const detailPages = [
    ['pages/brews/[id]/index.vue', 'v-else-if="brew"'],
    ['pages/beans/[id]/index.vue', 'v-else-if="bean"'],
  ]
  for (const [path, loaded] of detailPages) {
    const template = templateOf(read(path))
    const back = template.indexOf('<PageHeader')
    r.check(back > 0 && back < template.indexOf('v-if="loading"') && back < template.indexOf(loaded),
      `${path}：返回入口在所有狀態判斷之外`)
    r.check(/@click="load"[\s\S]*?重試/.test(template), `${path}：讀取失敗有重試`)
  }

  return r.finish()
}
