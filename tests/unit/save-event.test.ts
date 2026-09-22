// 每次儲存都記一筆耗時（brew_save_events，《01》§9.2）。
//
// 三件事在這裡守住：
//   1. 入口值：沿用暫存 key 的分法，認不出來就不寫入
//   2. 累計秒數跟著暫存走：還原時接續、清掉時歸零
//   3. 寫入失敗不影響儲存：不丟例外、不重試
//
// 暫存那段掛的是真的 useFormDraft（做法同 form-draft-unmount.test.ts），
// 計時器是真的 createInteractionClock。

import * as vue from 'vue'
import * as draft from '../../utils/draft.ts'
import { createInteractionClock, type InteractionDuration } from '../../utils/interactionTime.ts'
import { createReport } from '../helpers/report.mjs'

const { createRenderer, defineComponent, reactive, nextTick } = vue

class MemoryStorage {
  map = new Map<string, string>()
  get length() { return this.map.size }
  key(i: number) { return [...this.map.keys()][i] ?? null }
  getItem(key: string) { return this.map.get(key) ?? null }
  setItem(key: string, value: string) { this.map.set(key, String(value)) }
  removeItem(key: string) { this.map.delete(key) }
}

const storage = new MemoryStorage()
const g = globalThis as Record<string, unknown>
g.localStorage = storage
for (const name of ['ref', 'watch', 'onMounted', 'onBeforeUnmount'] as const) g[name] = vue[name]
Object.assign(g, draft)

/** useBrewSaveEvent 會呼叫 useSupabaseClient()，由每個案例自己換掉 */
let client: unknown = null
g.useSupabaseClient = () => client

const { useFormDraft } = await import('../../composables/useFormDraft.ts')
const { useBrewSaveEvent } = await import('../../composables/useBrewSaveEvent.ts')

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

interface Values { dose: string }
interface Draft { values: Values, duration?: InteractionDuration }

/** 與 BrewForm 相同的接法：耗時跟著暫存走，還原接續、清掉歸零 */
function mountForm(key: string) {
  const clock = createInteractionClock()
  const state = {
    clock,
    values: null as unknown as Values,
    api: null as ReturnType<typeof useFormDraft<Draft>> | null,
  }
  const app = createApp(defineComponent({
    setup() {
      state.values = reactive({ dose: '' })
      state.api = useFormDraft<Draft>(key, {
        read: () => ({ values: { ...state.values }, duration: clock.snapshot() }),
        restore: (data) => {
          if (data.duration) clock.carryOver(data.duration)
          Object.assign(state.values, data.values)
        },
        reset: () => { state.values.dose = '' },
        onClear: () => clock.reset(),
        identity: ({ values }) => ({ values }),
      })
      return () => null
    },
  }))
  app.mount(node())
  return { app, state }
}

export default async function run() {
  const r = createReport('每次儲存都記一筆耗時')

  // ── 入口 ───────────────────────────────────────────────
  r.section('入口沿用暫存 key 的分法')
  r.check(draft.brewSaveEntry('draft:brew:new') === 'blank', '空白新增 → blank')
  r.check(draft.brewSaveEntry('draft:brew:bean:abc') === 'bean', '指定豆子 → bean')
  r.check(draft.brewSaveEntry('draft:brew:copy:abc') === 'copy', '複製 → copy')
  r.check(draft.brewSaveEntry('draft:brew:5f0b0c6e-0000-4000-8000-000000000000') === 'edit',
    '編輯既有紀錄 → edit（key 是那筆的 id）')
  r.check(draft.brewSaveEntry(undefined) === null, '沒有 key 就沒有入口')
  r.check(draft.brewSaveEntry('draft:bean:new') === null, '豆子表單不是沖煮的入口')
  r.check(draft.brewSaveEntry('draft:brew:') === null,
    '認不出來回 null——歸錯的一列比缺一列難處理')

  // ── 秒數跟著暫存走 ─────────────────────────────────────
  r.section('還原暫存後接著累積')
  storage.map.clear()
  const first = mountForm('draft:brew:new')
  await nextTick()
  first.state.clock.touch(0, 'params')
  first.state.clock.touch(20_000, 'params')
  first.state.clock.touch(30_000, 'tasting') // 參數 30
  first.state.clock.touch(38_000, 'tasting') // 品飲 8
  first.state.values.dose = '15'
  await nextTick()
  await wait(600)
  first.app.unmount()
  r.check(storage.getItem('draft:brew:new') !== null, '前提：暫存寫進去了')

  const resumed = mountForm('draft:brew:new')
  await nextTick()
  await wait(0)
  r.check(resumed.state.values.dose === '15', '前提：內容有還原')
  const carried = resumed.state.clock.snapshot()
  r.check(carried.total === 38 && carried.params === 30 && carried.tasting === 8,
    `重新載入後接著累積，不是從零開始（實際 ${JSON.stringify(carried)}）`)
  resumed.state.clock.touch(1_000_000, 'params')
  resumed.state.clock.touch(1_005_000, 'params')
  const after = resumed.state.clock.snapshot()
  r.check(after.total === 43 && after.params === 35,
    '接著填的 5 秒疊在還原回來的秒數上——中斷的那段間隔不計入')

  r.section('暫存被清掉時秒數歸零')
  resumed.state.api?.clear()
  const cleared = resumed.state.clock.snapshot()
  r.check(cleared.total === 0 && cleared.params === 0 && cleared.tasting === 0,
    '儲存成功、重新開始、全部清除都會清暫存，秒數跟著歸零')
  resumed.app.unmount()

  r.section('不還原就沒有秒數可以接')
  storage.map.clear()
  const solo = mountForm('draft:brew:new')
  await nextTick()
  await wait(0)
  const fresh = solo.state.clock.snapshot()
  r.check(fresh.total === 0 && fresh.params === 0 && fresh.tasting === 0, '沒有暫存時從零開始')
  solo.app.unmount()

  r.section('壞掉的秒數不汙染計時器')
  const broken = createInteractionClock()
  broken.carryOver({ total: -5, params: Number.NaN, tasting: 3 } as InteractionDuration)
  const sane = broken.snapshot()
  r.check(sane.total === 0 && sane.params === 0 && sane.tasting === 3, '負數與 NaN 當成 0，好的那個照收')

  r.section('秒數不算「使用者填的內容」')
  // 內容與初始狀態相同、只有秒數不同的暫存（打了字又刪回空白之後留下的那種）
  storage.map.clear()
  storage.setItem('draft:brew:new', draft.packDraft({
    values: { dose: '' },
    duration: { total: 9, params: 9, tasting: 0 },
  }))
  const blank = mountForm('draft:brew:new')
  await nextTick()
  await wait(0)
  r.check(blank.state.api?.recovered.value === false && blank.state.api?.pending.value === null,
    '不對著一張空表單顯示「未儲存的內容已恢復」——秒數不同不算改過')
  r.check(storage.getItem('draft:brew:new') === null, '這種暫存沒有還原價值，直接清掉')
  blank.app.unmount()

  // ── 寫入失敗 ───────────────────────────────────────────
  const duration = { total: 70, params: 40, tasting: 25 }
  const BREW = 'b0000000-0000-4000-8000-000000000000'
  const USER = 'u0000000-0000-4000-8000-000000000000'

  function fakeClient(behaviour: 'ok' | 'error' | 'throw') {
    const calls: { table: string, row: Record<string, unknown> }[] = []
    return {
      calls,
      from(table: string) {
        return {
          insert(row: Record<string, unknown>) {
            calls.push({ table, row })
            if (behaviour === 'throw') throw new Error('連不上')
            return Promise.resolve(behaviour === 'error' ? { error: { message: '沒權限' } } : { error: null })
          },
        }
      },
    }
  }

  r.section('正常寫入')
  const ok = fakeClient('ok')
  client = ok
  await useBrewSaveEvent().record({ brewId: BREW, userId: USER, entry: 'edit', duration })
  r.check(ok.calls.length === 1 && ok.calls[0]!.table === 'brew_save_events', '寫進 brew_save_events')
  r.check(JSON.stringify(ok.calls[0]!.row) === JSON.stringify({
    brew_id: BREW, user_id: USER, entry: 'edit',
    params_seconds: 40, tasting_seconds: 25, total_seconds: 70,
  }), '三個秒數與入口原樣寫入')

  r.section('寫入失敗不影響儲存')
  const failed = fakeClient('error')
  client = failed
  let threw = false
  try {
    await useBrewSaveEvent().record({ brewId: BREW, userId: USER, entry: 'blank', duration })
  }
  catch { threw = true }
  r.check(!threw, '資料庫回錯誤時不丟例外——紀錄已經存好了，不能因為量測失敗而報錯')
  r.check(failed.calls.length === 1, '不重試')

  const crashed = fakeClient('throw')
  client = crashed
  threw = false
  try {
    await useBrewSaveEvent().record({ brewId: BREW, userId: USER, entry: 'blank', duration })
  }
  catch { threw = true }
  r.check(!threw, '連不上時同樣不丟例外')

  r.section('認不出入口就不寫入')
  const skipped = fakeClient('ok')
  client = skipped
  await useBrewSaveEvent().record({ brewId: BREW, userId: USER, entry: null, duration })
  r.check(skipped.calls.length === 0, '沒有入口就不記——歸錯的一列比缺一列難處理')

  return r.finish()
}
