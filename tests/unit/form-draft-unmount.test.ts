// 離開表單時，最後那次改動要進暫存。
//
// 回歸的情境：改完一個欄位，0.5 秒內按取消、返回鍵或分頁列。
// 暫存的寫入有 500ms 延遲（持續輸入時不一直寫），元件卸載時原本只把計時器
// 停掉，那次改動就不見了——下次回來，還原的是改動之前的內容。
//
// 這裡掛的是真的 useFormDraft，不是模擬：它靠 Nuxt 的自動匯入拿 ref、watch
// 這些名字，測試裡先把它們放到 globalThis 上，再用一個什麼都不畫的
// 自訂 renderer 掛載元件，讓 onMounted／onBeforeUnmount 照真實順序跑。

import * as vue from 'vue'
import * as draft from '../../utils/draft.ts'
import { createReport } from '../helpers/report.mjs'

const { createRenderer, defineComponent, reactive, nextTick } = vue

class MemoryStorage {
  #map = new Map<string, string>()
  getItem(key: string) { return this.#map.get(key) ?? null }
  setItem(key: string, value: string) { this.#map.set(key, String(value)) }
  removeItem(key: string) { this.#map.delete(key) }
}

const g = globalThis as Record<string, unknown>
g.localStorage = new MemoryStorage()
for (const name of ['ref', 'watch', 'onMounted', 'onBeforeUnmount'] as const) g[name] = vue[name]
Object.assign(g, draft)

const { useFormDraft } = await import('../../composables/useFormDraft.ts')

// 什麼都不畫：這裡只需要元件的生命週期
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

function mountForm(key: string) {
  let values!: { name: string }
  let api!: ReturnType<typeof useFormDraft<{ name: string }>>
  const app = createApp(defineComponent({
    setup() {
      values = reactive({ name: '' })
      api = useFormDraft<{ name: string }>(key, {
        read: () => ({ ...values }),
        restore: (data) => { values.name = data.name },
      })
      return () => null
    },
  }))
  app.mount(node())
  return { app, values: () => values, api: () => api }
}

const stored = (key: string) => draft.unpackDraft<{ name: string }>(
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage.getItem(key),
)

export default async function run() {
  const r = createReport('離開表單時的暫存')

  r.section('改完立刻離開')
  const quick = mountForm('test:quick')
  quick.values().name = '耶加雪菲'
  await nextTick() // 讓 watch 排定寫入，但遠不到 500ms
  r.check(stored('test:quick') === null, '前提：延遲寫入還沒發生')
  quick.app.unmount()
  r.check(stored('test:quick')?.name === '耶加雪菲', '卸載時立刻寫入：暫存包含最後那次改動')

  r.section('連續改動後離開，只寫最後一次')
  const typing = mountForm('test:typing')
  typing.values().name = '耶'
  await nextTick()
  typing.values().name = '耶加'
  await nextTick()
  typing.values().name = '耶加雪菲 G1'
  await nextTick()
  typing.app.unmount()
  r.check(stored('test:typing')?.name === '耶加雪菲 G1', '寫進去的是最後的內容')
  await wait(600)
  r.check(stored('test:typing')?.name === '耶加雪菲 G1', '卸載後計時器不會再寫一次舊內容')

  r.section('清掉之後離開，不能寫回來')
  // 儲存成功、全部清除、重新開始都走 clear()：待寫入的內容要丟掉
  const cleared = mountForm('test:cleared')
  cleared.values().name = '耶加雪菲'
  await nextTick()
  cleared.api().clear()
  cleared.app.unmount()
  r.check(stored('test:cleared') === null, '儲存成功後按離開：暫存不會被剛才那筆寫回來')

  r.section('沒動過就離開')
  const untouched = mountForm('test:untouched')
  untouched.app.unmount()
  r.check(stored('test:untouched') === null, '空白表單不寫暫存')

  return r.finish()
}
