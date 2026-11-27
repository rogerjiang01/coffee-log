// 置中對話框的標題（《03》§4.8、§2.4）。
//
// 置中對話框的標題是 --font-body、--text-xl、字重 400；頁面裡的 h1、h2 用標題字體
// （font-serif 這個 class——名字是改版前留下的，2026-11-11 起它指的是 --font-heading，
// 也就是 Noto Sans TC Medium，不再是襯線體）。
//
// 原本用襯線／無襯線區分內容層與操作層的規則已經刪除，改用什麼區分還沒有決定（《03》§4.8）。
// 在決定之前兩邊維持現況：同樣 24px 兩種寫法是刻意的，最容易被當成不一致而「統一」掉
// ——哪一邊被改過去，這裡都會失敗。
//
// **全螢幕浮層（<dialog class="sheet">）不適用**：器材選擇器鋪滿整個畫面，
// 它的標題列扮演的是頁面標題的角色，照頁面標題的寫法。

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

  r.section('置中對話框的標題：--font-body、--text-xl、字重 400、text-wrap: balance')
  const withDialog = files.filter(path => /<dialog\b/.test(read(path)))
  r.check(withDialog.length >= 5, `有 ${withDialog.length} 個檔案用 <dialog>`)
  const expected = ['components/ConfirmDialog.vue', 'components/DraftOverlay.vue', 'components/BrewShare.vue']
  for (const path of expected) {
    r.check(dialogHeadings(read(path)).length > 0, `${path} 的標題在 <dialog> 裡`)
  }
  for (const path of withDialog) {
    for (const tag of dialogHeadings(read(path))) {
      const cls = classOf(tag)
      r.check(!/\bfont-serif\b/.test(cls), `${path}：不用舊的標題 class（font-serif）`)
      r.check(/\btext-xl\b/.test(cls) && !/\btext-(lg|2xl|base|sm)\b/.test(cls), `${path}：--text-xl`)
      r.check(/\bfont-normal\b/.test(cls) && !/\bfont-(bold|medium|semibold)\b/.test(cls), `${path}：字重 400`)
      r.check(/\btext-balance\b/.test(cls), `${path}：text-wrap: balance（行長平均）`)
      r.check(/\bbreak-keep\b/.test(cls) && /\bwrap-anywhere\b/.test(cls),
        `${path}：word-break: keep-all ＋ overflow-wrap: anywhere（只在空格與標點斷行，放不下才從中間斷）`)
      r.check(/\btabindex="-1"/.test(tag) && /\boutline-none\b/.test(cls), `${path}：標題 tabindex="-1"、不畫焦點框`)
    }
  }

  r.section('置中對話框開啟時，焦點放在標題（觸控開啟不出現焦點框、按 Enter 不會誤按）')
  for (const [path, ref] of [['components/ConfirmDialog.vue', 'heading'], ['components/DraftOverlay.vue', 'heading'], ['components/BrewShare.vue', 'title']]) {
    const src = read(path)
    r.check(new RegExp(`<h2 ref="${ref}"`).test(src) || new RegExp(`<h2[^>]*ref="${ref}"`).test(src), `${path}：標題有 ref`)
    r.check(new RegExp(`showModal\\(\\);?\\s*\\n[\\s\\S]{0,300}?${ref}\\.value\\?\\.focus\\(\\)`).test(src), `${path}：showModal() 之後聚焦標題`)
  }

  r.section('全螢幕浮層不適用：器材選擇器的標題照頁面標題（字重 500、Heading M）')
  const picker = stripComments(read('components/EquipmentPicker.vue'))
  r.check(/<dialog[^>]*class="sheet"/.test(picker), '器材選擇器是全螢幕浮層（class="sheet"）')
  r.check(/<h2 class="flex-1 truncate text-heading-m font-medium">/.test(picker), '標題字重 500（font-medium）、Heading M')
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

  // 2026-11-13：內容層（頁面標題、區塊標題）字重 500、操作層（對話框標題）字重 400（《03》§4.8）。
  // 500 一律寫 font-medium——它同時把字體換成 Noto Sans TC（台北黑體沒有 500）。
  r.section('頁面的 h1、h2 是內容層：字重 500（font-medium）')
  const pageHeadings = files
    .map(path => [path, stripComments(read(path)).replace(/<dialog[\s\S]*?<\/dialog>/g, '')])
    .flatMap(([path, text]) => [...text.matchAll(/<h1\b[^>]*>/g)].map(m => [path, m[0]]))
    // 登入與註冊照 Figma 沒有看得見的標題（畫面上是 logo），h1 只給螢幕閱讀器
    .filter(([, tag]) => !/class="sr-only"/.test(tag))
  r.check(pageHeadings.length >= 8, `頁面上有 ${pageHeadings.length} 個 h1`)
  for (const [path, tag] of pageHeadings) {
    r.check(/\bfont-medium\b/.test(classOf(tag)) && !/\bfont-(serif|bold|normal)\b/.test(classOf(tag)), `${path} 的 h1 字重 500`)
  }
  // 2026-11-25：紀錄詳情與分享頁的段落改用表單的 FormSection（Heading L 的 Medium）
  r.check(/<h2 v-if="title" class="card-pad-x text-heading-l font-medium">/.test(read('components/FormSection.vue'))
    && /<FormSection\b/.test(read('components/BrewReadonlySections.vue')),
    '紀錄詳情的區塊標題（h2，FormSection）字重 500')
  const everything = files.map(path => stripComments(read(path))).join('\n')
  r.check(!/\bfont-serif\b/.test(everything), 'font-serif 這個 class 已經沒有任何地方在用')

  return r.finish()
}
