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
  'pages/brews/[id]/summary.vue': 'flow',
  'pages/goal.vue': 'flow',
  'pages/brews/[id]/edit.vue': 'flow',
  'pages/beans/new.vue': 'flow',
  'pages/beans/[id]/edit.vue': 'flow',
  'pages/equipment/new.vue': 'flow',
  'pages/equipment/[id]/edit.vue': 'flow',
  'pages/s/[code].vue': 'share',
}
// 還沒進到產品裡，不屬於三種畫面
const outside = ['pages/login.vue', 'pages/signup.vue']
// 全螢幕的流程型：沒有分頁列、沒有 ‹（目標設定頁、結算頁，《03》§3）
const fullscreen = ['pages/goal.vue', 'pages/brews/[id]/summary.vue']

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
  r.check(/v-for="item in TABS"/.test(nav) && /props\.preview \? previewTab\.value : tabSection\(route\.path\)/.test(nav), '四格與亮格都來自 utils/navigation.ts')
  const navRules = read('utils/navigation.ts')
  r.check(/\{ to: '\/', label: '總覽', icon: 'home' \},\s*\{ to: '\/brews', label: '紀錄', icon: 'brew' \},\s*\{ to: '\/beans', label: '豆子', icon: 'bean' \},\s*\{ to: '\/equipment', label: '器材', icon: 'equip' \},/.test(navRules),
    '依序：總覽（/）、紀錄（/brews）、豆子（/beans）、器材（/equipment），各自的 icon')
  r.check(/<TabIcon :name="item\.icon" \/>\s*<span class="text-body-s">\{\{ item\.label \}\}<\/span>/.test(nav), 'icon 在上、文字（Body S）在下（2026-11-25）')
  r.check(/:aria-current="current === item\.to \? 'page' : undefined"/.test(nav) && /<nav\b/.test(nav), 'nav 與 aria-current 維持')

  r.section('分頁列：浮動膠囊（2026-11-25，Figma 的 Tab Bar 草稿）')
  const navCss = nav.match(/<style scoped>([\s\S]*)<\/style>/)?.[1] ?? ''
  const rule = sel => navCss.match(new RegExp(`${sel.replace(/[.[\]]/g, '\\$&')} \\{([^}]*)\\}`))?.[1] ?? ''
  const bar = rule('.tab-bar')
  r.check(/left: var\(--fixed-left\);/.test(bar) && /right: var\(--fixed-right\);/.test(bar), '左右和內容欄對齊（--fixed-left／right，含橫向的安全區）')
  r.check(/bottom: var\(--tab-bar-bottom\);/.test(bar) && /height: var\(--tab-bar-h\);/.test(bar) && /padding: var\(--tab-bar-pad\);/.test(bar), '高 64、內距 4、下緣在安全區之上')
  r.check(/background: var\(--surface\);/.test(bar) && /box-shadow: inset 0 0 0 1px var\(--border\), var\(--shadow-light\);/.test(bar) && !/backdrop-filter/.test(navCss), '--surface 底、內側 1px --border、--shadow-light，沒有毛玻璃')
  const tokens = read('assets/css/tokens.css')
  r.check(tokens.includes('--tab-bar-h: 64px;') && tokens.includes('--tab-bar-pad: 4px;'), 'token：64 高、內距 4')
  r.check(tokens.includes('--tab-bar-bottom: max(12px, calc(env(safe-area-inset-bottom) - 14px));'), '下緣：iPhone 20（對齊 iOS 原生的浮動分頁列），沒有安全區與橫向 12')
  const indicator = rule('.tab-bar__indicator')
  r.check(/background: var\(--surface-muted\);/.test(indicator) && /width: calc\(\(100% - 2 \* var\(--tab-bar-pad\)\) \/ 4\);/.test(indicator), '選中的膠囊：--surface-muted、四分之一寬')
  r.check(/transition: transform var\(--motion-duration\) var\(--motion-ease\);/.test(indicator), '膠囊用 transform 滑動，時間與曲線是 motion token')
  r.check(/:style="\{ transform: `translateX\(\$\{index \* 100\}%\)` \}"/.test(nav), '位置只由 index 決定（伺服器算繪就寫進 HTML，重新整理不會從第一格滑過去）')
  r.check(/v-if="index >= 0"/.test(nav), '不亮任何一格（分享頁）時不畫膠囊')
  const item = rule('.tab-bar__item')
  r.check(/transition: color var\(--motion-duration\) var\(--motion-ease\);/.test(item) && /color: var\(--text-muted\);/.test(item) && /color: var\(--accent\);/.test(rule('.tab-bar__item--active')),
    '顏色同時淡入淡出：未選 --text-muted、選中 --accent')
  r.check(/font-weight: 400;/.test(item) && !/font-body-medium|fontWeight|font-medium/.test(nav), '選中與未選都是 400（照 Figma，字寬不跳）')
  r.check(/gap: 2px;/.test(item) && /flex: 1 1 0;/.test(item), '四格等寬，icon 與文字間距 2')
  r.check(!/prefers-reduced-motion/.test(navCss) && /transition-duration: 0\.01ms !important;/.test(read('assets/css/main.css')),
    '減少動態：靠全站的規則直接切換，分頁列沒有例外')
  r.check(/useInputModality\(\)/.test(nav) && /\.tab-bar__item:focus-visible \{\s*outline: none;\s*\}/.test(navCss)
    && /\.tab-bar\[data-keyboard-focus="true"\] \.tab-bar__item:focus \{\s*outline: 2px solid var\(--accent\);\s*outline-offset: -2px;/.test(navCss),
    '焦點框只在鍵盤操作時畫，畫在格子內側')

  r.section('底部留白只在 app.vue（2026-11-25）')
  r.check(/:style="\{ height: tabBarSpace \}"/.test(app) && /route\.meta\.screen === 'browse' \? 'var\(--fab-clearance\)' : 'var\(--tab-bar-clearance\)'/.test(app),
    'app.vue 的 spacer：瀏覽型讓出分頁列加浮動按鈕，其他讓出分頁列')
  r.check(tokens.includes('--tab-bar-clearance: calc(var(--tab-bar-top) + 24px);') && tokens.includes('--fab-clearance: calc(var(--fab-bottom) + 56px + 16px);'),
    '最後一張卡片離分頁列 24、離浮動按鈕 16')
  const tabbed = ['pages/index.vue', 'pages/brews/index.vue', 'pages/beans/index.vue', 'pages/equipment/index.vue', 'pages/brews/[id]/index.vue', 'pages/beans/[id]/index.vue', 'pages/settings.vue']
  for (const path of tabbed) {
    const main = read(path).match(/<main\b[^>]*>/)?.[0] ?? ''
    r.check(main && !/\b(pb|py)-\S+/.test(main), `${path}：main 不自己留底部空白`)
  }
  r.check(/<main v-else class="mx-auto px-5 pt-6" :class="\{ 'pb-16': userId === null \}"/.test(read('pages/s/[code].vue')), '分享頁：沒登入（沒有分頁列）時才自己留')
  const all = [...pages, 'app.vue', ...readdirSync(new URL('../../components', import.meta.url)).filter(n => n.endsWith('.vue')).map(n => `components/${n}`)]
  r.check(all.every(path => !/52px \+ env|calc\(52px/.test(read(path))), '沒有寫死的舊分頁列高度（52px）')

  r.section('浮動新增按鈕在分頁列上方（2026-11-25）')
  for (const path of ['pages/index.vue', 'pages/brews/index.vue', 'pages/beans/index.vue', 'pages/equipment/index.vue']) {
    const src = read(path)
    r.check(/class="fab-position flex size-14 items-center justify-center rounded-full"/.test(src) && !/bottom-20|right-5 bottom/.test(src), `${path}：位置用 .fab-position`)
  }
  r.check(/\.fab-position \{\s*position: fixed;\s*z-index: 30;\s*right: var\(--fixed-right\);\s*bottom: var\(--fab-bottom\);/.test(read('assets/css/main.css')),
    '.fab-position：右緣對齊分頁列、下緣在分頁列之上')
  r.check(tokens.includes('--fab-bottom: calc(var(--tab-bar-top) + 12px);'), '按鈕離分頁列 12px')

  r.section('總覽：卡片')
  const homeScript = read('pages/index.vue')
  const homeTemplate = stripComments(home)
  r.check(/<PageHeader title="總覽">/.test(homeTemplate), '標題是「總覽」，保留齒輪')
  r.check(!/沖煮中的豆子|HomeBeanCard/.test(homeTemplate), '「沖煮中的豆子」拿掉了，由「最近沖煮」取代')
  r.check(!/BrewTimelineItem|載入更多|brewPage/.test(homeScript), '時間軸不在這裡（紀錄分頁）')
  const cardOrder = ['v-if="week"', 'v-if="last"', 'v-if="top"', 'v-if="totals"', 'v-if="month"'].map(marker => homeTemplate.indexOf(marker))
  r.check(cardOrder.every((at, i) => at > 0 && (i === 0 || at > cardOrder[i - 1])), '由上到下：目標環、最近沖煮、本週最高分、累計、本月')
  const goalCard = stripComments(templateOf(read('components/GoalWeekCard.vue')))
  const beanCard = stripComments(templateOf(read('components/OverviewBeanCard.vue')))
  const appCard = stripComments(templateOf(read('components/AppCard.vue')))
  r.check(/class="mt-6 grid grid-cols-2 gap-3"/.test(homeTemplate) && /<GoalWeekCard\s+v-if="week"\s+class="col-span-2"/.test(homeTemplate),
    '目標環全寬，永遠在最上面（GoalWeekCard，結算頁共用）')
  r.check(/<span role="heading" aria-level="2" class="min-w-0 text-heading-s font-medium">\{\{ title \}\}<\/span>/.test(appCard),
    'AppCard：標題 16px（Heading S）、字重 500，是卡片的第一個元素')
  r.check(/<AppCard[\s\S]*?title="本週目標"/.test(goalCard) && /<AppCard\s+:as="NuxtLink" :to="to" :title="title" arrow/.test(beanCard)
    && /<OverviewBeanCard\s+v-if="last"\s+title="最近沖煮"/.test(homeTemplate)
    && /<OverviewBeanCard\s+v-if="top"\s+:title="top\.week === 'this' \? '本週最高分' : '上週最高分'"/.test(homeTemplate)
    && /<AppCard\s+v-if="totals"[\s\S]*?title="累計"\s+arrow/.test(homeTemplate) && /<AppCard v-if="month" title="本月"/.test(homeTemplate),
    '標題文字：本週目標、最近沖煮、本週最高分／上週最高分、累計、本月')
  r.check(/<GoalRing :count="ringCount" :from="ringFrom" :goal="goal" :size="100"/.test(goalCard) && />記錄<\/span>/.test(goalCard),
    '目標環卡片：左邊 100px 的環，中間是「記錄」與數字，右邊是長條圖（Figma）')
  r.check(/class="corner-bar relative w-full rounded-full" :style="\{ height: `\$\{BAR_HEIGHT\}px`, background: 'var\(--accent-wash\)' \}">\s*<span\s+v-if="cups"\s+class="corner-bar absolute inset-x-0 bottom-0 rounded-full"/.test(goalCard),
    '每一天都有全高的底軌（--accent-wash），杯數的長條疊在上面；0 杯的那一天只有底軌')
  const goalCardFile = read('components/GoalWeekCard.vue')
  r.check(!/over-?[tT]ext/.test(homeTemplate + goalCard) && !/props\.overText/.test(goalCardFile)
    && /if \(props\.count >= props\.goal\) return '達成目標'/.test(goalCardFile) && !/超過 \$\{/.test(goalCardFile)
    && /const ringCount = computed\(\(\) => Math\.min\(props\.count, props\.goal\)\)/.test(goalCardFile)
    && /<GoalRing :count="ringCount" :from="ringFrom"/.test(goalCard)
    && !/accent-active|laps\.second/.test(read('components/GoalRing.vue')),
    '達到或超過目標（N ≥ M）：環停在一圈，寫「達成目標」（2026-11-26，不再寫「超過 N 杯」），不畫第二圈')
  r.check(/const filled = ref\(ringFrom\.value === null \|\| ringFrom\.value === ringCount\.value\)/.test(goalCardFile),
    '結算頁上已經超過目標之後的紀錄：環沒有動畫，數字直接是存檔後的杯數')

  r.section('總覽：固定高度與空狀態（2026-11-16 定案）')
  r.check(/--overview-card-h: 169px/.test(read('assets/css/tokens.css')), '卡片高度是一個 token（Figma 的 169px）')
  r.check(/:style="\{ height: 'var\(--overview-card-h\)' \}"/.test(beanCard) && !/aspect-square': !wide|aspect-square'\s*:/.test(beanCard),
    '最近沖煮、最高分：固定高度，全寬時也一樣')
  r.check((homeTemplate.match(/:style="CARD_HEIGHT"/g) ?? []).length === 2 && /const CARD_HEIGHT = \{ height: 'var\(--overview-card-h\)' \}/.test(homeScript)
    && !/aspect-square/.test(homeTemplate), '累計、本月：同一個固定高度，不再是正方形')
  r.check(/const firstRowWide = computed\(\(\) => !!last\.value !== !!top\.value\)/.test(homeScript)
    && /const secondRowWide = computed\(\(\) => !!totals\.value !== !!month\.value\)/.test(homeScript)
    && (homeTemplate.match(/:class="\{ 'col-span-2': firstRowWide \}"/g) ?? []).length === 2 && /:class="\{ 'col-span-2': secondRowWide \}"/.test(homeTemplate),
    '同一排只剩一張：那一張全寬，不往前遞補')
  r.check(/<AppCard v-if="noRecords" radius="ml" class="col-span-2[^"]*">[\s\S]*?還沒有紀錄[\s\S]*?<AppButton :to="newBrewLink">新增紀錄<\/AppButton>/.test(homeTemplate),
    '完全沒有紀錄：一張全寬的說明卡片加「新增紀錄」')
  r.check(/:footer="top\.week === 'last' \? `上週\$\{weekdayShort\(top\.brew\.brewed_at\)\}，本週未評分` : weekdayOf\(top\.brew\.brewed_at\)"/.test(homeTemplate)
    && /:name-lines="top\.week === 'last' \? 1 : 2"/.test(homeTemplate),
    '上週最高分：最下面一行「上週六，本週未評分」，豆名一行（2026-11-23）')
  const overviewBeanCard = read('components/OverviewBeanCard.vue')
  r.check(!/\bnote\b/.test(overviewBeanCard.replace(/\/\/.*$/gm, '')) && (overviewBeanCard.match(/class="[^"]*\btruncate text-body-s tabular-nums text-muted"/g) || []).length === 2,
    '最下面一行不換行、放不下截斷；note 拿掉了')
  r.check(!/emptyVariant|variantB|OverviewHintCard/.test(homeScript) && !/dashboardRows/.test(read('utils/dashboard.ts')),
    '方案開關、沒選上的方案與沒有在用的 dashboardRows 都刪掉了')
  r.check(/\{\{ shown \}\}／\{\{ goal \}\}<\/span>\s*<span[^>]*>杯<\/span>/.test(goalCard) && !/本週 \{\{/.test(goalCard + homeTemplate),
    '「N／M 杯」，不和標題重複「本週」')
  const metrics = [...homeTemplate.matchAll(/<MetricValue :value="([\w.]+)" unit="(.)" \/>/g)].map(m => `${m[1]}${m[2]}`)
  r.check(metrics.join() === 'totals.records筆,totals.beans支,month.cups筆,month.dose克', '累計與本月：指標數字加單位')
  r.check(/@click="editing = true"/.test(homeTemplate) && /<GoalDialog/.test(homeTemplate), '點目標環卡片打開修改目標的對話框')
  r.check(/:to="`\/beans\/\$\{last\.beanId\}`"/.test(homeTemplate) && !/<button/.test(beanCard), '最近沖煮：點了進豆子詳情，卡片上不放按鈕')
  r.check(/:to="`\/brews\/\$\{top\.brew\.id\}`"/.test(homeTemplate), '最高分：點了進紀錄詳情')
  r.check(/v-if="totals"\s+:as="NuxtLink"\s+to="\/brews"/.test(homeTemplate), '累計：點了進紀錄分頁')
  r.check(/\.eq\('is_sample', false\)/.test(read('composables/useBrewStats.ts')), '統計的查詢排除範例紀錄')
  r.check(/newBrewEntry\(activeBeans\.value\)/.test(homeScript), '浮動新增按鈕：只有一支未喝完的豆子時帶入')
  r.check(!/#[0-9a-f]{3,6}\b/i.test(homeTemplate + read('components/GoalRing.vue') + read('components/GoalStepper.vue') + read('components/BeanThumb.vue')),
    '沒有寫死的色碼（品牌色會更換）')

  r.section('紀錄分頁：一筆一張紀錄卡片（2026-11-23）')
  const brews = read('pages/brews/index.vue')
  const brewsTemplate = stripComments(templateOf(brews))
  r.check(/<PageHeader title="紀錄" \/>/.test(brewsTemplate), '標題是「紀錄」')
  r.check(/const PAGE_SIZE = 20/.test(brews) && /\.range\(from, from \+ PAGE_SIZE - 1\)/.test(brews), '一次 20 筆')
  r.check(/\.order\('brewed_at', \{ ascending: false \}\)\s*\.order\('id', \{ ascending: false \}\)/.test(brews), '依沖煮日期新到舊')
  const brewsQuery = brews.slice(brews.indexOf('async function fetchBrewPage'), brews.indexOf('async function load()'))
  r.check(!/\.eq\(|\.ilike\(|\.filter\(|\.in\(/.test(brewsQuery) && !/type="search"|<select/.test(brewsTemplate), '沒有篩選、排序、搜尋')
  // 卡片只呈現「這一杯」，差異只在紀錄詳情與結算頁（《02》§4.2）
  r.check(!/compareTargetId|computeBrewDiff|diffs/.test(brews), '列表不算比較對象與差異')
  const enrich = brews.slice(brews.indexOf('async function enrichEntries'), brews.indexOf('const cache = useQueryCache()'))
  r.check((enrich.match(/supabase\.from\(/g) || []).length === 1 && /thumbnailUrls\(/.test(enrich) && !/for \([^)]*\)\s*\{[^}]*supabase/.test(enrich),
    '一頁只補一次分段（總水量）與一次縮圖網址，不是每一列各發一次')
  r.check(/<BrewCard\b[\s\S]*?:id="entry\.id"/.test(brewsTemplate) && !/BrewTimelineItem/.test(brews), '每一筆是一張紀錄卡片（BrewCard）')
  const card = read('components/BrewCard.vue')
  r.check(/<AppCard :as="NuxtLink" :to="`\/brews\/\$\{id\}`" radius="ml"/.test(card) && !/<button|<AppButton/.test(card),
    '整張卡片連到紀錄詳情，圓角 ml，卡片上沒有按鈕')
  r.check(/<ul v-else class="mt-6 space-y-3">/.test(brewsTemplate) && !/border-t/.test(brewsTemplate),
    '卡片間距和豆子列表一樣（space-y-3），每列上方沒有分隔線')
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
  r.check(/<PageHeader :back="BREW_BACK_FALLBACK" \/>/.test(brewDetail), '紀錄詳情：沒有上一頁時回紀錄分頁')
  r.check(/<PageHeader :back="BEAN_BACK_FALLBACK" \/>/.test(beanDetail), '豆子詳情：沒有上一頁時回豆子列表')
  r.check(/<PageHeader title="設定" :back="SETTINGS_BACK_FALLBACK" \/>/.test(read('pages/settings.vue')), '設定：沒有上一頁時回總覽')
  const backButton = read('components/BackButton.vue')
  r.check(/historyBack\(window\.history\.state\?\.back\) === 'back'\) void goBack\(\)\s*else void navigateTo\(props\.to\)/.test(backButton),
    '檢視型的 ‹ 一律是歷史式：有上一頁回上一頁，沒有才回父層')
  r.check(!/<NuxtLink/.test(backButton) && !/history\?: boolean/.test(backButton), '沒有階層式的一般連結了')

  r.section('紀錄詳情：豆名是通往豆子詳情的連結')
  const brewDetailTemplate = stripComments(templateOf(brewDetail))
  const title = brewDetailTemplate.match(/<h1 class="min-w-0 text-display-m font-medium">([\s\S]*?)<\/h1>/)?.[1] ?? ''
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

  r.section('全螢幕的流程型：沒有 ‹（目標設定頁、結算頁）')
  for (const path of fullscreen) {
    const template = stripComments(templateOf(read(path)))
    r.check(!/<PageHeader|<BackButton/.test(template) && !/略過/.test(template), `${path}：沒有 ‹、沒有「略過」`)
  }

  r.section('流程型：左上 ‹ 離開，沒有「取消」連結')
  for (const path of Object.keys(screens).filter(path => screens[path] === 'flow' && !fullscreen.includes(path))) {
    const template = stripComments(templateOf(read(path)))
    r.check(/<PageHeader[\s\S]*?back-label="離開"/.test(template), `${path}：‹ 叫「離開」`)
    r.check(!/>\s*取消\s*</.test(template), `${path}：沒有「取消」——這裡離開不丟東西，暫存留著`)
    r.check(!/aria-label="新增/.test(template), `${path}：沒有新增按鈕`)
  }

  r.section('結算頁：只在新增紀錄儲存成功後出現')
  const newPage = stripComments(read('pages/brews/new.vue'))
  r.check(/summaryTicket\.value = brewId\s*await navigateTo\(summaryPath\(brewId\), \{ replace: true \}\)/.test(newPage),
    '新增紀錄存好之後：記下 ticket，用取代的方式進結算頁（返回時不會回到表單）')
  r.check(!/exitTo\(`\/brews\/\$\{brewId\}`\)/.test(newPage) && (newPage.match(/navigateTo\(/g) || []).length === 1,
    '只有存好的那一條路會去結算頁（分段失敗後重按、補寫成功也走同一條）')
  r.check(/pendingBrewId\.value = null[\s\S]*summaryPath\(brewId\)/.test(newPage), '補寫成功也走到結算頁')
  r.check(/await exitTo\(`\/brews\/\$\{id\.value\}`\)/.test(read('pages/brews/[id]/edit.vue')) && !/summary/.test(read('pages/brews/[id]/edit.vue')),
    '編輯儲存後照舊回紀錄詳情')
  const summary = read('pages/brews/[id]/summary.vue')
  const summaryTemplate = stripComments(templateOf(summary))
  r.check(/const access = summaryAccess\(ticket\.value, id\)/.test(summary) && /await navigateTo\(`\/brews\/\$\{id\}`, \{ replace: true \}\)/.test(summary),
    '直接打開網址、重新整理、之後再進來：導向這筆紀錄的詳情')
  r.check(/ticket\.value = null/.test(summary), '進來時用掉 ticket：只出現這一次')
  r.check(/let leavingByPage = access === 'detail'/.test(summary), '導向詳情是頁面自己發的，不會被攔成去總覽')
  r.check(/onBeforeRouteLeave\(\(\) => \{\s*const result = summaryLeave\(leavingByPage\)/.test(summary), '返回鍵與返回手勢：效果和按勾勾一樣')
  r.check(/async function done\(\) \{\s*leavingByPage = true\s*await navigateTo\('\/', \{ replace: true \}\)/.test(summary), '勾勾：用取代的方式去總覽')
  r.check(/async function openDetail\(\) \{\s*leavingByPage = true\s*await navigateTo\(`\/brews\/\$\{id\}`, \{ replace: true \}\)/.test(summary),
    '沖煮參數卡片：用取代的方式進紀錄詳情，返回時不會回到結算頁')
  // 2026-11-17：按鈕抽成 DoneButton，分段子頁也用同一個
  const doneButton = read('components/DoneButton.vue')
  r.check(/<DoneButton[^>]*@click="done"/.test(summaryTemplate)
    && /aria-label="完成"[\s\S]{0,600}<path d="M20 6 9 17l-5-5" \/>/.test(doneButton) && /rounded-full/.test(doneButton), '右上角是圓形按鈕，中間放勾勾（完成）')
  // 2026-11-26：結算頁改版（Figma 結算頁 v2）。主圖、小數據列、比較區、沖煮參數；第一杯是沖煮參數與這支豆子
  r.check(/<template #actions>\s*<BrewShare\s+floating[\s\S]*?\/>\s*<DoneButton floating @click="done" \/>\s*<\/template>/.test(summaryTemplate),
    '右上角：分享（和紀錄詳情同一個元件）在左、完成在右；DOM 順序就是鍵盤順序')
  const hero = read('components/BrewHero.vue')
  r.check(/<BrewHeroFallback v-else/.test(hero) && !/BeanArt|roast-art/.test(stripComments(templateOf(hero))),
    '主圖：沒有照片時交給 BrewHeroFallback，BrewHero 不碰那張圖的內容')
  r.check(/signedUrl\(path\)/.test(summary) && !/thumbnailUrl/.test(summary), '主圖用原圖，不用縮圖')
  r.check(/--hero-h: min\(470px, 58svh\);/.test(hero) && /min-height: var\(--hero-h\);/.test(hero), '主圖高度：min(470px, 58svh)')
  r.check(/padding-top: max\(96px, calc\(var\(--hero-h\) \* 0\.55\)\);/.test(hero), '標題的頂端不高於主圖的 55%：豆名很長時主圖往下長')
  // 2026-11-26 第三版（iPhone 驗收）：主圖是固定的背景層，內容從上面滑過去；捲動時兩層（清楚＋預先模糊）只改透明度
  const heroTemplate = templateOf(hero)
  r.check(/<div class="brew-hero__bg" aria-hidden="true">\s*(?:<!--[\s\S]*?-->\s*)?<div class="brew-hero__layer brew-hero__layer--blurred"[\s\S]*?<div class="brew-hero__layer brew-hero__layer--clear">[\s\S]*?<div class="brew-hero__fade" \/>\s*<\/div>/.test(heroTemplate)
    && /\.brew-hero__bg \{[^}]*position: fixed;[^}]*z-index: 0;[^}]*height: max\(var\(--hero-h\), var\(--hero-solid\)\);/.test(hero)
    && /\.brew-hero__title \{\s*position: relative;\s*z-index: 1;/.test(hero) && /class="relative z-1 pt-5"/.test(summaryTemplate),
    '主圖：背景層（模糊、清楚兩層與漸層）固定在畫面頂端、高度蓋到漸層的實底；標題區與結算頁下面的內容是上層（z-index 1），從背景上滑過去')
  r.check(/\.brew-hero__blur \{\s*filter: blur\(var\(--hero-blur-end\)\);/.test(hero) && /--hero-blur-end: 20px;/.test(hero) && /--hero-opacity-end: 0;/.test(hero)
    && !(hero.match(/@keyframes[^{]*\{(?:\s*[^{}]*\{[^}]*\})*\s*\}/g) ?? []).some(k => /filter/.test(k)) && !/setProperty\('filter'|style\.filter/.test(hero),
    '模糊是下層預先套好的靜態 filter；捲動時不改 filter。終點的模糊與透明度是變數（照片的終點透明度 0）')
  // 2026-11-27：透明度一律由程式驅動（iPhone 實機上 CSS 的捲動連動動畫捲過終點才一次跳到結尾）。只有抵銷捲動的平移還用 CSS
  const animated = [...hero.matchAll(/animation(?:-name)?: ([\w-]+)/g)].map(m => m[1])
  r.check(animated.length === 1 && animated[0] === 'brew-hero-follow' && (hero.match(/@keyframes/g) || []).length === 1
    && !/hold|HERO_FADE_STOPS|--hero-fade-end|min\(var/.test(stripComments(hero))
    && /\.brew-hero__layer--clear \{\s*opacity: var\(--hero-clear, 1\);/.test(hero) && /\.brew-hero__layer--blurred \{\s*opacity: var\(--hero-blurred, 1\);/.test(hero)
    && /const FADE_RATIO = 0\.6/.test(hero) && /fadeEnd = Math\.max\(1, Math\.min\(Number\.parseFloat\(style\.minHeight\) \* FADE_RATIO, maxScroll\)\)/.test(hero),
    '透明度：不用 CSS 的捲動連動動畫（唯一的動畫是抵銷捲動的平移）；兩層的 opacity 由程式寫的變數決定；終點是 60% 與能捲到的最大距離取小')
  r.check(!/if \(fallback\)|if \(CSS\.supports/.test(hero) && /window\.addEventListener\('scroll', onScroll, \{ passive: true \}\)/.test(hero) && /observer\.observe\(document\.body\)/.test(hero)
    && /requestAnimationFrame\(apply\)/.test(hero) && /const t = Math\.min\(1, Math\.max\(0, window\.scrollY \/ fadeEnd\)\)/.test(hero) && /heroLayers\(t, opacityEnd\)/.test(hero)
    && !/getBoundingClientRect|offsetTop|offsetHeight|getComputedStyle/.test(hero.match(/function apply\(\) \{[\s\S]*?\n\}/)?.[0] ?? 'x'),
    '透明度一律走程式（不分瀏覽器）：passive 的 scroll 事件＋requestAnimationFrame，進度限制在 0 到 1，用 heroLayers 寫入兩層的透明度，捲動時不讀版面；終點用 ResizeObserver 量')
  // 2026-11-26 第四版：iOS 26 的 Safari 拿貼頂的 fixed 元素的底色填狀態列。支援捲動連動動畫時不用 fixed，改成 absolute＋抵銷捲動的平移
  r.check(/@supports \(animation-timeline: scroll\(\)\) \{\s*\.brew-hero__bg \{[^}]*position: absolute;[^}]*animation: brew-hero-follow linear both;\s*animation-timeline: scroll\(root block\);\s*animation-range: 0 var\(--hero-follow\);/.test(hero)
    && /@keyframes brew-hero-follow \{\s*from \{ transform: translateY\(0\); \}\s*to \{ transform: translateY\(var\(--hero-follow\)\); \}/.test(hero)
    && /<main class="mx-auto overflow-clip pb-16"/.test(summaryTemplate),
    '背景層：支援捲動連動動畫時是 absolute＋一比一抵銷捲動的平移（不是 fixed，Safari 不會拿它的底色填狀態列）；main 是 overflow: clip，平移不撐大捲動範圍')
  // 2026-11-26 第五版：漸層只有一條，標題區背後跟著捲動的那層拿掉；位置照實際版面量（標題頂端、第一個段落的頂端）
  const fade = hero.match(/\.brew-hero__fade \{[\s\S]*?\n\}/)?.[0] ?? ''
  const alphas = [...fade.matchAll(/var\(--bg\) ([\d.]+)%, transparent\)/g)].map(m => Number(m[1]))
  r.check(/--g0: calc\(var\(--hero-title-top\) - var\(--hero-fade-len\)\);\s*--g1: var\(--hero-title-top\);\s*--g2: var\(--hero-solid\);/.test(fade)
    && /var\(--bg\) var\(--g2\)\s*\);/.test(fade) && alphas.length === 8 && alphas[0] === 0 && alphas.every((a, i) => i === 0 || a > alphas[i - 1]) && alphas.at(-1) < 100
    && !/::before/.test(hero) && !/hero-title-fade/.test(hero) && !/animation/.test(fade),
    '主圖的漸層：一條、由上往下只會越來越不透明，到第一個段落的頂端剛好 100%；標題區背後沒有另一層；漸層不淡出')
  r.check(/el\.style\.setProperty\('--hero-title-top'/.test(hero) && /el\.style\.setProperty\('--hero-solid'/.test(hero)
    && /new ResizeObserver\(\(\) => measure\(\)\)/.test(hero) && /function measure\(\) \{\s*measureLayout\(\)/.test(hero)
    && /:solid-at="sections"/.test(summaryTemplate) && /<div ref="sections" class="mt-8 flex flex-col"/.test(summaryTemplate),
    '漸層的兩個位置在掛載與版面改變時量（ResizeObserver，兩條路都量）；實底的位置是結算頁的第一個段落')
  const tokensCss = read('assets/css/tokens.css')
  r.check(/--float-shadow: 0 0 \d+px rgb\([^)]*\);/.test(tokensCss)
    && /box-shadow: var\(--float-shadow\);/.test(read('components/BrewShare.vue'))
    && /boxShadow: floating \? 'var\(--float-shadow\)' : undefined/.test(read('components/DoneButton.vue'))
    && (summaryTemplate.match(/<DoneButton floating @click="done" \/>/g) || []).length === 2,
    '懸浮按鈕的陰影：--float-shadow（x、y 都是 0，只有模糊），分享與完成（含讀取中）同一個')
  r.check(/\.brew-hero__actions \{[^}]*position: fixed;[^}]*top: calc\(env\(safe-area-inset-top\) \+ 40px\);[^}]*right: var\(--fixed-right\);/.test(hero),
    '分享與完成固定在畫面頂端，右緣和分頁列同一條線')
  r.check(/padding-inline: calc\(var\(--form-gutter\) \+ var\(--card-pad\)\);/.test(hero) && /paddingLeft: 'var\(--card-pad\)'/.test(summary),
    '主圖的標題區與小數據列：和段落標題同一條線（頁面內距＋--card-pad，用 token 算）')
  r.check(/<BeanArt background="transparent" whole \/>/.test(read('components/BrewHeroFallback.vue')), '沒有照片：BeanArt 的三顆豆子完整畫出來（whole），沿用同一組圖檔')
  r.check(/<p v-if="roaster"[^>]*>\{\{ roaster \}\}<\/p>/.test(summaryTemplate) && /<h1 class="text-display-l font-medium break-words">\{\{ beanName \}\}<\/h1>/.test(summaryTemplate)
    && /\?\? '沒有指定豆子'/.test(summary), '標題區：咖啡店名（沒有就不顯示）、豆名（Display L，換行不截斷；沒有豆子寫「沒有指定豆子」）')
  r.check(/<p v-if="ring"[\s\S]*?<GoalRing[\s\S]*?:size="26"[\s\S]*?:celebrate="ring\.crossed"/.test(summaryTemplate)
    && /`本週 \$\{shown\}／\$\{r\.goal\} 杯，達成目標`/.test(summary) && /`本週 \$\{shown\}／\$\{r\.goal\} 杯`/.test(summary)
    && /summaryRing\(stats\.value, goals\.value, id, now\)/.test(summary),
    '本週目標：小環＋一行字，斜線是全形（和總覽一致）；達到或超過寫「達成目標」；這一筆不在本週時整行不出現')
  r.check(!/GoalWeekCard|BeanThumb/.test(summaryTemplate) && !/這一杯<\/h2>|筆紀錄/.test(summaryTemplate),
    '拿掉：本週目標卡片、縮圖加豆名的摘要列、「第 N 筆紀錄」、「這一杯」')
  r.check(/label: '評分'/.test(summary) && /restDayValue\(beanInfo\.value\?\.restDay\)/.test(summary)
    && /isFirstRecord\(stats\.value, id\) \? '第一筆' : `第 \$\{records\} 筆`/.test(summary)
    && /if \(firstCup\.value && ordinal > 0\) items\.push\(\{ label: '豆子', value: `第 \$\{ordinal\} 支` \}\)/.test(summary),
    '小數據列：評分、養豆（restDayValue）、紀錄（第一筆／第 N 筆）、豆子（只在第一杯）')
  r.check(/<BrewCompareSection v-if="comparison\?\.target" :comparison="comparison" summary :feedback="feedback" \/>/.test(summaryTemplate)
    && /<BrewCompareSection v-if="comparison" :comparison="comparison" \/>/.test(read('pages/brews/[id]/index.vue')),
    '比較區：詳情頁和結算頁共用 BrewCompareSection，差別只有 summary 這個 prop')
  const compareSection = read('components/BrewCompareSection.vue')
  r.check(/`參數和 \$\{date\.value\} 那一杯相同。`/.test(compareSection) && /rating && rating\.before !== rating\.after \? \[rating\] : \[\]/.test(compareSection)
    && /\(props\.summary \|\| rows\.value\.length > 0\)/.test(compareSection),
    '結算頁：參數相同時一句話，評分不同才接評分那一列；詳情頁沒有任何一列時整段不顯示')
  r.check(/<FormSection title="沖煮參數">[\s\S]*?<AppCard\s+as="a"[\s\S]*?@click\.prevent="openDetail"[\s\S]*?<\/AppCard>[\s\S]*?<FormNote>下一杯會和這一杯比較。<\/FormNote>/.test(summaryTemplate)
    && !/chevron|m9 18 6-6-6-6/.test(summaryTemplate), '沖煮參數：整張卡片可點、不加 ›；第一杯時卡片下方是「下一杯會和這一杯比較。」')
  r.check(/<FormSection v-if="firstCup && beanInfo\?\.rows\.length" title="這支豆子">/.test(summaryTemplate), '這支豆子：只在第一杯，有填才出現')
  r.check(/if \(compared\?\.target\) feedback\.value = feedbackLine\(compared\.diffs, compared\.target\.rating, row\.rating, true\)/.test(summary)
    && !/恭喜開箱新豆子/.test(summary), '回饋句：只有有比較對象時；第一杯不再有「恭喜開箱新豆子。」')
  const summaryText = summaryTemplate.replace(/<style[\s\S]*?<\/style>/g, '').replace(/\{\{[\s\S]*?\}\}/g, '').replace(/<(?:[^>"']|"[^"]*"|'[^']*')*>/g, ' ').split(/\s+/).filter(Boolean)
  const summaryAllowed = new Set(['收藏', '前往紀錄：', '下一杯會和這一杯比較。'])
  const summaryExtra = summaryText.filter(word => !summaryAllowed.has(word))
  r.check(summaryExtra.length === 0, `結算頁沒有規定以外的文案${summaryExtra.length ? `：${summaryExtra.join('、')}` : ''}`)
  r.check(!/#[0-9a-f]{3,6}\b/i.test(summaryTemplate + stripComments(hero)) && !/from ['"](gsap|animejs|motion|framer|@vueuse\/motion)/.test(summary), '沒有寫死的色碼、沒有動畫函式庫')
  r.check(/prefers-reduced-motion/.test(read('components/GoalRing.vue')), '減少動態效果時不播動畫')

  r.section('目標設定頁')
  const goalPage = read('pages/goal.vue')
  const goalTemplate = stripComments(templateOf(goalPage))
  r.check(/<h1[^>]*>設定每週記錄目標<\/h1>/.test(goalTemplate) && /<GoalStepper v-model="cups" \/>/.test(goalTemplate), '標題與加減按鈕')
  r.check(/之後可以在總覽修改。/.test(goalTemplate) && />\s*開始\s*</.test(goalTemplate), '說明一行、按鈕「開始」')
  r.check(/const cups = ref\(GOAL_DEFAULT\)/.test(goalPage), '預設 3 杯')
  r.check(/await navigateTo\('\/', \{ replace: true \}\)/.test(goalPage), '開始之後用取代的方式去總覽，返回時不會再回到這一頁')
  const middleware = read('middleware/goal-setup.global.ts')
  r.check(/needsGoalSetup\(to\.path, userId !== null, false\)/.test(middleware) && /navigateTo\(GOAL_SETUP_PATH, \{ replace: true \}\)/.test(middleware),
    '已登入、沒有任何目標時，先到目標設定頁（全站的 middleware）')
  r.check(/if \(error\) return/.test(middleware), '查詢失敗不擋')
  r.check(!/import\.meta\.server\) return/.test(middleware) && /import\.meta\.client && useNuxtApp\(\)\.isHydrating\) return/.test(middleware),
    '整頁載入由伺服器判斷（直接 302），瀏覽器不在 hydration 途中導向——那會讓 /goal 沿用前一頁 HTML 的屬性')
  const stepper = read('components/GoalStepper.vue')
  r.check(/:disabled="atMin"/.test(stepper) && /:disabled="atMax"/.test(stepper) && /<span>杯<\/span>/.test(stepper), '加減按鈕：到邊界時停用，數字旁是「杯」')
  const goalDialog = read('components/GoalDialog.vue')
  r.check(/>每週記錄目標</.test(goalDialog) && /useOverlayHistory\(/.test(goalDialog), '修改目標的對話框：標題「每週記錄目標」，返回鍵等同取消')
  r.check(/from\('weekly_goals'\)\s*\.insert\(/.test(goalDialog) && !/\.update\(|\.delete\(/.test(goalDialog) && /invalidateAfter\(\{ kind: 'goal' \}\)/.test(goalDialog),
    '儲存是新增一列（不改舊的），清掉目標的快取')

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
    'pages/brews/[id]/edit.vue', 'pages/brews/[id]/index.vue',
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
