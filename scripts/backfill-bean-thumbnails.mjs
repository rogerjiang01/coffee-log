// 補產生既有豆袋照片的縮圖（utils/beanPhoto.ts、《01》§7）。一次性的工具，**只在本機跑**。
//
// 縮圖上線之前存的照片沒有縮圖檔。顯示端會退回原圖，所以不補也不會壞，只是慢；
// 這支把它們一次補齊。上線之後新傳的照片由瀏覽器自己產生縮圖，不需要再跑。
//
// 用法（在專案根目錄）：
//   node --env-file=.env --experimental-strip-types scripts/backfill-bean-thumbnails.mjs --dry-run
//   node --env-file=.env --experimental-strip-types scripts/backfill-bean-thumbnails.mjs
//
// **secret key 不寫進任何檔案。** 執行時在終端機輸入（不回顯），或先在同一個 shell 用
// `read -rs SUPABASE_SECRET_KEY && export SUPABASE_SECRET_KEY` 設好。.env 只提供 SUPABASE_URL。
//
// 需要 macOS 的 sips（讀尺寸）與 cwebp（brew install webp）。
//
// 做什麼：
//   1. 以 service role 讀出所有 photo_path 不是空的豆子
//   2. 逐個使用者資料夾列出 Storage 裡既有的檔案
//   3. 縮圖已經存在的跳過；原圖不存在的列出來、不處理
//   4. 下載原圖 → 長邊縮到 THUMB_MAX_EDGE、轉 WebP（品質 80）→ 上傳到縮圖路徑
//      上傳不覆蓋（x-upsert: false）：跑的同時使用者剛好換了照片，瀏覽器傳的那張為準
// 不改任何資料表、不刪任何檔案。重跑是安全的：已經有縮圖的會跳過。

import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import { beanThumbPath, thumbSize } from '../utils/beanPhoto.ts'

const run = promisify(execFile)
const BUCKET = 'bean-photos'

/**
 * 決定每一筆要做什麼（純函式，tests/unit/thumbnail-backfill.test.mjs）。
 * @param beans {{ id: string, user_id: string, photo_path: string }[]}
 * @param existing {Set<string>} Storage 裡既有的完整路徑
 */
export function planBackfill(beans, existing) {
  const plan = { create: [], hasThumb: [], missingOriginal: [] }
  for (const bean of beans) {
    const path = bean.photo_path?.trim()
    if (!path) continue
    const thumb = beanThumbPath(path)
    if (existing.has(thumb)) plan.hasThumb.push({ bean: bean.id, path, thumb })
    else if (!existing.has(path)) plan.missingOriginal.push({ bean: bean.id, path, thumb })
    else plan.create.push({ bean: bean.id, path, thumb })
  }
  return plan
}

/** cwebp 的參數：等比縮到長邊 THUMB_MAX_EDGE，本來就比較小的不放大 */
export function cwebpArgs(width, height, input, output) {
  const size = thumbSize(width, height)
  const resize = size.width < width || size.height < height ? ['-resize', String(size.width), String(size.height)] : []
  return ['-quiet', '-q', '80', ...resize, input, '-o', output]
}

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    rl._writeToOutput = (text) => {
      if (text.includes(question)) process.stdout.write(text)
    }
    rl.question(question, (answer) => {
      rl.close()
      process.stdout.write('\n')
      resolve(answer.trim())
    })
  })
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const url = process.env.SUPABASE_URL?.replace(/\/+$/, '')
  if (!url) throw new Error('找不到 SUPABASE_URL：請用 node --env-file=.env 執行')

  const key = process.env.SUPABASE_SECRET_KEY || await askHidden('Supabase secret key（不會顯示）：')
  if (!key) throw new Error('沒有輸入 secret key')
  if (key === process.env.SUPABASE_KEY || key.startsWith('sb_publishable_')) {
    throw new Error('這是 publishable／anon key，不是 secret key')
  }
  const headers = { apikey: key, Authorization: `Bearer ${key}` }

  async function api(path, init = {}) {
    const response = await fetch(`${url}${path}`, { ...init, headers: { ...headers, ...init.headers } })
    if (!response.ok) {
      const body = await response.text().catch(() => '')
      const error = new Error(`${init.method ?? 'GET'} ${path.split('?')[0]} → ${response.status} ${body.slice(0, 200)}`)
      error.status = response.status
      error.body = body
      throw error
    }
    return response
  }

  if (!dryRun) {
    try {
      await run('cwebp', ['-version'])
    }
    catch {
      throw new Error('找不到 cwebp：brew install webp')
    }
  }

  // 1. 所有有照片的豆子
  const beans = await (await api(
    '/rest/v1/beans?select=id,user_id,photo_path&photo_path=not.is.null&order=user_id,id&limit=100000',
  )).json()

  // 2. 逐個使用者資料夾列出既有檔案
  const existing = new Set()
  for (const userId of new Set(beans.map(b => b.user_id))) {
    for (let offset = 0; ; offset += 1000) {
      const items = await (await api(`/storage/v1/object/list/${BUCKET}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prefix: userId, limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } }),
      })).json()
      for (const item of items) existing.add(`${userId}/${item.name}`)
      if (items.length < 1000) break
    }
  }

  const plan = planBackfill(beans, existing)
  console.log(`有照片的豆子 ${beans.length} 支：要產生縮圖 ${plan.create.length}、已有縮圖 ${plan.hasThumb.length}、原圖不存在 ${plan.missingOriginal.length}`)
  for (const item of plan.missingOriginal) console.log(`  原圖不存在，略過：bean ${item.bean}`)
  if (dryRun) {
    for (const item of plan.create) console.log(`  會產生：bean ${item.bean}`)
    console.log('（--dry-run：沒有下載、沒有上傳）')
    return
  }

  // 3. 逐一產生
  const dir = await mkdtemp(join(tmpdir(), 'bean-thumbs-'))
  const result = { created: 0, raced: 0, failed: 0 }
  try {
    for (const [index, item] of plan.create.entries()) {
      const label = `[${index + 1}/${plan.create.length}] bean ${item.bean}`
      try {
        const input = join(dir, `${item.bean}-original`)
        const output = join(dir, `${item.bean}.webp`)
        const original = await api(`/storage/v1/object/authenticated/${BUCKET}/${item.path}`)
        await writeFile(input, new Uint8Array(await original.arrayBuffer()))

        const { stdout } = await run('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', input])
        const width = Number(stdout.match(/pixelWidth:\s*(\d+)/)?.[1])
        const height = Number(stdout.match(/pixelHeight:\s*(\d+)/)?.[1])
        if (!width || !height) throw new Error('讀不到原圖尺寸')
        await run('cwebp', cwebpArgs(width, height, input, output))

        const bytes = await readFile(output)
        try {
          await api(`/storage/v1/object/${BUCKET}/${item.thumb}`, {
            method: 'POST',
            headers: { 'content-type': 'image/webp', 'x-upsert': 'false', 'cache-control': '3600' },
            body: bytes,
          })
          result.created++
          const size = thumbSize(width, height)
          console.log(`${label}：${width}×${height} → ${size.width}×${size.height}，${(bytes.length / 1024).toFixed(1)} KB`)
        }
        catch (error) {
          // 跑的同時瀏覽器已經傳了新的縮圖：以那張為準
          if (/already exists|Duplicate/i.test(error.body ?? '') || error.status === 409) {
            result.raced++
            console.log(`${label}：縮圖剛剛已經有了，略過`)
          }
          else throw error
        }
      }
      catch (error) {
        result.failed++
        console.error(`${label}：失敗 ${error.message}`)
      }
    }
  }
  finally {
    await rm(dir, { recursive: true, force: true })
  }
  console.log(`完成：產生 ${result.created}、同時已有 ${result.raced}、失敗 ${result.failed}`)
  if (result.failed) process.exitCode = 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}
