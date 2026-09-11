// 暫存中的豆袋照片（IndexedDB）。
//
// 失效方式很安靜：照片沒存到、過期沒清、或讀不回來時把整個還原流程拖垮。
// 這裡用記憶體版的儲存層驗邏輯；真正的 IndexedDB 在瀏覽器裡以重新整理實測。

import { createDraftPhotos, isStoredPhoto, type DraftPhotoBackend } from '../../utils/draftPhotos.ts'
import { DRAFT_TTL_MS } from '../../utils/draft.ts'
import { createReport } from '../helpers/report.mjs'

function memoryBackend() {
  const data = new Map<string, unknown>()
  const backend: DraftPhotoBackend = {
    get: async key => data.get(key),
    put: async (key, value) => { data.set(key, value) },
    delete: async (key) => { data.delete(key) },
    entries: async () => [...data.entries()],
  }
  return { data, backend }
}

const broken: DraftPhotoBackend = {
  get: async () => { throw new Error('QuotaExceededError') },
  put: async () => { throw new Error('QuotaExceededError') },
  delete: async () => { throw new Error('InvalidStateError') },
  entries: async () => { throw new Error('InvalidStateError') },
}

const photo = (bytes = [1, 2, 3, 4]) => ({
  blob: new Blob([new Uint8Array(bytes)], { type: 'image/webp' }),
  ext: 'webp',
  width: 1600,
  height: 1600,
})

export default async function run() {
  const r = createReport('暫存中的豆袋照片')
  let clock = 1_000_000

  r.section('存進去、讀得回來')
  const { data, backend } = memoryBackend()
  const photos = createDraftPhotos(backend, () => clock)
  r.check(await photos.save('draft:bean:new', photo()), '存成功回 true')
  const back = await photos.load('draft:bean:new')
  const bytes = back ? [...new Uint8Array(await back.blob.arrayBuffer())] : []
  r.check(bytes.join() === '1,2,3,4', '內容一個 byte 都沒變')
  r.check(back?.blob.type === 'image/webp' && back.ext === 'webp' && back.width === 1600 && back.height === 1600,
    '類型、副檔名、尺寸都在——上傳時要用')
  r.check(data.get('draft:bean:new') !== undefined && !((data.get('draft:bean:new') as { bytes: unknown }).bytes instanceof Blob),
    '存的是 ArrayBuffer 而不是 Blob——舊版 Safari 放 Blob 會丟 DataCloneError')

  r.section('key 與文字暫存對應，各自獨立')
  await photos.save('draft:bean:inline', photo([9, 9]))
  r.check((await photos.load('draft:bean:new'))?.blob.size === 4, '豆子表單那張沒被就地新增蓋掉')
  await photos.remove('draft:bean:inline')
  r.check(await photos.load('draft:bean:inline') === null, '刪掉就地新增那張')
  r.check(await photos.load('draft:bean:new') !== null, '豆子表單那張不受影響')
  r.check(await photos.load('draft:bean:never-saved') === null, '沒存過的 key 回 null')

  r.section('7 天時效，與 localStorage 暫存一致')
  clock = 1_000_000
  await photos.save('draft:bean:ttl', photo())
  clock += DRAFT_TTL_MS
  r.check(await photos.load('draft:bean:ttl') !== null, '剛好 7 天還在')
  clock += 1
  r.check(await photos.load('draft:bean:ttl') === null, '超過 7 天讀不到')
  r.check(!data.has('draft:bean:ttl'), '過期的那筆順手刪掉，不佔空間')

  r.section('每個工作階段掃一次，清掉沒人會讀的')
  const second = memoryBackend()
  clock = 5_000_000
  const writer = createDraftPhotos(second.backend, () => clock)
  await writer.save('draft:bean:old', photo())
  clock += DRAFT_TTL_MS + 1
  await writer.save('draft:bean:fresh', photo())
  second.data.set('draft:bean:garbage', { savedAt: 'not a number' })
  // 新的工作階段：讀任何一個 key 都會先掃一次
  const nextSession = createDraftPhotos(second.backend, () => clock)
  await nextSession.load('draft:bean:fresh')
  r.check(!second.data.has('draft:bean:old'), '過期的被清掉——文字暫存已經過期，這張不會再有人讀')
  r.check(!second.data.has('draft:bean:garbage'), '格式不對的被清掉')
  r.check(second.data.has('draft:bean:fresh'), '沒過期的留著')

  r.section('讀不回來時不讓表單壞掉')
  const failing = createDraftPhotos(broken, () => clock)
  let threw = false
  try {
    r.check(await failing.load('draft:bean:new') === null, '儲存層丟例外：回 null，由呼叫端說明照片沒能還原')
    r.check(await failing.save('draft:bean:new', photo()) === false, '存不了：回 false，不中斷填寫')
    await failing.remove('draft:bean:new')
  }
  catch {
    threw = true
  }
  r.check(!threw, '三個操作都不往外丟例外')
  data.set('draft:bean:partial', { savedAt: clock, type: 'image/webp' })
  r.check(await photos.load('draft:bean:partial') === null, '缺欄位的紀錄回 null，不會拿半筆資料去組 Blob')
  r.check(!isStoredPhoto({ savedAt: 1, bytes: new ArrayBuffer(0), type: 'image/webp', ext: 'webp', width: 1, height: 1 }),
    '空的 bytes 不算有照片')

  return r.finish()
}
