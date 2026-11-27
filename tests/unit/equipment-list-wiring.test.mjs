// 器材列表與設定頁改版（2026-11-27，Figma 3670:1760、3670:1787）的接線。結構檢查；規則本身（還沒用過、無障礙名稱）在下面直接呼叫。

import { readFileSync } from 'node:fs'
import { createReport } from '../helpers/report.mjs'
import { equipmentUsage, equipmentRowLabel } from '../../utils/equipment.ts'

const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')
const stripComments = text => text.replace(/<!--[\s\S]*?-->/g, '')

export default function run() {
  const r = createReport('器材列表與設定頁的接線')

  r.section('器材列表：段落標題＋每個類型一張表單卡片，每台一列')
  const page = read('pages/equipment/index.vue')
  const tpl = stripComments(page.slice(page.indexOf('<template>')))
  r.check(/<FormSection v-for="group in grouped" :key="group\.type" :title="equipmentLabels\[group\.type\]">\s*<FormCard>/.test(tpl),
    '分組標題是段落標題（FormSection），底下一張一般圓角的表單卡片（不傳 pill）')
  r.check(/marginTop: 'var\(--gap-section\)', gap: 'var\(--gap-section\)'/.test(tpl), '段落之間與頁首到第一段：--gap-section（和詳情頁相同）')
  r.check(!/card-ml-corners|shadow-light/.test(tpl), '不再一台一張卡片')

  r.section('整列可點，進編輯頁；沒有「編輯」文字連結')
  r.check(/<TwoLineRow v-for="row in group\.rows" :key="row\.id" :to="`\/equipment\/\$\{row\.id\}\/edit`" :aria-label="rowLabel\(row\)">/.test(tpl),
    '每一列是通往 /equipment/:id/edit 的連結，無障礙名稱由 equipmentRowLabel 組')
  r.check(!/>\s*編輯\s*</.test(tpl), '畫面上沒有「編輯」兩個字')
  const row = read('components/TwoLineRow.vue')
  r.check(/<li class="two-line-row">/.test(row) && /<component :is="to \? NuxtLink : 'div'" :to="to" class="two-line-row__body card-pad-x" v-bind="\$attrs">/.test(row)
    && /defineOptions\(\{ inheritAttrs: false \}\)/.test(row),
    'TwoLineRow：<li> 裡整列是連結，aria-label 落在連結上')
  r.check(/padding-block: var\(--sheet-pad-two-line\);/.test(row) && /--sheet-pad-two-line: 14px;/.test(read('assets/css/tokens.css')),
    '上下內距 --sheet-pad-two-line（14px，照 Figma）')
  r.check(/\.two-line-row:not\(:last-child\) \{\s*box-shadow: inset 0 -1px 0 var\(--border\);/.test(row), '列之間一條分隔線，最後一列不畫')
  r.check(/color: 'var\(--icon-muted\)'/.test(row) && /d="m9 18 6-6-6-6"/.test(row), '右側 ›（--icon-muted）')
  r.check(/color: var\(--text-muted\);/.test(row) && /gap: 1rem;/.test(row) && !/·/.test(tpl), '第二行 --text-muted，項目之間 16px、不用中間點')
  r.check(/<span class="min-w-0 truncate">\{\{ equipmentOptionName\(row\) \}\}<\/span>/.test(tpl) && /<span v-if="row\.note\?\.trim\(\)" class="min-w-0 truncate">/.test(tpl),
    '名稱、備註太長時截斷成一行')
  r.check(!/minHeight: 'calc\(var\(--text-sm\)/.test(page), '第二行的最小高度拿掉了')

  r.section('第二行的「上次使用」')
  r.check(/equipmentUsage\(lastUsed\.value\.get\(row\.id\), usageKnown\.value\)/.test(page) && /usageKnown\.value = true;/.test(page),
    '頁面用 equipmentUsage；「上次使用」的資料到了才算知道')
  const now = new Date(2026, 10, 27, 12)
  r.check(equipmentUsage(undefined, true, now) === '還沒用過', '沒有任何紀錄用過它：還沒用過')
  r.check(equipmentUsage(undefined, false, now) === null, '查詢還沒回來或失敗：不寫（不能說成還沒用過）')
  r.check(equipmentUsage('2026-11-27T01:00:00', true, now) === '今天用過', '有紀錄：照 relativeUsed')
  r.check(equipmentUsage('not-a-date', true, now) === null, '日期無效：不顯示，不改寫成還沒用過')
  r.check(equipmentUsage('2026-12-25T01:00:00', true, now) === null, '日期在未來：不顯示')

  r.section('整列的無障礙名稱')
  r.check(equipmentRowLabel({ name: 'Comandante · C40', isDefault: true, isSample: false, note: '家裡用', usage: '今天用過' }) === '編輯 Comandante · C40，常用，家裡用，今天用過',
    '「編輯」開頭，接名稱、常用、備註、上次使用')
  r.check(equipmentRowLabel({ name: 'Hario · V60 02', isDefault: false, isSample: true, note: '  ', usage: null }) === '編輯 Hario · V60 02，範例',
    '沒有的項目不寫（空白的備註也不寫）')

  r.section('讀取中：段落標題＋卡片裡的兩行列')
  r.check(/<div v-if="loading" aria-busy="true" aria-label="讀取中"/.test(tpl) && /<section v-for="n in 2"[\s\S]*?<FormCard>\s*<ul>\s*<li v-for="row in 2"[\s\S]*?paddingBlock: 'var\(--sheet-pad-two-line\)'/.test(tpl),
    '骨架和內容同一個版面')

  r.section('新增鈕的陰影：--float-shadow（全站）')
  for (const path of ['pages/index.vue', 'pages/brews/index.vue', 'pages/beans/index.vue', 'pages/equipment/index.vue']) {
    const t = read(path)
    r.check(/fab-position[^>]*boxShadow: 'var\(--float-shadow\)'/.test(t) && !/fab-position[^>]*overlay-shadow/.test(t), `${path}`)
  }

  r.section('設定頁')
  const settings = stripComments(read('pages/settings.vue'))
  r.check(/<PageHeader title="設定" :back="SETTINGS_BACK_FALLBACK" \/>/.test(settings), '頁首：圓形的返回＋「設定」')
  r.check(/<FormSection title="帳號">\s*<FormCard pill>\s*<dl>\s*<ReadonlyRow label="電子郵件">\s*<span class="min-w-0 wrap-anywhere">\{\{ email \}\}<\/span>/.test(settings),
    '「帳號」段落：一列的唯讀卡片，電子郵件可以在任意字元斷行（不截斷）')
  r.check(/<AppButton variant="outline" block\s+:busy="signingOut"/.test(settings) && /signingOut \? '登出中' : '登出'/.test(settings), '登出：滿寬的外框按鈕，登出中照舊')
  r.check(/marginTop: 'var\(--gap-section\)', gap: 'var\(--gap-section\)'/.test(settings), '頁首、段落、按鈕之間 --gap-section')

  return r.finish()
}
