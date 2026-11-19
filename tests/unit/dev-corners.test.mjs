// 開發用的調整頁 /dev/corners（2026-11-19）：只在 nuxt dev 存在，正式 build 沒有這個路由。
//
// 兩層檢查：
//   1. 結構：頁面不在 pages/（放在那裡 build 一定會掃進去），路由由 nuxt.config.ts 的模組在 nuxt.options.dev 時才加
//   2. build 的產物：有 .output/ 的話，伺服器與用戶端的程式裡都不能出現這一頁。
//      沒有 .output/（還沒 build 過）時這一段略過——pnpm build 之後再跑一次 pnpm test 才算確認

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { createReport } from '../helpers/report.mjs'

const root = new URL('../../', import.meta.url)
const read = path => readFileSync(new URL(path, root), 'utf8')

function files(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const path = new URL(name, dir.href.endsWith('/') ? dir : new URL(`${dir.href}/`))
    if (statSync(path).isDirectory()) out.push(...files(new URL(`${path.href}/`)))
    else if (/\.(m?js|json|html)$/.test(name)) out.push(path)
  }
  return out
}

export default function run() {
  const r = createReport('開發用的調整頁')

  r.section('結構：只在 nuxt dev 加進路由')
  const config = read('nuxt.config.ts')
  r.check(existsSync(new URL('dev/corners.vue', root)) && !existsSync(new URL('pages/dev', root)), '頁面在 dev/corners.vue，不在 pages/')
  r.check(/\(_options, nuxt\) => \{\s*if \(!nuxt\.options\.dev\) return\s*nuxt\.hook\('pages:extend'/.test(config), '模組：不是 nuxt dev 就直接返回，不碰路由')
  r.check(/path: '\/dev\/corners', file: `\$\{nuxt\.options\.rootDir\}\/dev\/corners\.vue`/.test(config), '路由 /dev/corners 指到 dev/corners.vue')
  r.check(/\$development: \{[\s\S]*?redirectOptions: \{ login: '\/login', callback: '\/confirm', exclude: \['\/dev\/\*'\] \}/.test(config), '不需要登入：只在開發環境放行 /dev/*')
  r.check(!/exclude: \['\/signup', '\/s\/\*', '\/dev/.test(config), '正式環境的 exclude 沒有 /dev/*')

  r.section('不讀資料庫')
  const page = read('dev/corners.vue')
  r.check(!/useSupabaseClient|\.from\(|useBrewStats|useActiveBeans|\$fetch|useFetch/.test(page), '頁面裡沒有任何查詢')

  r.section('build 的產物裡沒有這一頁')
  const output = new URL('.output/', root)
  if (!existsSync(output)) {
    r.check(true, '還沒有 .output/（沒有 build 過），略過；pnpm build 之後再跑一次')
  }
  else {
    const hits = files(output).filter(f => /\/dev\/corners|dev-corners|轉角形狀的調整/.test(readFileSync(f, 'utf8')))
    r.check(hits.length === 0, `.output/ 裡沒有 /dev/corners${hits.length ? `（出現在 ${hits.map(f => f.pathname.split('.output/')[1]).join('、')}）` : ''}`)
  }

  return r.finish()
}
