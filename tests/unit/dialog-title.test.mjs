// 置中對話框的標題（《03》§4.8、§2.4）。
//
// 規則依所在的容器決定，不依字級決定：置中對話框的標題是無襯線、--text-xl、
// 字重 400；頁面裡的 h1、h2 維持襯線。同樣 24px 兩種字型是刻意的，
// 最容易被當成不一致而「統一」掉——哪一邊被改過去，這裡都會失敗。
//
// **全螢幕浮層（<dialog class="sheet">）不適用**：器材選擇器鋪滿整個畫面，
// 它的標題列扮演的是頁面標題的角色，維持襯線、18px、700。

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

/** 置中對話框（不是 class="sheet" 的 <dialog>）的內容 */
function centeredDialogs(text) {
  // 只看 template：script 的註解裡也會寫到「<dialog>」
  const template = text.slice(Math.max(0, text.indexOf('<template>')))
  return [...stripComments(template).matchAll(/<dialog\b([^>]*)>([\s\S]*?)<\/dialog>/g)]
    .filter(m => !/class="[^"]*\bsheet\b/.test(m[1]))
    .map(m => m[2])
}

/** 置中對話框裡所有標題元素的開頭標籤 */
function dialogHeadings(text) {
  return centeredDialogs(text).flatMap(body => [...body.matchAll(/<h[1-6]\b[^>]*>/g)].map(h => h[0]))
}

const classOf = tag => tag.match(/\sclass="([^"]*)"/)?.[1] ?? ''

export default function run() {
  const r = createReport('浮層標題的字型')
  const files = [...vueFiles('components'), ...vueFiles('pages'), 'app.vue', 'error.vue']

  r.section('置中對話框的標題：無襯線、--text-xl、字重 400、text-wrap: balance')
  const withDialog = files.filter(path => /<dialog\b/.test(read(path)))
  r.check(withDialog.length >= 5, `有 ${withDialog.length} 個檔案用 <dialog>`)
  const expected = ['components/ConfirmDialog.vue', 'components/DraftOverlay.vue', 'components/BrewShare.vue']
  for (const path of expected) {
    r.check(dialogHeadings(read(path)).length > 0, `${path} 的標題在 <dialog> 裡`)
  }
  for (const path of withDialog) {
    for (const tag of dialogHeadings(read(path))) {
      const cls = classOf(tag)
      r.check(!/\bfont-serif\b/.test(cls), `${path}：不用 font-serif`)
      r.check(/\btext-xl\b/.test(cls) && !/\btext-(lg|2xl|base|sm)\b/.test(cls), `${path}：--text-xl`)
      r.check(/\bfont-normal\b/.test(cls) && !/\bfont-(bold|medium|semibold)\b/.test(cls), `${path}：字重 400`)
      r.check(/\btext-balance\b/.test(cls), `${path}：text-wrap: balance（不在詞中間斷行）`)
      r.check(/\btabindex="-1"/.test(tag) && /\boutline-none\b/.test(cls), `${path}：標題 tabindex="-1"、不畫焦點框`)
    }
  }

  r.section('置中對話框開啟時，焦點放在標題（觸控開啟不出現焦點框、按 Enter 不會誤按）')
  for (const [path, ref] of [['components/ConfirmDialog.vue', 'heading'], ['components/DraftOverlay.vue', 'heading'], ['components/BrewShare.vue', 'title']]) {
    const src = read(path)
    r.check(new RegExp(`<h2 ref="${ref}"`).test(src) || new RegExp(`<h2[^>]*ref="${ref}"`).test(src), `${path}：標題有 ref`)
    r.check(new RegExp(`showModal\\(\\);?\\s*\\n[\\s\\S]{0,300}?${ref}\\.value\\?\\.focus\\(\\)`).test(src), `${path}：showModal() 之後聚焦標題`)
  }

  r.section('全螢幕浮層不適用：器材選擇器的標題維持襯線、18px、700')
  const picker = stripComments(read('components/EquipmentPicker.vue'))
  r.check(/<dialog[^>]*class="sheet"/.test(picker), '器材選擇器是全螢幕浮層（class="sheet"）')
  r.check(/<h2 class="flex-1 truncate font-serif text-lg font-bold">/.test(picker), '標題是襯線、--text-lg、700')
  r.check(dialogHeadings(read('components/EquipmentPicker.vue')).length === 0, '不被當成置中對話框檢查')

  r.section('置中對話框的內文：text-wrap: pretty（最後一個字不單獨落到下一行）')
  const bodies = [
    ['components/ConfirmDialog.vue', /<p class="([^"]*)">\{\{ body \}\}<\/p>/],
    ['components/DraftOverlay.vue', /<p v-if="note" class="([^"]*)">\{\{ note \}\}<\/p>/],
    ['components/BrewShare.vue', /<p class="([^"]*)">\{\{ beanName \}\}<\/p>/],
  ]
  for (const [path, pattern] of bodies) {
    const cls = stripComments(read(path)).match(pattern)?.[1] ?? ''
    r.check(/\btext-pretty\b/.test(cls), `${path}：text-pretty`)
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
