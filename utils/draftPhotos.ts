// 暫存中的豆袋照片（《02-功能規格》§6）。
//
// **為什麼要存**：手機瀏覽器會回收背景分頁的記憶體。使用者切去別的 app
// 再回來，等同重新整理——那不是刻意的操作，而是最容易遺失資料的情境。
//
// 文字欄位進 localStorage，照片（裁切、壓縮後的 Blob）進 IndexedDB：
// localStorage 只收字串，Blob 轉 base64 會膨脹三分之一，而 5MB 的總額度
// 兩三張照片就滿了。key 與文字暫存相同（draft:bean:new、draft:bean:{id}、
// draft:bean:inline），兩邊一起寫、一起刪。
//
// 存成 ArrayBuffer 而不是 Blob：舊版 Safari 把 Blob 放進 IndexedDB 會丟
// DataCloneError，ArrayBuffer 各家都支援。
//
// **讀不回來一律回 null，不丟例外。** 被系統清掉、私密模式、格式不對——
// 暫存是安全網，壞掉的安全網不該讓表單開不起來。呼叫端用文字暫存裡的
// 「有照片」標記判斷本來有沒有照片，才能告訴使用者照片沒能還原。
//
// 不引入函式庫：用到的只有 get／put／delete 與一次游標掃描，原生 API 包一層就夠。

import { DRAFT_TTL_MS } from './draft.ts'
import type { CompressedImage } from './image.ts'

/** 文字暫存說本來有照片，照片卻讀不回來。講發生了什麼與下一步，不只講結果 */
export const PHOTO_NOT_RESTORED = '上次選的照片沒能還原，請重新選一張'

export interface StoredPhoto {
  savedAt: number
  bytes: ArrayBuffer
  type: string
  ext: string
  width: number
  height: number
}

/** 儲存層。正式環境是 IndexedDB，測試換成記憶體版 */
export interface DraftPhotoBackend {
  get: (key: string) => Promise<unknown>
  put: (key: string, value: StoredPhoto) => Promise<void>
  delete: (key: string) => Promise<void>
  entries: () => Promise<[string, unknown][]>
}

export type DraftPhotoStore = ReturnType<typeof createDraftPhotos>

export function isStoredPhoto(value: unknown): value is StoredPhoto {
  if (!value || typeof value !== 'object') return false
  const record = value as Partial<StoredPhoto>
  return typeof record.savedAt === 'number'
    && record.bytes instanceof ArrayBuffer
    && record.bytes.byteLength > 0
    && typeof record.type === 'string'
    && typeof record.ext === 'string'
    && typeof record.width === 'number'
    && typeof record.height === 'number'
}

export function createDraftPhotos(backend: DraftPhotoBackend, now: () => number = Date.now) {
  const expired = (record: StoredPhoto) => now() - record.savedAt > DRAFT_TTL_MS

  // 每個工作階段掃一次，把過期與壞掉的清掉。文字暫存過期時照片不會
  // 被任何人讀到，不掃的話會一直佔著空間。存與讀之前都會先掃——
  // 只在讀的時候掃的話，從此不再還原任何照片的人永遠不會清到。
  let swept: Promise<void> | null = null
  function sweep() {
    swept ??= (async () => {
      try {
        for (const [key, value] of await backend.entries()) {
          if (!isStoredPhoto(value) || expired(value)) await backend.delete(key)
        }
      }
      catch (e) {
        console.warn('[draft-photo] 清理過期照片失敗', e)
      }
    })()
    return swept
  }

  /** 回傳是否存成功。失敗不丟例外——存不了照片不該中斷填寫 */
  async function save(key: string, image: CompressedImage): Promise<boolean> {
    await sweep()
    try {
      await backend.put(key, {
        savedAt: now(),
        bytes: await image.blob.arrayBuffer(),
        type: image.blob.type,
        ext: image.ext,
        width: image.width,
        height: image.height,
      })
      return true
    }
    catch (e) {
      console.warn('[draft-photo] 照片暫存失敗', e)
      return false
    }
  }

  /** 沒有、過期、壞掉、讀取失敗都回 null */
  async function load(key: string): Promise<CompressedImage | null> {
    await sweep()
    try {
      const record = await backend.get(key)
      if (!isStoredPhoto(record)) return null
      if (expired(record)) {
        await backend.delete(key)
        return null
      }
      return {
        blob: new Blob([record.bytes], { type: record.type }),
        ext: record.ext,
        width: record.width,
        height: record.height,
      }
    }
    catch (e) {
      console.warn('[draft-photo] 照片暫存讀不回來', e)
      return null
    }
  }

  async function remove(key: string): Promise<void> {
    try {
      await backend.delete(key)
    }
    catch (e) {
      console.warn('[draft-photo] 照片暫存刪不掉', e)
    }
  }

  return { save, load, remove, sweep }
}

const DB_NAME = 'coffee-log'
const STORE = 'draft-photos'

/** 原生 IndexedDB。第一次用到才開資料庫，伺服器端與測試 import 時不會碰到 */
export function indexedDbBackend(): DraftPhotoBackend {
  let opening: Promise<IDBDatabase> | null = null

  function open() {
    if (opening) return opening
    const attempt = new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('這個瀏覽器沒有 IndexedDB'))
        return
      }
      const request = indexedDB.open(DB_NAME, 1)
      request.onupgradeneeded = () => request.result.createObjectStore(STORE)
      request.onsuccess = () => {
        const database = request.result
        // 另一個分頁升級資料庫時讓出來，不要卡住它
        database.onversionchange = () => database.close()
        resolve(database)
      }
      request.onerror = () => reject(request.error)
    })
    // 開不起來的話下次再試，不要把失敗永遠記住
    attempt.catch(() => {
      if (opening === attempt) opening = null
    })
    opening = attempt
    return attempt
  }

  async function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>) {
    const database = await open()
    return new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(STORE, mode)
      const request = work(transaction.objectStore(STORE))
      transaction.oncomplete = () => resolve(request.result)
      transaction.onerror = () => reject(transaction.error ?? request.error)
      transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB 交易被中止'))
    })
  }

  return {
    get: key => run('readonly', store => store.get(key)),
    put: async (key, value) => { await run('readwrite', store => store.put(value, key)) },
    delete: async (key) => { await run('readwrite', store => store.delete(key)) },
    entries: async () => {
      const database = await open()
      return new Promise((resolve, reject) => {
        const found: [string, unknown][] = []
        const transaction = database.transaction(STORE, 'readonly')
        const request = transaction.objectStore(STORE).openCursor()
        request.onsuccess = () => {
          const cursor = request.result
          if (!cursor) return
          found.push([String(cursor.key), cursor.value])
          cursor.continue()
        }
        transaction.oncomplete = () => resolve(found)
        transaction.onerror = () => reject(transaction.error)
      })
    },
  }
}

export const draftPhotos = createDraftPhotos(indexedDbBackend())
