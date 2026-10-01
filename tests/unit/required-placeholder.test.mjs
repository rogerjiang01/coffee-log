// 必填欄位不顯示「選填」（結構檢查）。
//
// 回歸的情境（2026-10-01）：沖煮表單的豆子欄位標籤有必填的 *，還沒選的時候
// 欄位裡卻寫著「選填」。兩個訊號互相矛盾，而豆子確實是必填（《02》§0）。
//
// 「選填」是選填欄位還沒選時顯示的字（產國、處理法、品種、沖煮手法、烘焙度、器材）。
// 這裡找出每一個標成必填的欄位，確認它自己那個控制項裡沒有這兩個字。
// 有條件才必填的欄位（器材的自訂名稱：沒選型號時才必填）不在此列。

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { createReport } from '../helpers/report.mjs'

const root = new URL('../../', import.meta.url)
const read = path => readFileSync(new URL(path, root), 'utf8')

function vueFiles(dir) {
  const out = []
  for (const name of readdirSync(new URL(dir, root))) {
    const path = `${dir}/${name}`
    if (statSync(new URL(path, root)).isDirectory()) out.push(...vueFiles(path))
    else if (name.endsWith('.vue')) out.push(path)
  }
  return out
}

/** 一律必填的欄位：label 裡有不帶 v-if 的「必填」。回傳 label 的 for 與那個控制項的原始碼 */
function requiredFields(source) {
  // 註解不是畫面上的字
  const template = source.slice(source.indexOf('<template>')).replace(/<!--[\s\S]*?-->/g, '')
  const fields = []
  for (const label of template.matchAll(/<label[^>]*\sfor="([^"]+)"[^>]*>([\s\S]*?)<\/label>/g)) {
    if (!/<span class="sr-only">必填<\/span>/.test(label[2])) continue
    const id = label[1]
    const open = template.match(new RegExp(`<([A-Za-z]+)(?=[^>]*\\sid="${id}")[^>]*>`))
    if (!open) {
      fields.push({ id, control: null })
      continue
    }
    const start = open.index
    const selfClosing = open[0].endsWith('/>') || open[1] === 'input'
    const end = selfClosing ? start + open[0].length : template.indexOf(`</${open[1]}>`, start)
    fields.push({ id, control: template.slice(start, end) })
  }
  return fields
}

export default function run() {
  const r = createReport('必填欄位不顯示「選填」')

  r.section('每一個標成必填的欄位')
  const files = [...vueFiles('components'), ...vueFiles('pages')]
  let found = 0
  for (const path of files) {
    for (const field of requiredFields(read(path))) {
      found++
      r.check(field.control !== null && !field.control.includes('選填'), `${path}：#${field.id}`)
    }
  }
  // 掃不到任何必填欄位，代表上面的比對壞了，不是全部通過
  r.check(found >= 5, `找得到必填欄位（${found} 個）`)

  r.section('沖煮表單的豆子欄位')
  const beanSelect = read('components/BeanSelect.vue')
  r.check(/\{\{ selected\?\.name \?\? '選擇豆子' \}\}/.test(beanSelect), '還沒選的時候顯示「選擇豆子」')
  // BeanSelect 只用在沖煮表單，那裡豆子是必填。之後若用在豆子選填的地方，提示字要依是否必填決定
  const users = files.filter(path => /<BeanSelect\b/.test(read(path)))
  r.check(users.length === 1 && users[0] === 'components/BrewForm.vue', 'BeanSelect 只用在沖煮表單（豆子必填）')

  return r.finish()
}
