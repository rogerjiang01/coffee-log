// 分享的接線（結構檢查，《02》§7.1、§7.2、《03》§4.13）。
//
// 行為層面的測試在 tests/unit/share.test.ts（順序、結果）與 tests/db/shares.test.mjs
// （權限、回傳值）。這裡守的是「那些東西真的接在頁面上」：
//   白名單的每一個 key 都有顯示（沒顯示的就不該回傳）
//   點擊「分享」的 handler 裡沒有 await（iOS Safari）
//   開啟事件只由讀取函式記，頁面不另外寫
//   第一版沒有停止分享

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { createReport } from '../helpers/report.mjs'
import { SHARED_BREW_KEYS } from '../../utils/share.ts'

const root = new URL('../../', import.meta.url)
const read = path => readFileSync(new URL(path, root), 'utf8')
const stripComments = text => text
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|\s)\/\/.*$/gm, '$1')

function sourceFiles(dir) {
  const out = []
  for (const name of readdirSync(new URL(dir, root))) {
    const path = `${dir}/${name}`
    if (statSync(new URL(path, root)).isDirectory()) out.push(...sourceFiles(path))
    else if (/\.(vue|ts)$/.test(name)) out.push(path)
  }
  return out
}

/** 取出 function name(...) { ... } 的本體（用大括號配對，不靠縮排） */
function functionBody(text, name) {
  const start = text.search(new RegExp(`function ${name}\\(`))
  if (start < 0) return ''
  let depth = 0
  for (let i = text.indexOf('{', start); i < text.length; i++) {
    if (text[i] === '{') depth++
    if (text[i] === '}' && --depth === 0) return text.slice(start, i + 1)
  }
  return ''
}

export default function run() {
  const r = createReport('分享的接線')
  const page = stripComments(read('pages/s/[code].vue'))
  const view = stripComments(read('components/SharedBrewView.vue'))
  const gone = stripComments(read('components/SharedBrewGone.vue'))
  const panel = stripComments(read('components/BrewShare.vue'))
  const steps = read('utils/brewSteps.ts')

  r.section('白名單的每一個 key，分享頁（SharedBrewView）都有顯示（《01》§14.2）')
  // 分段的五個 key 經過 toStepInputs 轉成介面用的形狀：確認頁面把 steps 交給它，
  // 而它讀了每一個 key
  r.check(/toStepInputs\(brew\.value\.steps\)/.test(view), '分段交給 toStepInputs（與紀錄詳情頁同一個轉換）')
  const toStepInputs = functionBody(steps, 'toStepInputs')
  for (const key of SHARED_BREW_KEYS) {
    const leaf = key.replace(/\[\]$/, '').split(/\.|\[\]\./).pop()
    const used = key.startsWith('steps[].')
      ? new RegExp(`row\\.${leaf}|a\\.${leaf}`).test(toStepInputs)
      : new RegExp(`\\.${leaf}\\b|\\['${leaf}'`).test(view)
    r.check(used, `${key}`)
  }

  r.section('點擊「分享」：handler 裡沒有 await（iOS Safari，《02》§7.1）')
  const onShare = functionBody(panel, 'onShare')
  r.check(onShare.length > 0, '找得到 onShare')
  r.check(!/\bawait\b/.test(onShare) && !/async function onShare/.test(panel), 'onShare 不是 async，也沒有 await')
  r.check(/startShare\(/.test(onShare) && /deliverShareLink\(/.test(onShare), '交出連結與建立請求都走 startShare（先交出、再建立）')
  r.check(/generateShareCode\(\)/.test(onShare), '代碼在點擊當下由用戶端產生')
  r.check(/shareCode\.value \?\? pendingCode\.value \?\? generateShareCode\(\)/.test(onShare),
    '已經送出去的代碼優先沿用：再按一次、再試一次都不會換代碼')
  const retry = functionBody(panel, 'retry')
  r.check(/createShare\(pendingCode\.value/.test(retry) && !/deliverShareLink|navigator\.share/.test(retry),
    '「再試一次」用同一個代碼重送建立請求，不再叫一次系統選單')

  r.section('對話框沿用刪除確認對話框：標題 → 主體 → 動作（《03》§4.13.2）')
  r.check(/<dialog/.test(panel) && /showModal\(\)/.test(panel), '原生 <dialog> 的 showModal()')
  r.check(/backdrop:bg-\[var\(--overlay-scrim\)\]/.test(panel), '有遮罩')
  r.check(/useOverlayHistory\(/.test(panel), '佔一筆 history，返回鍵關閉')
  r.check(/@click="onDialogClick"/.test(panel) && /event\.target === dialog\.value/.test(panel), '點遮罩關閉')
  r.check(/<h2[^>]*tabindex="-1"[^>]*>\s*分享紀錄\s*<\/h2>/.test(panel), '標題「分享紀錄」，tabindex="-1"')
  r.check(/showModal\(\)\s*\n[\s\S]{0,300}?title\.value\?\.focus\(\)/.test(panel),
    '開啟時焦點放在標題，不自動聚焦到開關或按鈕')
  r.check(/<h2[^>]*class="[^"]*outline-none/.test(panel), '標題不畫焦點框（它不是互動元素）')
  r.check(/\{\{ beanName \}\}/.test(panel) && /\{\{ brewDate \}\}/.test(panel), '主體：豆名與沖煮日期')
  r.check(/pad\(d\.getMonth\(\) \+ 1\)\}\/\$\{pad\(d\.getDate\(\)\)\}/.test(panel)
    && /pad\(d\.getMonth\(\) \+ 1\)\}\/\$\{pad\(d\.getDate\(\)\)\}/.test(read('components/BrewTimelineItem.vue')),
    '日期格式與首頁時間軸相同（MM/DD）')
  r.check(/<ToggleSwitch[\s\S]*?label="包含心得筆記"/.test(panel) && !/type="checkbox"/.test(panel),
    '「包含心得筆記」是開關，不是勾選框')
  r.check(/v-if="hasNotes"/.test(panel), '只在有心得時出現')
  r.check(/修改未成功，請再試一次/.test(panel) && !/分享心得筆記|notesToggleFeedback/.test(panel),
    '切換成功不顯示文字（開關本身就是回饋）；失敗才有紅字')
  r.check(/\{\{ shareCode \? '完成' : '取消' \}\}/.test(panel), '次要按鈕：尚未分享「取消」、已分享過「完成」')
  const actions = panel.match(/<div class="mt-6 flex gap-3">[\s\S]*?<\/dialog>/)?.[0] ?? ''
  r.check(actions.indexOf("'取消'") > -1 && actions.indexOf("'取消'") < actions.indexOf('>\n          分享\n'),
    '兩顆按鈕並排，次要在左、主要在右（與刪除確認對話框一致）')
  r.check(/@click="openDialog"/.test(panel), '按下圖示一律開對話框，不依有無心得筆記直接分享')
  r.check(!/朋友不用登入也能看|只能看、不能改/.test(panel), '沒有說明句')

  r.section('按下「分享」之後（《02》§7.1）')
  r.check(/startShare\([\s\S]*?\}\)\s*\n\s*close\(\)/.test(onShare), '先交出連結，再立刻關閉對話框')
  r.check(/result === 'copied'/.test(onShare) && /COPIED_MS = 2000/.test(panel), '複製：頁面上顯示「已複製連結」，約兩秒後收起')
  r.check(/result === 'failed'\) manualLink\.value = url/.test(onShare) && /無法複製，請長按連結手動複製/.test(panel),
    '系統分享與複製都失敗：顯示連結本身與手動複製的說明')
  const notices = panel.match(/<Teleport :to="portalTarget">[\s\S]*?<\/Teleport>/)?.[0] ?? ''
  r.check(/分享沒有建立成功，剛才那個連結還不能用/.test(notices) && /再試一次/.test(notices),
    '建立失敗的提示在頁面層級，附「再試一次」')
  r.check(!/setTimeout[^\n]*createError/.test(panel), '建立失敗的提示不自動消失')
  r.check(/env\(safe-area-inset-bottom\)/.test(notices) && /52px/.test(notices), '頁面層級的提示避開分頁列與底部安全區域')

  r.section('開啟事件只由讀取函式記')
  const rpcs = [...page.matchAll(/\.rpc\('([a-z_]+)'/g)].map(m => m[1])
  r.check(JSON.stringify(rpcs) === '["get_shared_brew"]', `分享頁只呼叫 get_shared_brew 一次（${rpcs.join('、')}）`)
  r.check(!/brew_share_events/.test(page) && !/brew_share_events/.test(panel), '前端不直接碰 brew_share_events')

  r.section('第一版沒有停止分享')
  const ui = [...sourceFiles('components'), ...sourceFiles('pages'), ...sourceFiles('utils'), ...sourceFiles('composables')]
  const stop = ui.filter(path => /停止分享|revoke_brew_share|revoked_at\s*:/.test(stripComments(read(path))))
  r.check(stop.length === 0, `介面上不出現停止分享，也沒有寫 revoked_at${stop.length ? `：${stop.join('、')}` : ''}`)
  r.check(!/revoke_brew_share/.test(read('supabase/migrations/20260923110000_brew_shares.sql').replace(/--.*$/gm, '')),
    'migration 沒有停止分享的函式')

  r.section('分享頁的文案與導覽（《03》§4.13.4、§4.13.5）')
  r.check(/>你分享的紀錄</.test(view) && />\s*前往紀錄\s*</.test(view), '本人橫幅：「你分享的紀錄」＋「前往紀錄」')
  r.check(!/這是你分享的紀錄/.test(view), '不是舊文案「這是你分享的紀錄」')
  const banner = view.match(/v-if="brew\.is_owner[\s\S]*?<\/div>/)?.[0] ?? ''
  r.check(/text-sm/.test(banner) && !/text-(base|lg|xl)/.test(banner), '本人橫幅用最小一級字（14px）')
  r.check(/>這筆分享已經無法查看</.test(gone) && /<SharedBrewGone v-if="gone" :signed-in="userId !== null"/.test(page), '失效畫面的文案')
  r.check(/v-if="signedIn"[\s\S]{0,200}回首頁/.test(gone), '失效畫面：登入時才有「回首頁」')
  r.check(!/<PageHeader|<BackButton/.test(page + view), '沒有 ‹')
  r.check(!/\.rpc\(|useSupabaseClient/.test(view + gone), '內容與失效畫面不碰資料庫，讀取只在頁面做一次')
  r.check(!/NuxtLink[^>]*>\s*手沖咖啡紀錄/.test(page) && /手沖咖啡紀錄/.test(page), '頂部的產品名不是連結')
  r.check(/definePageMeta\(\{ screen: 'share' \}\)/.test(read('pages/s/[code].vue')), '宣告成分享頁（分頁列看登入狀態）')
  r.check(/exclude: \[[^\]]*'\/s\/\*'/.test(read('nuxt.config.ts')), '未登入的人不會被導去登入頁（redirectOptions.exclude）')

  r.section('紀錄詳情頁的入口')
  const detail = read('pages/brews/[id]/index.vue')
  const titleRow = detail.match(/<div class="mt-4 flex items-baseline gap-2">[\s\S]*?<\/div>/)?.[0] ?? ''
  r.check(/<BrewShare\b/.test(titleRow), '分享圖示在標題列（豆名那一行）')
  r.check(titleRow.indexOf('<BrewShare') > titleRow.indexOf('<SampleBadge'), '在最右端')
  r.check(/aria-label="分享"[\s\S]*?self-center|self-center[\s\S]*?aria-label="分享"/.test(panel.split('<dialog')[0]),
    '圖示自己垂直置中，不跟著標題對齊基線')
  r.check(/ml-auto/.test(panel.split('<dialog')[0]) && /shrink-0/.test(panel.split('<dialog')[0]), '靠右、不讓位給長豆名')

  return r.finish()
}
