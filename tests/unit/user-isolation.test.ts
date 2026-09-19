// 換帳號時看不到前一個人的資料。
//
// 隔離靠 key 依使用者分開，不靠清除動作：關分頁、session 過期、不登出直接換帳號
// 都不會經過登出。所以下面每一條都**不呼叫任何清除**，只切換「目前是誰」。
//
// 暫存掛的是真的 useFormDraft 與 useScopedDraftKey（做法同 form-draft-unmount.test.ts）；
// 照片用真的 createDraftPhotos，儲存層換成記憶體版；快取用真的 useQueryCache。

import * as vue from 'vue'
import * as draft from '../../utils/draft.ts'
import { createDraftPhotos, type DraftPhotoBackend } from '../../utils/draftPhotos.ts'
import { useQueryCache, setQueryCacheScope, __resetQueryCache } from '../../composables/useQueryCache.ts'
import { createReport } from '../helpers/report.mjs'

const { createRenderer, defineComponent, reactive, nextTick, ref } = vue

const A = '11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const B = '22222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

class MemoryStorage {
  map = new Map<string, string>()
  get length() { return this.map.size }
  key(i: number) { return [...this.map.keys()][i] ?? null }
  getItem(key: string) { return this.map.get(key) ?? null }
  setItem(key: string, value: string) { this.map.set(key, String(value)) }
  removeItem(key: string) { this.map.delete(key) }
}

const storage = new MemoryStorage()
/** 目前登入的是誰。null 是沒登入 */
const currentUser = ref<string | null>(null)

const g = globalThis as Record<string, unknown>
g.localStorage = storage
for (const name of ['ref', 'watch', 'onMounted', 'onBeforeUnmount'] as const) g[name] = vue[name]
Object.assign(g, draft)
g.useCurrentUserId = () => currentUser

const { useFormDraft } = await import('../../composables/useFormDraft.ts')
const { useScopedDraftKey } = await import('../../composables/useScopedDraftKey.ts')

type Node = { children: Node[], parent: Node | null }
const node = (): Node => ({ children: [], parent: null })
const { createApp } = createRenderer<Node, Node>({
  createElement: node,
  createText: node,
  createComment: node,
  setText() {},
  setElementText() {},
  patchProp() {},
  insert(child, parent) { child.parent = parent; parent.children.push(child) },
  remove(child) {
    const list = child.parent?.children
    if (list) list.splice(list.indexOf(child), 1)
  },
  parentNode: child => child.parent,
  nextSibling: () => null,
})

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

interface Values { grinder: string, dose: string }

/** 與 BrewForm 相同的接法：頁面給邏輯 key，表單經 useScopedDraftKey 換成實際 key */
function mountBrewForm() {
  const state = {
    values: null as unknown as Values,
    api: null as ReturnType<typeof useFormDraft<Values>> | null,
    storageKey: undefined as string | undefined,
    /** 參照檢查被呼叫的次數：「磨豆機已被刪除」就是從這裡來的 */
    sanitized: 0,
  }
  const app = createApp(defineComponent({
    setup() {
      state.values = reactive({ grinder: '', dose: '' })
      state.storageKey = useScopedDraftKey('draft:brew:new')
      state.api = state.storageKey
        ? useFormDraft<Values>(state.storageKey, {
            read: () => ({ ...state.values }),
            restore: data => Object.assign(state.values, data),
            sanitize: (data) => { state.sanitized++; return data },
          })
        : null
      return () => null
    },
  }))
  app.mount(node())
  return { app, state }
}

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

const photo = () => ({
  blob: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/webp' }),
  ext: 'webp',
  width: 1600,
  height: 1600,
})

export default async function run() {
  const r = createReport('換帳號時的資料隔離')

  // ── 暫存 ───────────────────────────────────────────────
  r.section('A 填一半，不登出直接換成 B')
  currentUser.value = A
  const formA = mountBrewForm()
  await nextTick()
  formA.state.values.grinder = 'A 的磨豆機'
  formA.state.values.dose = '15'
  await nextTick()
  await wait(600) // 過了寫入延遲
  formA.app.unmount()
  r.check(storage.getItem(`draft:${A}:brew:new`) !== null, '前提：A 的暫存確實寫進去了，寫在帶 A 的 id 的 key')
  r.check(storage.getItem('draft:brew:new') === null, '沒有寫到不帶使用者的 key')

  currentUser.value = B // 沒有登出、沒有任何清除
  const formB = mountBrewForm()
  await nextTick()
  await wait(0)
  r.check(formB.state.values.grinder === '' && formB.state.values.dose === '', 'B 打開同一張表單是空的')
  r.check(formB.state.api?.recovered.value === false && formB.state.api?.pending.value === null,
    'B 看不到還原橫幅，也不會被問要不要接著填')
  r.check(formB.state.sanitized === 0,
    '不會拿 A 的暫存去做參照檢查——B 不會看到「磨豆機已被刪除」這種不屬於他的訊息')
  formB.app.unmount()
  r.check(storage.getItem(`draft:${A}:brew:new`) !== null, 'A 的暫存沒被 B 動到')

  currentUser.value = A
  const formA2 = mountBrewForm()
  await nextTick()
  await wait(0)
  r.check(formA2.state.values.grinder === 'A 的磨豆機', 'A 回來，他的暫存還在')
  formA2.app.unmount()

  r.section('沒有使用者時不暫存')
  currentUser.value = null
  const anonymous = mountBrewForm()
  r.check(anonymous.state.storageKey === undefined && anonymous.state.api === null,
    '沒有使用者 id 就不做暫存，不退回共用的 key')
  anonymous.app.unmount()

  r.section('舊格式的 key 存在時')
  storage.map.clear()
  storage.setItem('draft:brew:new', draft.packDraft({ grinder: '舊版的暫存', dose: '18' }))
  storage.setItem('draft:brew:copy:x', '壞掉的')
  currentUser.value = B
  let legacyThrew = false
  let legacy: ReturnType<typeof mountBrewForm> | null = null
  try {
    legacy = mountBrewForm()
    await nextTick()
    await wait(0)
  }
  catch {
    legacyThrew = true
  }
  r.check(!legacyThrew, '掛載表單不報錯')
  r.check(legacy?.state.values.grinder === '' && legacy?.state.sanitized === 0,
    '舊格式不被當成任何人的暫存讀回來——不遷移，讓它自己過期')
  legacy?.app.unmount()
  r.check(storage.getItem('draft:brew:new') !== null, '也不會被表單順手刪掉：過期之前留著，交給過期掃描')

  // ── 照片暫存 ───────────────────────────────────────────
  r.section('A 的照片暫存 B 讀不到')
  const { data: photoData, backend } = memoryBackend()
  const photos = createDraftPhotos(backend)
  const keyA = draft.scopeDraftKey(A, 'draft:bean:new')
  const keyB = draft.scopeDraftKey(B, 'draft:bean:new')
  await photos.save(keyA, photo())
  r.check(photoData.has(keyA), '前提：A 的照片存在帶 A 的 id 的 key')
  r.check(await photos.load(keyB) === null, 'B 打開同一張豆子表單，讀不到 A 的照片')
  r.check(await photos.load(draft.scopeDraftKey(B, 'draft:bean:inline')) === null, '就地新增也一樣')
  r.check(await photos.load(keyA) !== null, 'A 自己讀得到')
  photoData.set('draft:bean:new', { savedAt: Date.now(), type: 'image/webp' })
  r.check(await photos.load(keyB) === null, '舊格式的照片不會被當成 B 的讀回來')

  // ── 查詢快取 ───────────────────────────────────────────
  const cache = useQueryCache()
  const KEY = 'beans:list'

  r.section('A 登入 → 登出 → B 登入：沒有任何一秒的舊畫面')
  __resetQueryCache()
  setQueryCacheScope(() => currentUser.value)
  currentUser.value = A
  await cache.swr(KEY, async () => ['A 的豆子'], { apply: () => {} }).settled
  r.check(cache.peek(KEY) !== null, '前提：A 的資料在快取裡')

  currentUser.value = null // 登出（這裡刻意不呼叫 clear，驗的是分區本身）
  r.check(cache.peek(KEY) === null, '登出後讀不到')

  currentUser.value = B
  const shown: unknown[] = []
  const first = cache.swr(KEY, async () => ['B 的豆子'], { apply: data => shown.push(data) })
  r.check(first.hit === false, 'B 的第一個畫面未命中——走骨架，不是先畫出 A 的資料')
  r.check(shown.length === 0, '資料回來之前一次都沒有 apply')
  await first.settled
  r.check(JSON.stringify(shown) === JSON.stringify([['B 的豆子']]), '畫面上從頭到尾只出現過 B 的資料')

  r.section('不登出直接換帳號')
  __resetQueryCache()
  currentUser.value = A
  await cache.swr(KEY, async () => ['A 的豆子'], { apply: () => {} }).settled
  currentUser.value = B
  const direct: unknown[] = []
  const switched = cache.swr(KEY, async () => ['B 的豆子'], { apply: data => direct.push(data) })
  r.check(switched.hit === false && direct.length === 0, '沒經過登出也一樣未命中')
  await switched.settled
  currentUser.value = A
  r.check(JSON.stringify(cache.peek(KEY)?.data) === JSON.stringify(['A 的豆子']), '各自的格子互不覆蓋')

  r.section('換帳號時還在路上的查詢')
  __resetQueryCache()
  currentUser.value = A
  const slow = cache.swr(KEY, async () => { await wait(20); return ['A 登出前發出的查詢'] }, { apply: () => {} })
  currentUser.value = B
  await slow.settled
  r.check(cache.peek(KEY) === null, '回來時寫進發出當下的 A 的格子，不會落在 B 的格子裡')
  currentUser.value = A
  r.check(cache.peek(KEY) !== null, '（它確實寫進了 A 的格子）')

  r.section('沒有登入時整個快取停用')
  __resetQueryCache()
  currentUser.value = null
  let fetched = 0
  const bare = cache.swr(KEY, async () => { fetched++; return ['x'] }, { apply: () => {} })
  await bare.settled
  cache.set(KEY, ['y'])
  cache.prime(KEY, ['z'])
  r.check(bare.hit === false && fetched === 1, '查詢照常發出')
  r.check(cache.peek(KEY) === null, '什麼都沒留下——不能放進一個誰都讀得到的格子')

  r.section('失效對所有分區生效')
  __resetQueryCache()
  currentUser.value = A
  cache.set(KEY, ['A'])
  currentUser.value = B
  cache.set(KEY, ['B'])
  cache.invalidate(['beans:*'])
  r.check(cache.peek(KEY) === null, 'B 的格子清掉')
  currentUser.value = A
  r.check(cache.peek(KEY) === null, 'A 的格子也清掉')

  // 其他測試檔用預設的固定分區
  setQueryCacheScope(() => 'test')
  __resetQueryCache()
  return r.finish()
}
