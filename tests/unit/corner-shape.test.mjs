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
    ['--corner-card-pill', 'superellipse(1.2)'], ['--corner-block-button', 'superellipse(1.2)'], ['--corner-sheet-pill', 'superellipse(1.1)'],
    ['--corner-chip', 'superellipse(1.1)'], ['--corner-toggle', 'superellipse(1.1)'], ['--corner-bar', 'superellipse(1.1)'],
    ['--corner-card-md', 'superellipse(1.1)'], ['--corner-card-lg', 'superellipse(1.1)'],
  ]
  for (const [token, value] of values) r.check(tokens.includes(`${token}: ${value};`), `${token}: ${value}`)
  for (const [token, value] of [['--radius-card-md', '24px'], ['--radius-card-lg', 'var(--radius-lg)'], ['--radius-card-pill', 'var(--radius-pill)'], ['--radius-block-button', 'var(--radius-pill)']])
    r.check(tokens.includes(`${token}: ${value};`), `${token}: ${value}`)
  r.check(tokens.includes('--radius-md: 12px;'), '--radius-md 本身維持 12px：只有總覽的卡片（AppCard 的 md）改成 24px')
  r.check(/radius="var\(--radius-card-md\)"/.test(read('pages/index.vue')) && !/radius="var\(--radius-md\)"/.test(read('pages/index.vue')),
    '總覽載入中的骨架和卡片同一個半徑')

  r.section('調整頁的預設值和 tokens.css 一致')
  const dev = read('dev/corners.vue')
  for (const [token, value] of values) {
    const k = Number(value.match(/superellipse\(([\d.]+)\)/)[1])
    r.check(new RegExp(`token: '${token}', shape: ${k}, defaultShape: ${k}`).test(dev), `dev/corners.vue：${token} 從 ${k} 開始`)
  }
  r.check(/token: '--radius-card-md', value: 24, default: 24/.test(dev), 'dev/corners.vue：總覽卡片的半徑從 24px 開始')

  r.check(!/--pill-corner-shape/.test(tokens), '共用的 --pill-corner-shape 已經拆掉')

  r.section('元件吃自己的 token')
  const css = read('assets/css/main.css')
  const card = read('components/AppCard.vue')
  for (const kind of ['md', 'lg', 'pill'])
    r.check(new RegExp(`\\.app-card--${kind} \\{\\s*border-radius: var\\(--radius-card-${kind}\\);\\s*corner-shape: var\\(--corner-card-${kind}\\);`).test(card), `AppCard 的 ${kind}`)
  r.check(/\.app-button--block \{[^}]*min-height: var\(--sheet-row-h\);[^}]*border-radius: var\(--radius-block-button\);[^}]*corner-shape: var\(--corner-block-button\);/.test(read('components/AppButton.vue')), '滿寬按鈕：65px、圓角是高度的一半、轉角')
  r.check(/\.sheet-pill \{[^}]*corner-shape: var\(--corner-sheet-pill\);/.test(css), '下拉與日期的膠囊、分秒框（.sheet-pill）')
  r.check(/\.choice-chip \{[^}]*corner-shape: var\(--corner-chip\);/.test(read('components/ChoiceChip.vue')), '風味標籤')
  r.check(/\.corner-toggle \{\s*corner-shape: var\(--corner-toggle\);/.test(css) && (read('components/ToggleSwitch.vue').match(/class="corner-toggle /g) || []).length === 2, '開關的軌道與圓鈕')
  r.check(/\.corner-bar \{\s*corner-shape: var\(--corner-bar\);/.test(css) && (read('components/GoalWeekCard.vue').match(/class="corner-bar /g) || []).length === 2, '每日長條的底軌與長條')

  r.section('滿寬按鈕一律膠囊形（2026-11-19）')
  const button = read('components/AppButton.vue')
  r.check(/props\.block && props\.variant !== 'text' \? 'app-button--block' : ''/.test(button), '滿寬而且不是文字按鈕：膠囊形、65px')
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
  r.check(appCardUsers.sort().join(',') === ['components/FormCard.vue', 'components/GoalWeekCard.vue', 'components/OverviewBeanCard.vue', 'dev/corners.vue', 'pages/index.vue'].join(','),
    `AppCard 的 md 只剩總覽與結算頁（${appCardUsers.join('、')}）`)

  r.section('卡片的圓角統一成 24px（2026-11-19）')
  r.check(/\.card-corners \{\s*border-radius: var\(--radius-card-md\);\s*corner-shape: var\(--corner-card-md\);/.test(css), '.card-corners')
  r.check(/\.form-card-corners \{\s*border-radius: var\(--radius-card-lg\);\s*corner-shape: var\(--corner-card-lg\);/.test(css), '.form-card-corners')
  for (const [path, re, label] of [
    ['components/BeanCard.vue', /class="card-corners flex overflow-hidden border"/, '豆子列表的卡片'],
    ['components/BeanCompareTable.vue', /class="card-corners overflow-hidden border shadow-light"/, '比較表'],
    ['pages/equipment/index.vue', /class="card-corners border p-4 shadow-light"/, '器材列表的每一台'],
    ['pages/beans/index.vue', /<SkeletonBlock height="5\.5rem" radius="var\(--radius-card-md\)" class="card-corners" \/>/, '豆子列表的骨架'],
    ['pages/equipment/index.vue', /height="3\.5rem" radius="var\(--radius-card-md\)" class="card-corners"/, '器材列表的骨架'],
  ]) r.check(re.test(read(path)), label)
  for (const path of ['pages/brews/new.vue', 'pages/brews/[id]/edit.vue', 'pages/beans/[id]/edit.vue', 'pages/equipment/[id]/edit.vue'])
    r.check(/class="form-card-corners border p-5"/.test(read(path)), `${path}：表單的骨架和表單的卡片同一個圓角`)

  r.section('正圓不套')
  for (const path of ['components/DoneButton.vue', 'components/GoalStepper.vue', 'components/IntensityPicker.vue', 'pages/index.vue', 'pages/brews/index.vue', 'pages/beans/index.vue', 'pages/equipment/index.vue'])
    r.check(!/corner-|corner-shape/.test(read(path)), `${path}`)

  return r.finish()
}
