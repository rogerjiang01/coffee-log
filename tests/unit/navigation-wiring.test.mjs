// 導覽架構的接線（結構檢查，《03》§3）。
//
// 三種畫面各有自己的導覽規則。這些規則原本散在各頁，也沒有寫進規格——
// 分頁列出現在哪裡只存在於元件註解，頂部角落放了四種性質不同的東西。
// 這裡守住：每一頁宣告自己是哪一種、分頁列只由 app.vue 決定、
// 頂部角落只放 ‹（首頁多一個齒輪）、會丟東西的才叫「取消」、浮層佔 history。

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { createReport } from '../helpers/report.mjs'

const root = new URL('../../', import.meta.url)
const read = path => readFileSync(new URL(path, root), 'utf8')
const templateOf = text => text.slice(text.indexOf('<template>'))
const stripComments = text => text.replace(/<!--[\s\S]*?-->/g, '').replace(/(^|\s)\/\/.*$/gm, '$1')

function pageFiles(dir = 'pages') {
  const out = []
  for (const name of readdirSync(new URL(dir, root))) {
    const path = `${dir}/${name}`
    if (statSync(new URL(path, root)).isDirectory()) out.push(...pageFiles(path))
    else if (name.endsWith('.vue')) out.push(path)
  }
  return out
}

const screens = {
  'pages/index.vue': 'browse',
  'pages/beans/index.vue': 'browse',
  'pages/equipment/index.vue': 'browse',
  'pages/beans/[id]/index.vue': 'view',
  'pages/brews/[id]/index.vue': 'view',
  'pages/settings.vue': 'view',
  'pages/brews/new.vue': 'flow',
  'pages/brews/[id]/edit.vue': 'flow',
  'pages/beans/new.vue': 'flow',
  'pages/beans/[id]/edit.vue': 'flow',
  'pages/equipment/new.vue': 'flow',
  'pages/equipment/[id]/edit.vue': 'flow',
}
// 還沒進到產品裡，不屬於三種畫面
const outside = ['pages/login.vue', 'pages/signup.vue']

export default function run() {
  const r = createReport('導覽架構的接線')

  r.section('每一頁都宣告自己是哪一種畫面')
  const pages = pageFiles()
  const unknown = pages.filter(path => !(path in screens) && !outside.includes(path))
  r.check(unknown.length === 0, `沒有漏掉的頁面${unknown.length ? `：${unknown.join('、')}` : ''}`)
  for (const [path, screen] of Object.entries(screens)) {
    r.check(existsSync(new URL(path, root)) && read(path).includes(`definePageMeta({ screen: '${screen}' })`)
      || read(path).includes(`definePageMeta({ screen: "${screen}" })`), `${path}：${screen}`)
  }
  for (const path of outside) r.check(!/definePageMeta\(\{ screen/.test(read(path)), `${path}：不屬於三種畫面，沒有分頁列`)

  r.section('分頁列只由 app.vue 決定')
  const app = read('app.vue')
  r.check(/<BottomNav \/>/.test(app) && /showsTabBar\(route\.meta\.screen\)/.test(app), 'app.vue 依畫面類型放分頁列')
  const pagesWithNav = pages.filter(path => /<BottomNav/.test(read(path)))
  r.check(pagesWithNav.length === 0, `頁面不自己放分頁列${pagesWithNav.length ? `：${pagesWithNav.join('、')}` : ''}`)

  r.section('瀏覽型：頂部只有標題，右下新增')
  const fabTargets = {
    'pages/index.vue': ':to="newBrewLink"',
    'pages/beans/index.vue': 'to="/beans/new"',
    'pages/equipment/index.vue': 'to="/equipment/new"',
  }
  for (const [path, target] of Object.entries(fabTargets)) {
    const template = stripComments(templateOf(read(path)))
    r.check(!/回首頁/.test(template), `${path}：沒有「回首頁」（分頁列就是出口）`)
    r.check(/<PageHeader title="[^"]+"(\s*\/>|>)/.test(template) && !/<PageHeader[^>]*back/.test(template), `${path}：頂部只有標題，沒有 ‹`)
    r.check(template.includes(target) && /aria-label="新增/.test(template), `${path}：右下的新增按鈕導向新增頁`)
    r.check(!/to="#"/.test(template), `${path}：新增按鈕不是 href="#" 加頁內動作`)
  }
  const home = templateOf(read('pages/index.vue'))
  r.check(/<template #end>[\s\S]*to="\/settings"[\s\S]*aria-label="設定"/.test(home), '首頁右上角是設定的齒輪')

  r.section('檢視型：左上 ‹，右側空著，編輯與刪除在內容區')
  for (const path of ['pages/beans/[id]/index.vue', 'pages/brews/[id]/index.vue', 'pages/settings.vue']) {
    const template = stripComments(templateOf(read(path)))
    r.check(/<PageHeader[^>]*back/.test(template) && !/<template #end>/.test(template), `${path}：左上 ‹，右側空著`)
    r.check(!/回首頁|回豆子列表/.test(template), `${path}：找不到的狀態也只用 ‹，不另放文字連結`)
  }
  for (const path of ['pages/beans/[id]/index.vue', 'pages/brews/[id]/index.vue']) {
    const template = stripComments(templateOf(read(path)))
    const edit = template.search(/>\s*編輯\s*</)
    r.check(edit > template.indexOf('再沖一次') && edit < template.lastIndexOf('刪除'),
      `${path}：編輯在內容區，排在主要按鈕之後、刪除之前`)
  }
  r.check(/:back="brewParent\(brew\?\.beans\?\.id\)"/.test(read('pages/brews/[id]/index.vue')), '紀錄詳情的 ‹ 回到它的豆子')
  r.check(/<PageHeader back="\/beans" \/>/.test(read('pages/beans/[id]/index.vue')), '豆子詳情的 ‹ 回到豆子列表')

  r.section('流程型：左上 ‹ 離開，沒有「取消」連結')
  for (const path of Object.keys(screens).filter(path => screens[path] === 'flow')) {
    const template = stripComments(templateOf(read(path)))
    r.check(/<PageHeader[\s\S]*?back-label="離開"/.test(template), `${path}：‹ 叫「離開」`)
    r.check(!/>\s*取消\s*</.test(template), `${path}：沒有「取消」——這裡離開不丟東西，暫存留著`)
    r.check(!/aria-label="新增/.test(template), `${path}：沒有新增按鈕`)
  }

  r.section('頂部角落只放 ‹ 與首頁的齒輪')
  const header = read('components/PageHeader.vue')
  r.check(/<BackButton/.test(header) && /<slot name="end"/.test(header), 'PageHeader：左 ‹、右側只有一個 slot')
  const endSlots = pages.filter(path => /<template #end>/.test(read(path)))
  r.check(endSlots.join() === 'pages/index.vue', `右側 slot 只有首頁在用${endSlots.length ? `：${endSlots.join('、')}` : ''}`)

  r.section('浮層佔一筆 history，返回鍵關浮層')
  for (const path of [
    'components/ConfirmDialog.vue', 'components/EquipmentPicker.vue', 'components/PhotoCropper.client.vue',
    'components/BeanSelect.vue', 'components/CatalogSelect.vue', 'components/CountrySelect.vue', 'components/LookupSelect.vue',
  ]) {
    r.check(/useOverlayHistory\(/.test(read(path)), `${path}`)
  }
  r.check(!/useOverlayHistory\(/.test(read('components/DraftOverlay.vue')),
    '暫存詢問不佔 history：它一定要回答，返回鍵照原本離開這一頁')
  const plugin = read('plugins/overlay-history.client.ts')
  r.check(/router\.beforeEach/.test(plugin) && /to\.fullPath === from\.fullPath/.test(plugin),
    '導向別頁前先退掉浮層；同網址（返回鍵關浮層）不攔')
  r.check(/go\(-steps, false\)/.test(plugin), '自己退的時候不讓路由器跟著導覽')
  r.check(/flush: 'sync'/.test(read('composables/useOverlayHistory.ts')), '關掉浮層的後退在導覽開始前就發出')

  r.section('器材選擇器')
  const picker = stripComments(templateOf(read('components/EquipmentPicker.vue')))
  r.check(/v-if="mode === 'create'"[\s\S]{0,300}取消/.test(picker), '「取消」只在新增畫面（會清掉填到一半的內容）')
  r.check(!/emit\('close'\)"\s*>\s*取消/.test(picker), '清單畫面沒有與 ‹ 重複的「取消」')

  r.section('器材是獨立路由')
  r.check(!existsSync(new URL('pages/equipment.vue', root)), '沒有 pages/equipment.vue（會變成子路由的外框）')
  r.check(existsSync(new URL('pages/equipment/new.vue', root)) && existsSync(new URL('pages/equipment/[id]/edit.vue', root)),
    '/equipment/new 與 /equipment/[id]/edit')
  r.check(/draft-key="draft:equipment:new"/.test(read('pages/equipment/new.vue'))
    && /:draft-key="`draft:equipment:\$\{id\}`"/.test(read('pages/equipment/[id]/edit.vue')), '器材表單有暫存')
  r.check(!/startEdit|startCreate|editing/.test(read('pages/equipment/index.vue')), '列表頁裡沒有頁內表單')

  return r.finish()
}
