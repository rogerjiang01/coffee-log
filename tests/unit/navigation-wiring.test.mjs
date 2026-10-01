// 導覽架構的接線（結構檢查，《03》§3）。
//
// 三種畫面各有自己的導覽規則。這些規則原本散在各頁，也沒有寫進規格——
// 分頁列出現在哪裡只存在於元件註解，頂部角落放了四種性質不同的東西。
// 這裡守住：每一頁宣告自己是哪一種、分頁列只由 app.vue 決定、
// 頂部角落只放 ‹（總覽多一個齒輪）、會丟東西的才叫「取消」、浮層佔 history。

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
  'pages/brews/index.vue': 'browse',
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
  'pages/s/[code].vue': 'share',
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
  r.check(/<BottomNav \/>/.test(app) && /showsTabBar\(route\.meta\.screen, userId\.value !== null\)/.test(app), 'app.vue 依畫面類型（分享頁再看登入狀態）放分頁列')
  const pagesWithNav = pages.filter(path => /<BottomNav/.test(read(path)))
  r.check(pagesWithNav.length === 0, `頁面不自己放分頁列${pagesWithNav.length ? `：${pagesWithNav.join('、')}` : ''}`)

  r.section('瀏覽型：頂部只有標題，右下新增')
  const fabTargets = {
    'pages/index.vue': ':to="newBrewLink"',
    'pages/brews/index.vue': ':to="newBrewLink"',
    'pages/beans/index.vue': 'to="/beans/new"',
    'pages/equipment/index.vue': 'to="/equipment/new"',
  }
  for (const [path, target] of Object.entries(fabTargets)) {
    const template = stripComments(templateOf(read(path)))
    r.check(!/回總覽|回首頁/.test(template), `${path}：沒有「回總覽」（分頁列就是出口）`)
    r.check(/<PageHeader title="[^"]+"(\s*\/>|>)/.test(template) && !/<PageHeader[^>]*back/.test(template), `${path}：頂部只有標題，沒有 ‹`)
    r.check(template.includes(target) && /aria-label="新增/.test(template), `${path}：右下的新增按鈕導向新增頁`)
    r.check(!/to="#"/.test(template), `${path}：新增按鈕不是 href="#" 加頁內動作`)
  }
  const home = templateOf(read('pages/index.vue'))
  r.check(/<template #end>[\s\S]*to="\/settings"[\s\S]*aria-label="設定"/.test(home), '總覽右上角是設定的齒輪')

  r.section('分頁列：四格，亮哪一格由 utils/navigation.ts 決定')
  const nav = read('components/BottomNav.vue')
  r.check(/v-for="item in TABS"/.test(nav) && /tabSection\(route\.path\) === to/.test(nav), '四格與亮格都來自 utils/navigation.ts')
  r.check(!/<svg/.test(nav), '維持只有文字的樣式')
  const navRules = read('utils/navigation.ts')
  r.check(/\{ to: '\/', label: '總覽' \},\s*\{ to: '\/brews', label: '紀錄' \},\s*\{ to: '\/beans', label: '豆子' \},\s*\{ to: '\/equipment', label: '器材' \},/.test(navRules),
    '依序：總覽（/）、紀錄（/brews）、豆子（/beans）、器材（/equipment）')

  r.section('總覽：這一階段只有沖煮中的豆子')
  const homeTemplate = stripComments(home)
  r.check(/<PageHeader title="總覽">/.test(homeTemplate), '標題是「總覽」')
  r.check(/沖煮中的豆子/.test(homeTemplate) && /<HomeBeanCard/.test(homeTemplate), '保留「沖煮中的豆子」')
  r.check(!/BrewTimelineItem|載入更多|brewPage/.test(read('pages/index.vue')), '時間軸不在這裡（搬到紀錄分頁）')
  r.check(!/從一支豆子開始|to="\/beans\/new"/.test(homeTemplate), '沒有空狀態「從一支豆子開始」')
  r.check(/<section v-else-if="beans\.length"/.test(homeTemplate), '沒有未喝完的豆子時整區不顯示')
  // 載入完成、沒有豆子時，畫面上只剩標題、齒輪與浮動新增按鈕：不放任何佔位文字
  const homeText = homeTemplate
    .replace(/<section v-else-if="beans\.length"[\s\S]*?<\/section>/, '')
    .replace(/<div v-if="loading"[\s\S]*?<\/div>\s*<\/section>\s*<\/div>/, '')
    .replace(/<p v-if="loadError"[\s\S]*?<\/p>/, '')
    .replace(/<[^>]+>/g, '').replace(/\s+/g, '')
  r.check(homeText === '', `沒有未喝完的豆子時不放任何佔位文字${homeText ? `：${homeText}` : ''}`)
  r.check(/newBrewEntry\(beans\.value\)/.test(read('pages/index.vue')), '浮動新增按鈕：只有一支未喝完的豆子時帶入')

  r.section('紀錄分頁：時間軸原樣搬過來')
  const brews = read('pages/brews/index.vue')
  const brewsTemplate = stripComments(templateOf(brews))
  r.check(/<PageHeader title="紀錄" \/>/.test(brewsTemplate), '標題是「紀錄」')
  r.check(/const PAGE_SIZE = 20/.test(brews) && /\.range\(from, from \+ PAGE_SIZE - 1\)/.test(brews), '一次 20 筆')
  r.check(/\.order\('brewed_at', \{ ascending: false \}\)\s*\.order\('id', \{ ascending: false \}\)/.test(brews), '依沖煮日期新到舊')
  r.check(!/\.eq\(|\.ilike\(|\.filter\(|type="search"|<select/.test(brews.replace(/sourceIds|\.filter\(\(id\)/g, '')), '沒有篩選、排序、搜尋')
  r.check(/<NuxtLink :to="`\/brews\/\$\{entry\.id\}`" class="block">\s*<BrewTimelineItem/.test(brewsTemplate), '整列點進紀錄詳情，沿用 BrewTimelineItem')
  r.check(/:diffs="entry\.diffs"/.test(brewsTemplate) && /computeBrewDiff\(/.test(brews), '每一列帶差異提示')
  r.check(/載入更多/.test(brewsTemplate) && /v-if="hasMore"/.test(brewsTemplate), '「載入更多」')
  r.check(/<p v-if="!timeline\.length"[^>]*>\s*記錄沖煮後，可以比較每次的調整。\s*<\/p>/.test(brewsTemplate), '空狀態保留那一行')
  r.check(/newBrewEntry\(activeBeans\.value\)/.test(brews), '浮動新增按鈕與總覽同一條規則')
  r.check(/cacheKeys\.beanActive\(\), fetchActiveBeans/.test(brews) && /cacheKeys\.beanActive\(\), fetchActiveBeans/.test(read('pages/index.vue')),
    '兩頁共用同一份未喝完豆子的查詢（同一個快取 key 只能有一種欄位）')
  const activeQueries = [...pages, 'components/BeanSelect.vue'].filter(path => /\.eq\('is_finished', false\)/.test(read(path)))
  r.check(activeQueries.length === 0 && /\.eq\('is_finished', false\)/.test(read('composables/useActiveBeans.ts')),
    `未喝完豆子的查詢只寫在 useActiveBeans${activeQueries.length ? `：${activeQueries.join('、')}` : ''}`)

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
  const brewDetail = read('pages/brews/[id]/index.vue')
  const beanDetail = read('pages/beans/[id]/index.vue')
  r.check(/<PageHeader :back="BREW_BACK_FALLBACK" back-history \/>/.test(brewDetail),
    '紀錄詳情的 ‹ 是歷史式，沒有上一頁回紀錄分頁')
  r.check(/<PageHeader :back="BEAN_BACK_FALLBACK" back-history \/>/.test(beanDetail),
    '豆子詳情的 ‹ 是歷史式，沒有上一頁回豆子列表')
  r.check(/<PageHeader title="設定" back="\/" \/>/.test(read('pages/settings.vue')), '設定的 ‹ 維持階層式，回總覽')
  r.check(/historyBack\(window\.history\.state\?\.back\) === 'back'\) void goBack\(\)\s*else void navigateTo\(props\.to\)/.test(read('components/BackButton.vue')),
    '歷史式的返回：有上一頁回上一頁，沒有才去退回目標')

  r.section('紀錄詳情：豆名是通往豆子詳情的連結')
  const brewDetailTemplate = stripComments(templateOf(brewDetail))
  const title = brewDetailTemplate.match(/<h1 class="min-w-0 font-serif text-2xl font-bold">([\s\S]*?)<\/h1>/)?.[1] ?? ''
  r.check(/<NuxtLink\s+v-if="brew\.beans"\s+:to="`\/beans\/\$\{brew\.beans\.id\}`"/.test(title), '標題列的豆名連到 /beans/[id]')
  r.check(/>\{\{ brew\.beans\.name \}\}<\/NuxtLink>/.test(title), '連結的文字就是豆名')
  r.check(/class="[^"]*\bunderline\b[^"]*"/.test(title) && /color: 'var\(--accent\)'/.test(title), '連結樣式：--accent、底線（《03》）')
  r.check(/<template v-else>沒有指定豆子<\/template>/.test(title), '沒有豆子時不是連結')
  r.check(/beans \( id, name, roast_date, photo_path \)/.test(brewDetail), '查詢帶回豆子的 id')

  r.section('紀錄的落點從 / 改成 /brews')
  r.check(/await exitTo\(BREW_BACK_FALLBACK\)/.test(brewDetail) && !/exitTo\('\/'\)/.test(brewDetail), '刪除紀錄之後回紀錄分頁')
  r.check(/await exitTo\(BEAN_BACK_FALLBACK\)/.test(beanDetail), '刪除豆子之後回豆子列表（不變）')
  const brewEdit = read('pages/brews/[id]/edit.vue')
  r.check(/:back="view === 'notFound' \? BREW_BACK_FALLBACK : `\/brews\/\$\{id\}`"/.test(brewEdit),
    '編輯紀錄找不到這筆紀錄時，‹ 去紀錄分頁')
  r.check(/:back-direct="view === 'notFound'"/.test(brewEdit) && /:back-direct="view === 'notFound'"/.test(read('pages/beans/[id]/edit.vue')),
    '找不到時不看上一頁（上一頁多半是那一筆的詳情）')
  r.check(/BREW_BACK_FALLBACK = '\/brews'/.test(navRules) && /BEAN_BACK_FALLBACK = '\/beans'/.test(navRules), '兩個退回目標定義在 utils/navigation.ts')

  r.section('流程型：左上 ‹ 離開，沒有「取消」連結')
  for (const path of Object.keys(screens).filter(path => screens[path] === 'flow')) {
    const template = stripComments(templateOf(read(path)))
    r.check(/<PageHeader[\s\S]*?back-label="離開"/.test(template), `${path}：‹ 叫「離開」`)
    r.check(!/>\s*取消\s*</.test(template), `${path}：沒有「取消」——這裡離開不丟東西，暫存留著`)
    r.check(!/aria-label="新增/.test(template), `${path}：沒有新增按鈕`)
  }

  r.section('頂部角落只放 ‹ 與總覽的齒輪')
  const header = read('components/PageHeader.vue')
  r.check(/<BackButton/.test(header) && /<slot name="end"/.test(header), 'PageHeader：左 ‹、右側只有一個 slot')
  const endSlots = pages.filter(path => /<template #end>/.test(read(path)))
  r.check(endSlots.join() === 'pages/index.vue', `右側 slot 只有總覽在用${endSlots.length ? `：${endSlots.join('、')}` : ''}`)

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

  r.section('儲存與刪除後的跳轉不留下表單頁')
  for (const path of [
    'pages/brews/new.vue', 'pages/brews/[id]/edit.vue', 'pages/brews/[id]/index.vue',
    'pages/beans/new.vue', 'pages/beans/[id]/edit.vue', 'pages/beans/[id]/index.vue',
    'pages/equipment/new.vue', 'pages/equipment/[id]/edit.vue',
  ]) {
    const text = stripComments(read(path))
    r.check(/await exitTo\(/.test(text) && !/navigateTo\(/.test(text), `${path}：用 exitTo，不用 push`)
  }
  const back = read('components/BackButton.vue')
  const flowExit = read('composables/useFlowExit.ts')
  r.check(/label === '離開'\) \{\s*void leaveTo\(props\.to, props\.direct\)/.test(back), '流程型的 ‹ 離開走 leaveTo')
  r.check(/leaveMethod\(previousPage\(\), fallback, direct\) === 'back'\) \{\s*await goBack\(\)\s*return\s*\}\s*await navigateTo\(fallback, \{ replace: true \}\)/.test(flowExit),
    'leaveTo：有上一頁就退回上一頁，沒有才取代成依網址決定的目的地')
  r.check(/exitMethod\(previousPage\(\), target\) === 'back'/.test(flowExit), '儲存與刪除仍走 exitTo（落點不變）')
  r.check(/window\.history\.state\?\.back/.test(flowExit), '「上一頁」是路由器記在 history.state.back 的站內上一頁')
  r.check(/const leaveTo = newBrewLeaveTarget\(entry\)/.test(read('pages/brews/new.vue'))
    && /<PageHeader :title="copiedFrom \? '再沖一次' : '新增紀錄'" :back="leaveTo" back-label="離開" \/>/.test(read('pages/brews/new.vue')),
    '新增紀錄：沒有上一頁時的目的地照原有規則依網址決定')
  r.check(/beforeNavigate\(\)[\s\S]*?router\.back\(\)/.test(read('composables/useFlowExit.ts')),
    '回上一頁之前先等浮層退完（router.back 不經過導覽守衛）')

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
