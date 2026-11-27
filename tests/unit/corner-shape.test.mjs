// 轉角形狀（corner-shape，《03》§2.3，2026-11-19）。
// 漸進增強：不支援的瀏覽器（Safari、Firefox，含 iPhone 上所有瀏覽器）忽略，維持一般圓角。
// 守住四件事：每一類元素吃自己的 token（/dev/corners 才調得動）；值是使用者調好的那一組；
// 調整頁的預設值和 tokens.css 一致；正圓沒有被套上。

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { createReport } from '../helpers/report.mjs'

const root = new URL('../../', import.meta.url)
const read = path => readFileSync(new URL(path, root), 'utf8')

export default function run() {
  const r = createReport('轉角形狀')

  const tokens = read('assets/css/tokens.css')
  r.section('每一類元素一個 token（2026-11-19 使用者在 /dev/corners 調好的值）')
  const values = [
    ['--corner-card-pill', 'superellipse(1.2)'], ['--corner-card-pill-tall', 'superellipse(1.2)'], ['--corner-block-button', 'superellipse(1.2)'], ['--corner-sheet-pill', 'superellipse(1.1)'],
    ['--corner-chip', 'superellipse(1.1)'], ['--corner-toggle', 'superellipse(1.1)'], ['--corner-bar', 'superellipse(1.1)'],
    ['--corner-card-ml', 'superellipse(1.1)'], ['--corner-card-md', 'superellipse(1.1)'], ['--corner-card-lg', 'superellipse(1.1)'],
    // 2026-11-25：底部分頁列與選中的膠囊是 round（正半圓，和 iOS 原生的浮動分頁列一致；原本 1.2，實機比對後改回）
    ['--corner-tab-bar', 'round'], ['--corner-tab-indicator', 'round'],
  ]
  for (const [token, value] of values) r.check(tokens.includes(`${token}: ${value};`), `${token}: ${value}`)
  for (const [token, value] of [['--radius-card-ml', '18px'], ['--radius-card-md', '24px'], ['--radius-card-lg', 'var(--radius-lg)'], ['--radius-card-pill', 'var(--radius-pill)'], ['--radius-card-pill-tall', 'var(--radius-pill-tall)'], ['--radius-block-button', 'var(--radius-pill)']])
    r.check(tokens.includes(`${token}: ${value};`), `${token}: ${value}`)
  r.check(tokens.includes('--radius-md: 12px;'), '--radius-md 本身維持 12px：卡片吃的是 --radius-card-*')
  const overviewSkeletons = read('pages/index.vue').match(/<SkeletonBlock[^>]*>/g) || []
  r.check(overviewSkeletons.length === 3 && overviewSkeletons.every(s => /radius="var\(--radius-card-ml\)"/.test(s) && /card-ml-corners/.test(s)),
    '總覽載入中的骨架和卡片同一個半徑（ml）')

  r.section('調整頁的預設值和 tokens.css 一致')
  const dev = read('dev/corners.vue')
  for (const [token, value] of values) {
    const k = value === 'round' ? 1 : Number(value.match(/superellipse\(([\d.]+)\)/)[1])
    r.check(new RegExp(`token: '${token}', shape: ${k}, defaultShape: ${k}`).test(dev), `dev/corners.vue：${token} 從 ${k} 開始`)
  }
  r.check(/token: '--radius-card-ml', value: 18, default: 18/.test(dev), 'dev/corners.vue：分頁第一層的卡片從 18px 開始')
  r.check(/token: '--radius-card-md', value: 24, default: 24/.test(dev), 'dev/corners.vue：其他獨立的卡片從 24px 開始')
  r.check(/token: '--radius-card-pill', value: 28, default: 28/.test(dev), 'dev/corners.vue：56 的列的單列卡片從 28px 開始')
  r.check(/token: '--radius-card-pill-tall', value: 32\.5, default: 32\.5/.test(dev), 'dev/corners.vue：65 的列的單列卡片從 32.5px 開始')
  r.check(/token: '--radius-block-button', value: 28, default: 28/.test(dev), 'dev/corners.vue：滿寬按鈕從 28px 開始')

  r.check(!/--pill-corner-shape/.test(tokens), '共用的 --pill-corner-shape 已經拆掉')

  r.section('元件吃自己的 token')
  const css = read('assets/css/main.css')
  const card = read('components/AppCard.vue')
  for (const kind of ['ml', 'md', 'lg', 'pill', 'pill-tall'])
    r.check(new RegExp(`\\.app-card--${kind} \\{\\s*border-radius: var\\(--radius-card-${kind}\\);\\s*corner-shape: var\\(--corner-card-${kind}\\);`).test(card), `AppCard 的 ${kind}`)
  r.check(/\.app-button--block \{[^}]*min-height: var\(--sheet-row-h\);[^}]*border-radius: var\(--radius-block-button\);[^}]*corner-shape: var\(--corner-block-button\);/.test(read('components/AppButton.vue')), '滿寬按鈕：56px（--sheet-row-h）、圓角是高度的一半、轉角')
  r.check(/\.sheet-pill \{[^}]*corner-shape: var\(--corner-sheet-pill\);/.test(css), '下拉與日期的膠囊、分秒框（.sheet-pill）')
  r.check(/\.choice-chip \{[^}]*corner-shape: var\(--corner-chip\);/.test(read('components/ChoiceChip.vue')), '風味標籤')
  r.check(/\.corner-toggle \{\s*corner-shape: var\(--corner-toggle\);/.test(css) && (read('components/ToggleSwitch.vue').match(/class="corner-toggle /g) || []).length === 2, '開關的軌道與圓鈕')
  r.check(/\.corner-bar \{\s*corner-shape: var\(--corner-bar\);/.test(css) && (read('components/GoalWeekCard.vue').match(/class="corner-bar /g) || []).length === 2, '每日長條的底軌與長條')

  const nav = read('components/BottomNav.vue')
  r.check(/\.tab-bar \{[^}]*border-radius: var\(--radius-tab-bar\);\s*corner-shape: var\(--corner-tab-bar\);/.test(nav), '底部分頁列')
  r.check(/\.tab-bar__indicator \{[^}]*border-radius: var\(--radius-tab-indicator\);\s*corner-shape: var\(--corner-tab-indicator\);/.test(nav), '分頁列裡選中的膠囊')
  r.check(tokens.includes('--radius-tab-bar: calc(var(--tab-bar-h) / 2);') && tokens.includes('--radius-tab-indicator: calc(var(--radius-tab-bar) - var(--tab-bar-pad));'),
    '分頁列的圓角是高度的一半，選中的膠囊和外層同心（外層 − 內距，《03》§2.3.1）')
  r.check(/<BottomNav preview \/>/.test(dev), 'dev/corners.vue 有分頁列的預覽')

  r.section('滿寬按鈕一律膠囊形（2026-11-19）')
  const button = read('components/AppButton.vue')
  r.check(/props\.block && props\.variant !== 'text' \? 'app-button--block' : ''/.test(button), '滿寬而且不是文字按鈕：膠囊形、56px')
  r.check(!/\bshape\?:|props\.shape|'default' \| 'pill'|app-button--pill/.test(button), '原本只給儲存按鈕的 shape="pill" 拿掉了')
  const vueFiles = (dir) => readdirSync(new URL(dir, root)).flatMap((name) => {
    const path = `${dir}/${name}`
    return statSync(new URL(path, root)).isDirectory() ? vueFiles(path) : name.endsWith('.vue') ? [path] : []
  })
  const all = [...vueFiles('components'), ...vueFiles('pages'), ...vueFiles('dev'), 'app.vue', 'error.vue']
  r.check(all.every(f => !/<AppButton[^>]*\bshape=/.test(read(f))), '沒有任何地方還在傳 shape')

  r.section('只有一列的獨立卡片用表單的單列卡片（2026-11-19）')
  const beanDetail = read('pages/beans/[id]/index.vue')
  r.check(/<FormCard pill class="mt-4">\s*<FormRow>\s*<ToggleSwitch[\s\S]*?label="已喝完"\s*row/.test(beanDetail), '豆子詳情的「已喝完」：FormCard pill、開關是一列')
  const appCardUsers = all.filter(f => f !== 'components/AppCard.vue' && /<AppCard\b/.test(read(f)))
  // 2026-11-23：紀錄分頁的紀錄卡片與它的骨架也用 AppCard（ml）
  // 2026-11-26：結算頁改版，本週目標卡片（GoalWeekCard）只剩總覽在用；結算頁的「沖煮參數」卡片用 AppCard（md）
  // 2026-11-27：豆子列表、器材列表的分組卡片用 AppCard（ml）
  r.check(appCardUsers.sort().join(',') === ['components/BrewCard.vue', 'components/FormCard.vue', 'components/GoalWeekCard.vue', 'components/OverviewBeanCard.vue', 'dev/corners.vue', 'pages/beans/index.vue', 'pages/brews/[id]/summary.vue', 'pages/brews/index.vue', 'pages/equipment/index.vue', 'pages/index.vue'].join(','),
    `用 AppCard 的只有表單、總覽、豆子與器材列表、結算頁的沖煮參數、紀錄卡片與調整頁（${appCardUsers.join('、')}）`)
  r.check(/<AppCard\s+as="a"/.test(read('pages/brews/[id]/summary.vue')) && !/<AppCard[^>]*radius=/.test(read('pages/brews/[id]/summary.vue')),
    '結算頁的沖煮參數卡片：預設的 md（24px），不是分頁第一層的 ml')

  r.section('卡片的圓角：分頁第一層 18px（ml），其他 24px（2026-11-23）')
  r.check(/radius\?: 'ml' \| 'md' \| 'lg' \| 'pill' \| 'pill-tall'/.test(card) && /\{ radius: 'md',/.test(card), 'AppCard 的預設是 md：要 ml 就明確傳')
  const goal = read('components/GoalWeekCard.vue')
  // 2026-11-26：結算頁不再用這張卡片，只剩總覽（分頁第一層），radius 這個 prop 刪掉、固定 ml
  r.check(!/radius\?:/.test(goal) && /<AppCard[\s\S]*?radius="ml"/.test(goal), 'GoalWeekCard 固定是 ml（18px），沒有 radius 這個 prop')
  const overview = read('pages/index.vue')
  r.check(!/<GoalWeekCard[^>]*\bradius=/.test(overview), '總覽的本週目標不傳 radius')
  const overviewCards = overview.match(/<AppCard\b[^>]*>/g) || []
  r.check(overviewCards.length === 3 && overviewCards.every(c => /\bradius="ml"/.test(c)), '總覽的說明卡片、累計、本月是 ml')
  r.check(/<AppCard\b[^>]*\bradius="ml"/.test(read('components/OverviewBeanCard.vue')), '最近沖煮、最高分是 ml')
  r.check(/<AppCard\b[^>]*\bradius="ml"/.test(read('components/BrewCard.vue')), '紀錄卡片是 ml')
  const brewsCards = read('pages/brews/index.vue').match(/<AppCard\b[^>]*>/g) || []
  r.check(brewsCards.length === 1 && /\bradius="ml"/.test(brewsCards[0]), '紀錄卡片的骨架是 ml')
  r.check(/\.card-ml-corners \{\s*border-radius: var\(--radius-card-ml\);\s*corner-shape: var\(--corner-card-ml\);/.test(css), '.card-ml-corners')
  r.check(/\.card-corners \{\s*border-radius: var\(--radius-card-md\);\s*corner-shape: var\(--corner-card-md\);/.test(css), '.card-corners')
  r.check(/\.form-card-corners \{\s*border-radius: var\(--radius-card-lg\);\s*corner-shape: var\(--corner-card-lg\);/.test(css), '.form-card-corners')
  for (const [path, re, label] of [
    // 2026-11-27 第二版：豆子列表、器材列表都是分組卡片，分頁第一層的 ml（器材列表第一版誤用表單卡片的 lg）
    ['pages/beans/index.vue', /<AppCard v-if="active\.length" radius="ml" border-inside class="overflow-hidden">/, '豆子列表：還在喝的一張 ml 卡片'],
    ['pages/beans/index.vue', /<FormSection v-if="finished\.length" title="已喝完">\s*<AppCard radius="ml" border-inside class="overflow-hidden">/, '豆子列表：已喝完也是 ml'],
    ['pages/beans/index.vue', /<AppCard\s+v-if="loading" radius="ml" border-inside/, '豆子列表的骨架：ml'],
    ['pages/equipment/index.vue', /<AppCard radius="ml" border-inside class="overflow-hidden">\s*<ul>\s*<!--[\s\S]*?-->\s*<TwoLineRow/, '器材列表：每個類型一張 ml 卡片，不是膠囊形'],
    ['pages/equipment/index.vue', /<AppCard radius="ml" border-inside class="overflow-hidden">\s*<ul>\s*<li v-for="row in 2"/, '器材列表的骨架：ml'],
    ['components/BeanCompareTable.vue', /class="card-corners overflow-hidden border shadow-light"/, '比較表維持 md（24px）'],
  ]) r.check(re.test(read(path)), label)
  const mdUsers = all.filter(f => f !== 'components/AppCard.vue' && /\bcard-corners\b|--radius-card-md/.test(read(f).replace(/card-ml-corners|form-card-corners/g, '')))
  r.check(mdUsers.sort().join(',') === ['components/BeanCompareTable.vue', 'dev/corners.vue'].join(','), `.card-corners（md）只剩比較表（${mdUsers.join('、')}）`)
  for (const path of ['pages/brews/new.vue', 'pages/brews/[id]/edit.vue', 'pages/beans/[id]/edit.vue', 'pages/equipment/[id]/edit.vue'])
    r.check(/class="form-card-corners border p-5"/.test(read(path)), `${path}：表單的骨架和表單的卡片同一個圓角`)

  r.section('正圓不套')
  for (const path of ['components/DoneButton.vue', 'components/GoalStepper.vue', 'components/IntensityPicker.vue', 'pages/index.vue', 'pages/brews/index.vue', 'pages/beans/index.vue', 'pages/equipment/index.vue'])
    r.check(!/corner-|corner-shape/.test(read(path)), `${path}`)

  return r.finish()
}
