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

  r.section('按下按鈕：系統分享與複製都在點擊事件中同步呼叫（iOS Safari，《02》§7.1）')
  const send = functionBody(panel, 'send')
  r.check(send.length > 0, '找得到 send（「分享」與「複製連結」共用）')
  r.check(!/\bawait\b/.test(send) && !/async function send/.test(panel), 'send 不是 async，也沒有 await')
  r.check(/@click="onShare"/.test(panel) && /function onShare\(\) \{\s*send\('share'\)/.test(panel), '「分享」直接呼叫 send')
  r.check(/@click="onCopy"/.test(panel) && /function onCopy\(\) \{\s*send\('copy'\)/.test(panel), '「複製連結」直接呼叫 send')
  r.check(/startShare\(/.test(send) && /deliverShareLink\(/.test(send) && /afterDeliver: close/.test(send),
    '走 startShare：交出連結 → 關閉對話框 → 建立請求')
  r.check(/const code = generateShareCode\(\)/.test(send), '每次都當場產生新代碼（傳送模型，不重複使用）')
  r.check(/via === 'share' && typeof navigator\.share === 'function'/.test(send), '「複製連結」不叫系統分享，直接複製')
  r.check(!/brew_shares|loadShare|shareCode/.test(panel), '不查、不記任何既有的分享')
  const retry = functionBody(panel, 'retry')
  r.check(/createShare\(failed\.code, failed\.notes\)/.test(retry) && !/deliverShareLink|navigator\.share/.test(retry),
    '「再試一次」用同一個代碼與設定重送，不再叫一次系統選單')

  r.section('對話框：標題 → 分享的對象 → 選項 → 動作（《03》§4.13.2）')
  r.check(/<dialog/.test(panel) && /showModal\(\)/.test(panel), '原生 <dialog> 的 showModal()')
  r.check(/backdrop:bg-\[var\(--overlay-scrim\)\]/.test(panel), '有遮罩')
  r.check(/useOverlayHistory\(/.test(panel), '佔一筆 history，返回鍵關閉')
  r.check(/@click="onDialogClick"/.test(panel) && /event\.target === dialog\.value/.test(panel), '點遮罩關閉')
  r.check(/<h2[^>]*tabindex="-1"[^>]*>\s*分享紀錄\s*<\/h2>/.test(panel), '標題「分享紀錄」，tabindex="-1"')
  r.check(/showModal\(\)\s*\n[\s\S]{0,300}?title\.value\?\.focus\(\)/.test(panel), '開啟時焦點放在標題')
  r.check(/<p class="break-words text-pretty">\{\{ beanName \}\}<\/p>/.test(panel) && /沖煮日期：\{\{ brewDate \}\}/.test(panel),
    '分享的對象：豆名（16px、400）與「沖煮日期：MM/DD」')
  r.check(/pad\(d\.getMonth\(\) \+ 1\)\}\/\$\{pad\(d\.getDate\(\)\)\}/.test(panel), '日期格式與時間軸相同')
  r.check(/<img\s+v-if="photoUrl"/.test(panel) && !/v-else[^>]*size-24/.test(panel), '沒有照片時不放縮圖、不留空框')
  r.check(/class="size-24 shrink-0[^"]*object-cover"/.test(panel), '縮圖 96×96（同豆子列表的規格）')
  r.check(/signedUrl\(props\.photoPath\)/.test(panel), '照片網址走 useBeanPhotos 的快取')
  r.check(/<fieldset v-if="hasNotes"/.test(panel) && /<legend class="text-sm text-muted">選項<\/legend>/.test(panel),
    '沒有心得時「選項」整組不出現；小標是分組標題樣式')
  r.check(/type="checkbox"/.test(panel) && /分享心得筆記/.test(panel) && !/<ToggleSwitch/.test(panel),
    '「分享心得筆記」是勾選框，不是開關')
  r.check(/function openDialog\(\) \{\s*includeNotes\.value = false/.test(panel), '每次打開都預設不勾，不記住上次的選擇')
  r.check(!/localStorage|sessionStorage/.test(panel), '不把勾選狀態存起來')
  r.check(/'var\(--control-empty\)'/.test(panel) && /'var\(--accent\)'/.test(panel), '未勾 --control-empty、勾選 --accent')
  r.check(/<label class="[^"]*flex[^"]*"[^>]*minHeight: 'var\(--touch-min\)'/.test(panel), '整列是 label：點文字也能切換，44px 高')
  r.check(/canShare\.value = typeof navigator\.share === 'function'/.test(panel) && !/userAgent|matchMedia/.test(panel),
    '按鈕依瀏覽器能力決定，不依桌機或手機')
  const actions = panel.match(/<div class="mt-6 flex gap-3">[\s\S]*?<\/dialog>/)?.[0] ?? ''
  const both = actions.match(/<template v-if="canShare">[\s\S]*?<\/template>/)?.[0] ?? ''
  r.check(both.indexOf('複製連結') > -1 && both.indexOf('複製連結') < both.indexOf('分享\n'),
    '支援系統分享：「複製連結」次要在左、「分享」主要在右')
  const only = actions.slice(actions.indexOf('v-else'))
  r.check(/background: 'var\(--accent\)'/.test(only) && /複製連結/.test(only) && !/>\s*分享\s*</.test(only),
    '不支援系統分享：只有「複製連結」一顆，而且是主要按鈕')
  r.check(!/取消|完成|已分享過/.test(actions), '沒有「取消」「完成」，也沒有「已分享過」的狀態')
  r.check(!/朋友不用登入也能看|只能看、不能改/.test(panel), '沒有說明句')

  r.section('按下按鈕之後（《02》§7.1）')
  r.check(/result === 'copied'/.test(send) && /COPIED_MS = 2000/.test(panel), '複製：頁面上顯示「已複製連結」，約兩秒後收起')
  r.check(/result === 'failed'\) manualLink\.value = url/.test(send) && /無法複製，請長按連結手動複製/.test(panel),
    '系統分享與複製都失敗：顯示連結本身與手動複製的說明')
  const notices = panel.match(/<Teleport :to="portalTarget">[\s\S]*?<\/Teleport>/)?.[0] ?? ''
  r.check(/分享建立失敗，連結目前無法開啟/.test(notices) && /再試一次/.test(notices) && /關閉/.test(notices),
    '建立失敗的提示在頁面層級，附「再試一次」與「關閉」')
  r.check(!/setTimeout[^\n]*failedSend/.test(panel), '建立失敗的提示不自動消失')
  r.check(/env\(safe-area-inset-bottom\)/.test(notices) && /52px/.test(notices), '頁面層級的提示避開分頁列與底部安全區域')
  r.check(!/mismatch/.test(panel), '沒有「別的裝置先分享過」的處理（傳送模型不會發生）')

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
