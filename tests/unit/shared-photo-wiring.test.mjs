// 分享頁豆袋照片的接線（結構檢查，《01》§14.5、《03》§4.13.4）。
//
// 行為在 tests/unit/shared-photo.test.ts（簽章與轉送）與 tests/db/shared-photo.test.mjs
// （代碼換路徑、權限）。這裡守的是：
//   service role 只出現在 server/ 底下，用戶端的程式碼一行都碰不到它
//   用戶端不自己去 Storage 要分享頁的照片
//   版面：標題全寬、照片在日期與星等的右邊、沒有照片時不留空框
//   放大檢視：按鈕名稱、替代文字、Esc 與返回鍵
//
// 建置後的產物另外手動檢查（見本輪回報）：這裡看的是原始碼。

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { createReport } from '../helpers/report.mjs'

const root = new URL('../../', import.meta.url)
const read = path => readFileSync(new URL(path, root), 'utf8')
const stripComments = text => text
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|\s)\/\/.*$/gm, '$1')

function sourceFiles(dir) {
  if (!existsSync(new URL(dir, root))) return []
  const out = []
  for (const name of readdirSync(new URL(dir, root))) {
    const path = `${dir}/${name}`
    if (statSync(new URL(path, root)).isDirectory()) out.push(...sourceFiles(path))
    else if (/\.(vue|ts|mjs|js)$/.test(name)) out.push(path)
  }
  return out
}

const SERVICE_ROLE = /serverSupabaseServiceRole|secretKey|serviceKey|SECRET_KEY|SERVICE_KEY|SERVICE_ROLE|service_role/

export default function run() {
  const r = createReport('分享頁豆袋照片的接線')

  r.section('service role 只在伺服器端')
  const clientFiles = ['components', 'pages', 'composables', 'utils', 'plugins', 'layouts', 'middleware']
    .flatMap(sourceFiles).concat(['app.vue', 'error.vue'])
  const leaks = clientFiles.filter(path => SERVICE_ROLE.test(stripComments(read(path))))
  r.check(leaks.length === 0, leaks.length ? `用戶端程式碼提到 service role：${leaks.join('、')}` : `用戶端 ${clientFiles.length} 個檔案都沒有提到`)
  const config = stripComments(read('nuxt.config.ts'))
  r.check(!SERVICE_ROLE.test(config), 'nuxt.config.ts 沒有把金鑰寫進任何設定（public 的也不會有）')
  const serverUses = sourceFiles('server').filter(path => /serverSupabaseServiceRole/.test(stripComments(read(path))))
  r.check(JSON.stringify(serverUses) === '["server/utils/sharedPhotoStore.ts"]',
    `伺服器端只有一個地方建 service role 的 client（${serverUses.join('、')}）`)

  r.section('用戶端不自己去 Storage 要分享頁的照片')
  const page = stripComments(read('pages/s/[code].vue'))
  const view = stripComments(read('components/SharedBrewView.vue'))
  r.check(!/storage|useBeanPhotos|signedUrl|createSignedUrl/.test(page + view), '分享頁與 SharedBrewView 不碰 Storage')
  r.check(/sharedPhotoEndpoint\(code\.value\)/.test(page), '照片網址向伺服器要（sharedPhotoEndpoint）')
  const load = page.slice(page.indexOf('async function load()'))
  r.check(!/Promise\.all/.test(load) && !/await loadPhoto/.test(page) && /void loadPhoto\(\)/.test(load),
    '頁面不等照片：拿到紀錄就顯示，照片網址另外非同步要')
  r.check(/if \(brew\.value\.bean\.has_photo\) void loadPhoto\(\)/.test(load), '只有 has_photo 時才要照片網址')
  r.check((page.match(/get_shared_brew/g) ?? []).length === 1, 'get_shared_brew 仍然只呼叫一次（開啟事件只記一列）')

  r.section('版面：標題全寬，照片在日期與星等的右邊')
  const template = view.slice(view.indexOf('<template>'))
  const h1 = template.indexOf('<h1')
  const row = template.indexOf('<div class="mt-1 flex items-center gap-4">')
  const photo = template.indexOf('<PhotoZoom')
  r.check(h1 >= 0 && row > h1 && photo > row, '順序：標題 → 左右兩欄（日期與星等、照片）')
  r.check(!template.slice(h1, row).includes('PhotoZoom') && !/<div[^>]*flex[^>]*>\s*<h1/.test(template),
    '標題不在任何與照片並排的容器裡')
  r.check(/<PhotoZoom\s+v-if="brew\.bean\.has_photo && !photoFailed"[\s\S]*?:alt="brew\.bean\.name"/.test(template),
    '依 has_photo 先留好縮圖的位置；沒有照片時整個不放；放大後的替代文字是豆名')
  r.check(template.indexOf('formatDate(brew.brewed_at)') > row && template.indexOf('formatDate(brew.brewed_at)') < photo
    && template.indexOf('brew.rating !== null') > row && template.indexOf('brew.rating !== null') < photo,
  '日期與星等在左欄')

  r.section('放大檢視')
  const zoom = read('components/PhotoZoom.vue')
  const zoomTemplate = stripComments(zoom.slice(zoom.indexOf('<template>')))
  r.check(/<button[^>]*aria-label="放大豆袋照片"/.test(zoomTemplate), '縮圖是按鈕，名稱「放大豆袋照片」')
  r.check(/<button[\s\S]*?size-16[\s\S]*?rounded-md[\s\S]*?<\/button>/.test(zoomTemplate), '縮圖 64×64、--radius-md')
  r.check(/<button[\s\S]*?<img[^>]*alt=""[\s\S]*?<\/button>/.test(zoomTemplate), '縮圖本身替代文字留空，不重複唸')
  r.check(/<dialog[^>]*aria-label="豆袋照片"/.test(zoomTemplate), '全螢幕檢視的名稱「豆袋照片」')
  r.check(/<dialog[\s\S]*?<img[^>]*:alt="alt"[^>]*object-contain[\s\S]*?<\/dialog>/.test(zoomTemplate), '完整顯示、不裁切（object-contain）')
  r.check(/<dialog[^>]*@cancel\.prevent="close"/.test(zoomTemplate), 'Esc 關閉')
  r.check(/<dialog[^>]*@click="close"/.test(zoomTemplate), '點任何地方關閉')
  r.check(/useOverlayHistory\(\(\) => open\.value, close\)/.test(zoom), '佔一筆 history，返回鍵關閉')
  r.check(/backdrop:bg-\[var\(--media-scrim\)\]/.test(zoomTemplate) && !/overlay-scrim/.test(zoomTemplate),
    '背景是看照片專用的 --media-scrim，不是對話框共用的 --overlay-scrim')
  const tokens = read('assets/css/tokens.css')
  r.check(/--media-scrim:\s*rgb\(0 0 0 \/ 0\.8\)/.test(tokens), '--media-scrim 是黑色 80%')
  r.check(/--overlay-scrim:\s*rgb\(0 0 0 \/ 0\.4\)/.test(tokens), '--overlay-scrim 沒有被改動（40%）')
  r.check(!/\bp-0\b/.test(zoomTemplate) && /max\(1\.25rem, env\(safe-area-inset-top\)\)/.test(zoom)
    && /max\(1\.25rem, env\(safe-area-inset-bottom\)\)/.test(zoom),
  '照片不貼邊：四周 20px（與頁面邊距相同），並避開安全區域')

  r.section('縮圖與原圖分開')
  r.check(/<button[\s\S]*?<img[\s\S]*?:src="thumb"[\s\S]*?<\/button>/.test(zoomTemplate), '縮圖按鈕只載縮圖')
  r.check(/:disabled="!thumbReady"/.test(zoomTemplate), '縮圖還沒載好時按鈕不能按')
  r.check(/watch\(\[thumbReady, \(\) => props\.full\]/.test(zoom) && /new Image\(\)/.test(zoom), '縮圖載好之後才在背景預先載入原圖')
  r.check(/fullReady\.value && props\.full \? props\.full : props\.thumb/.test(zoom), '點開時原圖還沒到：先顯示放大的縮圖，到了再換上')

  r.section('紀錄詳情頁：同一個元件，走登入者自己的簽名網址')
  const detail = stripComments(read('pages/brews/[id]/index.vue'))
  const detailTemplate = detail.slice(detail.indexOf('<template>'))
  r.check(/<PhotoZoom\s+v-if="brew\.beans\?\.photo_path && !photoFailed"/.test(detailTemplate), '有照片才放；位置一開始就留好')
  r.check(/photoUrls\(path\)/.test(detail) && !/shared-photo|sharedPhotoEndpoint/.test(detail), '用 useBeanPhotos 的 photoUrls，不經過分享的轉送')
  const dRow = detailTemplate.indexOf('<div class="mt-1 flex items-center gap-4">')
  r.check(detailTemplate.indexOf('<h1') < dRow && dRow < detailTemplate.indexOf('<PhotoZoom')
    && detailTemplate.indexOf('formatDate(brew.brewed_at)') > dRow, '版面同分享頁：標題列在上，日期與星等在左、照片在右')

  return r.finish()
}
