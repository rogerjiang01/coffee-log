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

  r.section('面板沿用既有的浮層')
  r.check(/<dialog/.test(panel) && /showModal\(\)/.test(panel), '原生 <dialog> 的 showModal()')
  r.check(/backdrop:bg-\[var\(--overlay-scrim\)\]/.test(panel), '有遮罩')
  r.check(/useOverlayHistory\(/.test(panel), '佔一筆 history，返回鍵關閉')
  r.check(/@click="onDialogClick"/.test(panel) && /event\.target === dialog\.value/.test(panel), '點遮罩關閉')
  r.check(/v-if="hasNotes"/.test(panel), '「包含心得筆記」只在有心得時出現')
  r.check(/朋友不用登入也能看，只能看、不能改/.test(panel), '一行說明')
  r.check(/@click="openPanel"/.test(panel) && !/v-if="[^"]*hasNotes[^"]*"[^>]*@click="onShare"/.test(panel),
    '按下圖示一律開面板，不依有無心得筆記直接分享')

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
  r.check(/<BrewShare /.test(titleRow), '分享圖示在標題列（豆名那一行）')
  r.check(titleRow.indexOf('<BrewShare') > titleRow.indexOf('<SampleBadge'), '在最右端')
  r.check(/aria-label="分享"[\s\S]*?self-center|self-center[\s\S]*?aria-label="分享"/.test(panel.split('<dialog')[0]),
    '圖示自己垂直置中，不跟著標題對齊基線')
  r.check(/ml-auto/.test(panel.split('<dialog')[0]) && /shrink-0/.test(panel.split('<dialog')[0]), '靠右、不讓位給長豆名')

  return r.finish()
}
