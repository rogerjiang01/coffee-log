// 浮層標題的字型（《03》§4.8、§2.4）。
//
// 規則依所在的容器決定，不依字級決定：對話框與全螢幕浮層的標題是無襯線、
// --text-xl、字重 400；頁面裡的 h1、h2 維持襯線。同樣 24px 兩種字型是刻意的，
// 最容易被當成不一致而「統一」掉——哪一邊被改過去，這裡都會失敗。

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { createReport } from '../helpers/report.mjs'

const root = new URL('../../', import.meta.url)
const read = path => readFileSync(new URL(path, root), 'utf8')
const stripComments = text => text.replace(/<!--[\s\S]*?-->/g, '')

function vueFiles(dir) {
  const out = []
  for (const name of readdirSync(new URL(dir, root))) {
    const path = `${dir}/${name}`
    if (statSync(new URL(path, root)).isDirectory()) out.push(...vueFiles(path))
    else if (name.endsWith('.vue')) out.push(path)
  }
  return out
}

/** <dialog>…</dialog> 裡所有標題元素的開頭標籤 */
function dialogHeadings(text) {
  return [...stripComments(text).matchAll(/<dialog[\s\S]*?<\/dialog>/g)]
    .flatMap(m => [...m[0].matchAll(/<h[1-6]\b[^>]*>/g)].map(h => h[0]))
}

const classOf = tag => tag.match(/\sclass="([^"]*)"/)?.[1] ?? ''

export default function run() {
  const r = createReport('浮層標題的字型')
  const files = [...vueFiles('components'), ...vueFiles('pages'), 'app.vue', 'error.vue']

  r.section('對話框與全螢幕浮層的標題：無襯線、--text-xl、字重 400')
  const withDialog = files.filter(path => /<dialog\b/.test(read(path)))
  r.check(withDialog.length >= 5, `有 ${withDialog.length} 個檔案用 <dialog>`)
  const expected = ['components/ConfirmDialog.vue', 'components/DraftOverlay.vue', 'components/BrewShare.vue', 'components/EquipmentPicker.vue']
  for (const path of expected) {
    r.check(dialogHeadings(read(path)).length > 0, `${path} 的標題在 <dialog> 裡`)
  }
  for (const path of withDialog) {
    for (const tag of dialogHeadings(read(path))) {
      const cls = classOf(tag)
      r.check(!/\bfont-serif\b/.test(cls), `${path}：不用 font-serif`)
      r.check(/\btext-xl\b/.test(cls) && !/\btext-(lg|2xl|base|sm)\b/.test(cls), `${path}：--text-xl`)
      r.check(/\bfont-normal\b/.test(cls) && !/\bfont-(bold|medium|semibold)\b/.test(cls), `${path}：字重 400`)
    }
  }

  r.section('分享對話框的主體不比標題重')
  const share = stripComments(read('components/BrewShare.vue'))
  const beanLine = share.match(/<p class="([^"]*)">\{\{ beanName \}\}<\/p>/)?.[1]
  r.check(beanLine !== undefined && !/\bfont-(medium|semibold|bold)\b|\btext-(lg|xl)\b/.test(beanLine),
    '豆名 16px、字重 400（不是 font-medium）')

  r.section('頁面的 h1、h2 維持襯線（依容器決定，不依字級決定）')
  const pageHeadings = files
    .map(path => [path, stripComments(read(path)).replace(/<dialog[\s\S]*?<\/dialog>/g, '')])
    .flatMap(([path, text]) => [...text.matchAll(/<h1\b[^>]*>/g)].map(m => [path, m[0]]))
  r.check(pageHeadings.length >= 8, `頁面上有 ${pageHeadings.length} 個 h1`)
  for (const [path, tag] of pageHeadings) {
    r.check(/\bfont-serif\b/.test(classOf(tag)), `${path} 的 h1 是襯線`)
  }
  r.check(/<h2 class="font-serif text-lg font-bold">分段<\/h2>/.test(read('pages/brews/[id]/index.vue')),
    '紀錄詳情的區塊標題（h2）是襯線')

  return r.finish()
}
