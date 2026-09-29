// server/utils/sharedPhoto.ts 的實際存取：以 service role 查路徑、讀檔案。
//
// **service role 只在這裡用。** 這個檔案在 server/ 底下，只會打包進伺服器端；
// 金鑰從 runtimeConfig.supabase 讀（私有的那一半，不會送到瀏覽器）。
// 環境變數是 NUXT_SUPABASE_SECRET_KEY（@nuxtjs/supabase 的 serverSupabaseServiceRole 讀它）。

import type { H3Event } from 'h3'
import { serverSupabaseServiceRole } from '#supabase/server'
import type { SharedPhotoStore } from './sharedPhoto'
import { currentTiming } from './tempTiming' // TEMP-TIMING

const BUCKET = 'bean-photos'

export function sharedPhotoStore(event: H3Event): SharedPhotoStore {
  const client = serverSupabaseServiceRole(event)
  const timing = currentTiming(event) // TEMP-TIMING
  const timed = <T>(name: string, run: () => Promise<T>, describe?: (value: T) => string) => // TEMP-TIMING
    timing ? timing.time(name, run, describe) : run() // TEMP-TIMING
  return {
    async photoPath(code) {
      const { data, error } = await timed('rpc', async () => client.rpc('get_shared_bean_photo_path' as never, { share_code: code } as never)) // TEMP-TIMING（原本直接 await client.rpc）
      // 查詢本身出錯不能當成「沒有照片」吞掉：那會讓設定錯誤（金鑰、函式沒推）永遠查不出來
      if (error) throw error
      return typeof data === 'string' && data ? data : null
    },
    async download(path) {
      const kind = path.endsWith('.thumb') ? 'thumb' : 'full' // TEMP-TIMING
      return timed(`dl_${kind}`, async () => { // TEMP-TIMING（包住原本的內容）
        const { data, error } = await client.storage.from(BUCKET).download(path)
        if (error || !data) return null
        return { bytes: new Uint8Array(await data.arrayBuffer()), type: data.type }
      }, file => (file ? `${file.bytes.length}B` : 'miss')) // TEMP-TIMING
    },
  }
}

/**
 * 簽圖片網址用的金鑰。沿用 service role 金鑰，不另外設一個環境變數：
 * HMAC 不會洩漏金鑰本身，而這把金鑰本來就只在伺服器端
 */
export function sharedPhotoSecret(event: H3Event): string {
  const config = useRuntimeConfig(event)
  const key = config.supabase?.secretKey || config.supabase?.serviceKey
  if (!key) throw createError({ statusCode: 500, statusMessage: 'Missing NUXT_SUPABASE_SECRET_KEY' })
  return key
}
