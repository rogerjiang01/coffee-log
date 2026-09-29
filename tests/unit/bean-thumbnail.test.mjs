// 豆袋照片的縮圖檔（utils/beanPhoto.ts、《01》§7）。
//
// 縮圖路徑由原圖路徑推導，不另開欄位。這裡守的是：
//   路徑規則（上傳、刪除、顯示、伺服器轉送、補產生，五個地方用同一個函式）
//   上傳時一起產生、刪除時一起刪，不留孤兒檔
//   縮圖大小的地方都用縮圖，縮圖檔還不存在時退回原圖
//   補產生的腳本：規劃正確、不覆蓋、secret key 不落地

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { createReport } from '../helpers/report.mjs'
import { THUMB_MAX_EDGE, beanThumbPath, thumbSize } from '../../utils/beanPhoto.ts'
import { cwebpArgs, planBackfill } from '../../scripts/backfill-bean-thumbnails.mjs'

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
    else if (/\.(vue|ts|mjs)$/.test(name)) out.push(path)
  }
  return out
}

const U = '6f1c2a4e-9d3b-4c8e-a1f0-2b7d9e5c3a10'

export default function run() {
  const r = createReport('豆袋照片的縮圖檔')

  r.section('路徑規則')
  r.check(beanThumbPath(`${U}/b1.webp`) === `${U}/b1.thumb`, 'webp 原圖 → {user}/{bean}.thumb')
  r.check(beanThumbPath(`${U}/b1.jpg`) === `${U}/b1.thumb`, 'jpg 原圖 → 同一個縮圖路徑（換格式時 upsert 蓋過去）')
  r.check(beanThumbPath(`${U}/b1`) === `${U}/b1.thumb`, '沒有副檔名的舊路徑也推得出來')
  r.check(beanThumbPath('a.b/c') === 'a.b/c.thumb', '資料夾名稱裡的點不算副檔名')
  r.check(beanThumbPath(`${U}/b1.webp`).startsWith(`${U}/`), '縮圖在同一個使用者資料夾：Storage 的 policy 不用改')

  r.section('縮圖尺寸')
  r.check(THUMB_MAX_EDGE === 384, '長邊 384px（160px 的首頁卡片在 2x 螢幕上要 320px）')
  r.check(JSON.stringify(thumbSize(1600, 1600)) === '{"width":384,"height":384}', '1600×1600 → 384×384')
  r.check(JSON.stringify(thumbSize(1200, 1600)) === '{"width":288,"height":384}', '直式：長邊 384，等比')
  r.check(JSON.stringify(thumbSize(300, 200)) === '{"width":300,"height":200}', '本來就比較小的不放大')

  r.section('上傳與刪除：兩張一起')
  const photos = stripComments(read('composables/useBeanPhotos.ts'))
  const upload = photos.slice(photos.indexOf('async function upload('), photos.indexOf('async function remove('))
  r.check(/uploadThumbnail\(path, image\)/.test(upload) && /Promise\.all/.test(upload), '上傳原圖時同時產生並上傳縮圖')
  r.check(/makeBeanThumbnail\(image\.blob\)/.test(photos) && /upsert: true/.test(photos.slice(photos.indexOf('uploadThumbnail'))),
    '縮圖從壓縮過的原圖產生，換照片時蓋過舊的縮圖')
  r.check(/urlCache\.forget\(beanThumbPath\(path\)\)/.test(upload), '換照片時縮圖的網址快取也清掉')
  const remove = photos.slice(photos.indexOf('async function remove('), photos.indexOf('async function signedUrl('))
  r.check(/\[path, beanThumbPath\(path\)\]/.test(remove) && /\.remove\(files\)/.test(remove), '刪除照片時縮圖一起刪')
  const image = read('utils/image.ts')
  r.check(/export async function makeBeanThumbnail/.test(image) && /thumbSize\(bitmap\.width, bitmap\.height\)/.test(image),
    '縮圖編碼走同一套 WebP 優先、JPEG 退路')

  r.section('縮圖大小的地方都用縮圖，縮圖檔不存在時退回原圖')
  r.check(/const fallback = await signedUrls\(missing\)/.test(photos), 'thumbnailUrls：沒有簽到縮圖的，再要原圖')
  r.check(/thumb: urls\.get\(beanThumbPath\(path\)\) \?\? full/.test(photos), 'photoUrls：縮圖不存在時 thumb 用原圖')
  for (const path of ['pages/index.vue', 'pages/beans/index.vue']) {
    const text = stripComments(read(path))
    r.check(/thumbnailUrls\(/.test(text) && !/signedUrls\(/.test(text), `${path}：用 thumbnailUrls`)
  }
  r.check(/thumbnailUrl\(props\.photoPath\)/.test(read('components/BrewShare.vue')), '分享對話框：用 thumbnailUrl')
  const server = read('server/utils/sharedPhoto.ts')
  r.check(/variant === 'thumb' \? await store\.download\(beanThumbPath\(path\)\) : null\)\s*\?\? await store\.download\(path\)/.test(server),
    '分享頁（伺服器轉送）：v=thumb 先讀縮圖，沒有再讀原圖')
  // 原圖只留給大圖：豆子詳情、表單預覽、放大檢視
  const originals = sourceFiles('pages').concat(sourceFiles('components'))
    .filter(path => /\bsignedUrls?\(/.test(stripComments(read(path))))
  r.check(JSON.stringify(originals.sort()) === JSON.stringify(['pages/beans/[id]/edit.vue', 'pages/beans/[id]/index.vue']),
    `直接要原圖的只有豆子詳情與編輯頁（${originals.join('、')}）`)

  r.section('補產生既有縮圖（scripts/backfill-bean-thumbnails.mjs）')
  const existing = new Set([`${U}/a.webp`, `${U}/a.thumb`, `${U}/b.jpg`])
  const plan = planBackfill([
    { id: 'a', user_id: U, photo_path: `${U}/a.webp` },
    { id: 'b', user_id: U, photo_path: `${U}/b.jpg` },
    { id: 'c', user_id: U, photo_path: `${U}/c.webp` },
    { id: 'd', user_id: U, photo_path: '  ' },
  ], existing)
  r.check(plan.hasThumb.map(x => x.bean).join() === 'a', '已經有縮圖的跳過（重跑是安全的）')
  r.check(plan.create.map(x => x.bean).join() === 'b' && plan.create[0].thumb === `${U}/b.thumb`, '只為缺縮圖的產生')
  r.check(plan.missingOriginal.map(x => x.bean).join() === 'c', '原圖不存在的列出來、不處理')
  r.check(plan.create.length + plan.hasThumb.length + plan.missingOriginal.length === 3, '空白路徑當作沒有照片')
  r.check(cwebpArgs(1600, 1600, 'in', 'out').join(' ') === '-quiet -q 80 -resize 384 384 in -o out', 'cwebp：長邊縮到 384')
  r.check(cwebpArgs(300, 200, 'in', 'out').join(' ') === '-quiet -q 80 in -o out', 'cwebp：小圖不放大')
  const script = stripComments(read('scripts/backfill-bean-thumbnails.mjs'))
  r.check(/'x-upsert': 'false'/.test(script), '上傳不覆蓋：跑的同時使用者傳了新縮圖，以那張為準')
  r.check(!/writeFile\([^)]*key/i.test(script) && !/sb_secret_[A-Za-z0-9]/.test(script) && !/eyJ[A-Za-z0-9_-]{10,}/.test(script),
    'secret key 不寫進檔案，腳本裡也沒有任何金鑰')
  r.check(/process\.env\.SUPABASE_SECRET_KEY \|\| await askHidden/.test(script), '金鑰從環境變數或不回顯的輸入取得')
  r.check(!/\.remove\(|method: 'DELETE'|method: 'PATCH'/.test(script), '不刪任何檔案、不改任何資料列')

  return r.finish()
}
