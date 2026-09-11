// 就地新增介面的暫存。
//
// 這件事的失效方式是「使用者填的東西不見了」——沒有錯誤、沒有 console，
// 只有下次打開時一片空白。而且它與 useFormDraft（跨天的表單暫存）
// 是兩套機制，容易被誤以為重複而拿掉其中一套。

import { useInlineDraft, __resetInlineDrafts } from '../../composables/useInlineDraft.ts'
import { createDraftPhotos } from '../../utils/draftPhotos.ts'
import { packDraft, unpackDraft, DRAFT_TTL_MS } from '../../utils/draft.ts'
import type { CompressedImage } from '../../utils/image.ts'
import { createReport } from '../helpers/report.mjs'

interface BeanDraft { name: string, photo: { ext: string } | null }
const emptyBean = (): BeanDraft => ({ name: '', photo: null })

export default async function run() {
  const r = createReport('就地新增的暫存')
  __resetInlineDrafts()

  r.section('關掉再打開，內容還在')
  const bean = useInlineDraft<BeanDraft>('bean', emptyBean)
  r.check(bean.read().name === '', '第一次打開是空的')

  bean.save({ name: '耶加雪菲 G1', photo: { ext: 'webp' } })
  // 關掉再打開 = 重新拿一次同一個 key
  const reopened = useInlineDraft<BeanDraft>('bean', emptyBean)
  r.check(reopened.read().name === '耶加雪菲 G1', '豆名還在')
  r.check(reopened.read().photo?.ext === 'webp', '照片也還在——它是 Blob，本來就塞不進 localStorage')

  r.section('存成功之後要清掉')
  bean.clear()
  r.check(useInlineDraft<BeanDraft>('bean', emptyBean).read().name === '',
    '不清的話下次開會看到已經建好的那一筆')

  r.section('不同器材類型各自獨立')
  // 磨豆機填到一半跑去改濾杯，兩邊不該互相蓋掉
  const grinder = useInlineDraft('equipment:grinder', () => ({ custom_name: '' }))
  const dripper = useInlineDraft('equipment:dripper', () => ({ custom_name: '' }))
  grinder.save({ custom_name: '自組磨豆機' })
  dripper.save({ custom_name: '手工陶濾杯' })
  r.check(grinder.read().custom_name === '自組磨豆機', '磨豆機那份沒被蓋掉')
  r.check(dripper.read().custom_name === '手工陶濾杯', '濾杯那份也在')
  grinder.clear()
  r.check(dripper.read().custom_name === '手工陶濾杯', '清掉磨豆機不影響濾杯')

  r.section('存進去的是副本')
  __resetInlineDrafts()
  const live = { name: '打到一半', photo: null }
  const draft = useInlineDraft<BeanDraft>('bean', emptyBean)
  draft.save(live)
  live.name = '之後又改了但沒存'
  r.check(draft.read().name === '打到一半',
    '存的是當下的副本，不是同一個物件的參照——否則清空表單會連暫存一起清掉')

  r.section('與 useFormDraft 是兩套東西')
  // 這一條是給讀程式碼的人看的：兩者都叫「暫存」但目的不同。
  // useFormDraft 管整份表單（還原詢問、30 分鐘分界、橫幅）；這裡是就地新增，
  // 無聲、無提示，打開新增介面時內容就在。豆子這一份另外持久化（見下方）。
  r.check(typeof draft.read === 'function' && typeof draft.clear === 'function' && typeof draft.restore === 'function',
    '介面是 read／save／clear／restore，沒有還原詢問')

  r.section('取消與關閉是兩件事')
  // 關閉（返回鍵、Esc、點外面、切走、卸載）＝「我先離開一下」→ 保留
  // 取消（明確按下按鈕）＝「我不要建這個了」→ 清除
  __resetInlineDrafts()
  const d = useInlineDraft<BeanDraft>('bean', emptyBean)

  d.save({ name: '填到一半', photo: { ext: 'webp' } })
  // 關閉：什麼都不做，只是元件收起來。下次拿到的還是同一份
  r.check(useInlineDraft<BeanDraft>('bean', emptyBean).read().name === '填到一半',
    '關閉之後內容還在')

  d.clear()
  r.check(useInlineDraft<BeanDraft>('bean', emptyBean).read().name === '',
    '取消之後內容沒了——這是使用者唯一能明確清空的入口')

  r.section('取消只清當前那一份')
  __resetInlineDrafts()
  const g = useInlineDraft('equipment:grinder', () => ({ custom_name: '' }))
  const dr = useInlineDraft('equipment:dripper', () => ({ custom_name: '' }))
  g.save({ custom_name: '自組磨豆機' })
  dr.save({ custom_name: '手工陶濾杯' })
  g.clear()
  r.check(g.read().custom_name === '', '磨豆機那份被清掉')
  r.check(dr.read().custom_name === '手工陶濾杯',
    '濾杯那份不受影響——磨豆機按取消不該把別的類型一起清掉')

  r.section('欄位刪光等同取消')
  // 使用者一格一格刪到空，不該留下一筆空紀錄
  __resetInlineDrafts()
  const e = useInlineDraft<BeanDraft>('bean', emptyBean)
  e.save({ name: '打了幾個字', photo: null })
  e.save({ name: '', photo: null })
  r.check(useInlineDraft<BeanDraft>('bean', emptyBean).read().name === '',
    '刪光之後與取消的結果相同')

  r.section('只有部分欄位有值仍要保留')
  __resetInlineDrafts()
  const f = useInlineDraft<BeanDraft>('bean', emptyBean)
  f.save({ name: '', photo: { ext: 'webp' } })
  r.check(f.read().photo?.ext === 'webp', '只拍了照還沒打豆名，那張照片要留著')

  // ── 豆子的就地新增：分頁被回收之後 ──
  // 手機瀏覽器回收背景分頁，回來時頁面重新載入，記憶體那層跟著消失。
  // 以 __resetInlineDrafts() 模擬重新載入：記憶體清空，localStorage 與 IndexedDB 還在。
  const local = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    writable: true,
    value: {
      getItem: (k: string) => local.get(k) ?? null,
      setItem: (k: string, v: string) => { local.set(k, String(v)) },
      removeItem: (k: string) => { local.delete(k) },
    },
  })
  const idb = new Map<string, unknown>()
  let puts = 0
  const photos = createDraftPhotos({
    get: async k => idb.get(k),
    put: async (k, v) => { puts++; idb.set(k, v) },
    delete: async (k) => { idb.delete(k) },
    entries: async () => [...idb.entries()],
  })
  interface RealBean { name: string, photo: CompressedImage | null }
  const emptyReal = (): RealBean => ({ name: '', photo: null })
  const KEY = 'draft:bean:inline'
  const persist = { key: KEY, photoField: 'photo' as const, photos }
  const image = (bytes: number[]): CompressedImage =>
    ({ blob: new Blob([new Uint8Array(bytes)], { type: 'image/webp' }), ext: 'webp', width: 1600, height: 1600 })
  const settle = () => new Promise(resolve => setTimeout(resolve, 20))

  r.section('豆子的就地新增：分頁被回收後還在')
  __resetInlineDrafts()
  const before = useInlineDraft<RealBean>('bean', emptyReal, persist)
  before.save({ name: '耶加雪菲 G1', photo: image([1, 2, 3]) })
  await settle()
  const stored = unpackDraft<{ name: string, photo: unknown }>(local.get(KEY) ?? null)
  r.check(stored?.name === '耶加雪菲 G1', `豆名寫進 localStorage（${KEY}）`)
  r.check(stored?.photo === true, '文字暫存裡只留「有照片」的標記，Blob 不進 localStorage')
  r.check(idb.has(KEY), '照片寫進 IndexedDB，key 相同')

  __resetInlineDrafts() // 分頁被回收、重新載入
  const after = useInlineDraft<RealBean>('bean', emptyReal, persist)
  r.check(after.read().name === '', '記憶體那層已經沒了——這正是原本會遺失的情況')
  const back = await after.restore()
  r.check(back?.data.name === '耶加雪菲 G1', '豆名拿回來了')
  const backBytes = back?.data.photo ? [...new Uint8Array(await back.data.photo.blob.arrayBuffer())] : []
  r.check(backBytes.join() === '1,2,3', '照片拿回來了，內容相同')
  r.check(back?.photoLost === false, '沒有「照片沒能還原」的說明')
  r.check(after.read().name === '耶加雪菲 G1', '還原後同一個工作階段裡照常走記憶體那層')
  r.check(await after.restore() === null, '記憶體裡已經有了就不再從持久層覆蓋')

  r.section('照片讀不回來：豆名照常還原，照片留空並說明')
  __resetInlineDrafts()
  idb.clear() // 例如系統清掉了 IndexedDB
  const evicted = await useInlineDraft<RealBean>('bean', emptyReal, persist).restore()
  r.check(evicted?.data.name === '耶加雪菲 G1', '豆名照常還原')
  r.check(evicted?.data.photo === null, '照片欄位留空')
  r.check(evicted?.photoLost === true, '回報照片沒能還原，由介面說明')

  r.section('只改豆名不重寫照片')
  __resetInlineDrafts()
  local.clear()
  idb.clear()
  puts = 0
  const typing = useInlineDraft<RealBean>('bean', emptyReal, persist)
  const same = image([7])
  typing.save({ name: '耶', photo: same })
  typing.save({ name: '耶加', photo: same })
  typing.save({ name: '耶加雪菲', photo: same })
  await settle()
  r.check(puts === 1, `打三個字只寫一次照片（實際 ${puts} 次）——每個字都重寫一張圖太浪費`)

  r.section('取消與儲存成功：兩層一起刪')
  typing.clear()
  await settle()
  r.check(!local.has(KEY) && !idb.has(KEY), 'localStorage 與 IndexedDB 都刪掉了')
  __resetInlineDrafts()
  r.check(await useInlineDraft<RealBean>('bean', emptyReal, persist).restore() === null, '重新載入後不會再冒出來')

  r.section('欄位刪光：兩層一起刪')
  const erase = useInlineDraft<RealBean>('bean', emptyReal, persist)
  erase.save({ name: '打錯', photo: image([5]) })
  await settle()
  erase.save({ name: '', photo: null })
  await settle()
  r.check(!local.has(KEY) && !idb.has(KEY), '刪光等同取消')

  r.section('7 天時效，與豆子表單一致')
  __resetInlineDrafts()
  local.clear()
  idb.clear()
  local.set(KEY, packDraft({ name: '上個月的豆子', photo: true }, Date.now() - DRAFT_TTL_MS - 1))
  await photos.save(KEY, image([1]))
  r.check(await useInlineDraft<RealBean>('bean', emptyReal, persist).restore() === null, '超過 7 天不還原')
  await settle()
  r.check(!idb.has(KEY), '文字暫存過期時照片一起清掉，不留孤兒')

  r.section('器材的就地新增不持久')
  __resetInlineDrafts()
  local.clear()
  const grinderOnly = useInlineDraft('equipment:grinder', () => ({ custom_name: '' }))
  grinderOnly.save({ custom_name: '自組磨豆機' })
  r.check(local.size === 0, '沒給持久設定就只留在記憶體——器材這條沒有要求')
  r.check(await grinderOnly.restore() === null, '沒有持久層可以還原')

  return r.finish()
}
