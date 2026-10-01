// 新增紀錄時帶入常用器材（《02》§5、utils/defaultEquipment.ts）。
//
// 回歸的情境（2026-10-01）：指定豆子新增（/brews/new?bean=…）時五個器材欄位都是空的。
// 表單原本用「有沒有收到初始值」判斷要不要帶入，而這個入口的初始值裡有豆子。
// 首頁的浮動新增按鈕在只有一支未喝完的豆子時走的就是這個入口。
//
// 暫存那幾段掛的是真的 useFormDraft（做法同 form-draft-unmount.test.ts）：
// 器材清單與暫存還原都是非同步的，兩種先後順序都要是「以暫存內容為準」。
// 表單怎麼把這些接起來，由 default-equipment-wiring.test.mjs 檢查。

import * as vue from 'vue'
import * as draft from '../../utils/draft.ts'
import { createReport } from '../helpers/report.mjs'
import { createDefaultEquipment, defaultEquipmentPatch, type EquipmentFields } from '../../utils/defaultEquipment.ts'

const { createRenderer, defineComponent, reactive, nextTick } = vue

class MemoryStorage {
  #map = new Map<string, string>()
  getItem(key: string) { return this.#map.get(key) ?? null }
  setItem(key: string, value: string) { this.#map.set(key, String(value)) }
  removeItem(key: string) { this.#map.delete(key) }
}

const g = globalThis as Record<string, unknown>
const storage = new MemoryStorage()
g.localStorage = storage
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

// 使用者的器材：每一類各一台常用，磨豆機另有一台不是常用的
const equipment = [
  { id: 'g-other', type: 'grinder' as const, is_default: false },
  { id: 'g-default', type: 'grinder' as const, is_default: true },
  { id: 'd-default', type: 'dripper' as const, is_default: true },
  { id: 'k-default', type: 'kettle' as const, is_default: true },
  { id: 'f-default', type: 'filter' as const, is_default: true },
  { id: 's-default', type: 'server' as const, is_default: true },
]
const ALL_DEFAULTS = {
  grinder_id: 'g-default', dripper_id: 'd-default', kettle_id: 'k-default', filter_id: 'f-default', server_id: 's-default',
}

type FormValues = EquipmentFields & { bean_id: string | null }
const blankValues = (): FormValues => ({
  bean_id: null, grinder_id: null, dripper_id: null, kettle_id: null, filter_id: null, server_id: null,
})
const equipmentOf = (values: FormValues) => {
  const { bean_id: _, ...rest } = values
  return rest
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** 表單一掛上、器材清單讀到之後的樣子 */
function opened(enabled: boolean, initial: Partial<FormValues> = {}) {
  const values = { ...blankValues(), ...initial }
  createDefaultEquipment({ enabled, values }).apply(equipment)
  return values
}

/**
 * 與 BrewForm 相同的接法：暫存還原時先告訴 createDefaultEquipment，再把整份寫回表單。
 * sanitizeMs 模擬還原前的參照檢查（一趟網路來回）要多久
 */
function mountForm(key: string, sanitizeMs: number, initial: Partial<FormValues> = {}) {
  let values!: FormValues
  let defaults!: ReturnType<typeof createDefaultEquipment>
  let api!: ReturnType<typeof useFormDraft<{ values: FormValues }>>
  const app = createApp(defineComponent({
    setup() {
      values = reactive({ ...blankValues(), ...initial })
      defaults = createDefaultEquipment({ enabled: true, values })
      api = useFormDraft<{ values: FormValues }>(key, {
        read: () => ({ values: { ...values } }),
        restore: (data) => {
          defaults.draftRestored()
          Object.assign(values, data.values)
        },
        sanitize: async (data) => {
          await wait(sanitizeMs)
          return data
        },
      })
      return () => null
    },
  }))
  app.mount(node())
  return { app, values: () => values, defaults: () => defaults, api: () => api }
}

// 暫存裡：磨豆機選了不是常用的那一台，濾杯當時沒選
const DRAFT: FormValues = { ...blankValues(), bean_id: 'bean-1', grinder_id: 'g-other' }
const MINUTE = 60 * 1000

export default async function run() {
  const r = createReport('新增紀錄時帶入常用器材')

  r.section('空白新增')
  r.check(same(equipmentOf(opened(true)), ALL_DEFAULTS), '五類的常用器材都帶入')

  r.section('指定豆子新增（?bean=）')
  const bean = opened(true, { bean_id: 'bean-1' })
  r.check(same(equipmentOf(bean), ALL_DEFAULTS), '常用器材帶入——初始值裡有豆子不影響')
  r.check(bean.bean_id === 'bean-1', '豆子已選定')

  r.section('複製（?copy=）')
  // 來源那一筆用的是另一台磨豆機，沒有記濾杯
  const copy = opened(false, { bean_id: 'bean-1', grinder_id: 'g-other' })
  r.check(copy.grinder_id === 'g-other', '磨豆機沿用來源那一筆，不被常用的那台換掉')
  r.check(copy.dripper_id === null && copy.kettle_id === null && copy.filter_id === null && copy.server_id === null,
    '來源沒填的器材維持沒填，不補上常用器材')

  r.section('編輯')
  const edit = opened(false, { bean_id: 'bean-1', grinder_id: 'g-other' })
  r.check(same(equipmentOf(edit), { ...equipmentOf(blankValues()), grinder_id: 'g-other' }), '不填入常用器材')

  r.section('帶入的規則')
  r.check(same(defaultEquipmentPatch(equipmentOf(blankValues()), equipment), ALL_DEFAULTS), '每一類帶入標成常用的那一台')
  r.check(same(defaultEquipmentPatch({ ...equipmentOf(blankValues()), grinder_id: 'g-other' }, equipment).grinder_id, undefined),
    '已經有值的欄位不動')
  r.check(same(defaultEquipmentPatch(equipmentOf(blankValues()), equipment.filter(item => item.type !== 'kettle')).kettle_id, undefined),
    '沒有常用器材的類型不帶入')
  r.check(same(defaultEquipmentPatch(equipmentOf(blankValues()), []), {}), '一台器材都沒有：什麼都不帶入，也不出錯')

  r.section('有暫存還原時：器材清單先到')
  storage.setItem('test:equipment-first', draft.packDraft({ values: DRAFT }))
  const first = mountForm('test:equipment-first', 40, { bean_id: 'bean-1' })
  await nextTick()
  first.defaults().apply(equipment)
  r.check(first.values().grinder_id === 'g-default', '前提：暫存還沒寫回之前，常用器材已經帶入')
  await wait(80)
  r.check(first.api().recovered.value === true, '前提：暫存已經還原')
  r.check(first.values().grinder_id === 'g-other', '磨豆機是暫存裡選的那一台')
  r.check(first.values().dripper_id === null, '暫存裡沒選的濾杯維持沒選')
  first.api().clear()
  first.app.unmount()

  r.section('有暫存還原時：暫存先到')
  storage.setItem('test:draft-first', draft.packDraft({ values: DRAFT }))
  const second = mountForm('test:draft-first', 0, { bean_id: 'bean-1' })
  await wait(20)
  r.check(second.api().recovered.value === true, '前提：器材清單回來之前，暫存已經還原')
  second.defaults().apply(equipment)
  r.check(second.values().grinder_id === 'g-other', '磨豆機是暫存裡選的那一台')
  r.check(second.values().dripper_id === null && second.values().kettle_id === null, '暫存裡沒選的欄位不被常用器材補上')
  second.api().clear()
  second.app.unmount()

  r.section('隔了一段時間的暫存（先問再還原）')
  storage.setItem('test:stale-accept', draft.packDraft({ values: DRAFT }, Date.now() - 31 * MINUTE))
  const accept = mountForm('test:stale-accept', 0, { bean_id: 'bean-1' })
  await nextTick()
  accept.defaults().apply(equipment)
  r.check(accept.api().pending.value !== null && accept.values().grinder_id === 'g-default',
    '前提：還在問的時候，背後的表單已經帶入常用器材')
  await accept.api().accept()
  r.check(accept.values().grinder_id === 'g-other' && accept.values().dripper_id === null, '繼續填寫：以暫存內容為準')
  accept.api().clear()
  accept.app.unmount()

  storage.setItem('test:stale-discard', draft.packDraft({ values: DRAFT }, Date.now() - 31 * MINUTE))
  const discard = mountForm('test:stale-discard', 0, { bean_id: 'bean-1' })
  await nextTick()
  discard.defaults().apply(equipment)
  discard.api().discard()
  r.check(same(equipmentOf(discard.values()), ALL_DEFAULTS), '重新開始：常用器材留著')
  discard.api().clear()
  discard.app.unmount()

  r.section('沒有暫存')
  const fresh = mountForm('test:no-draft', 0, { bean_id: 'bean-1' })
  await nextTick()
  fresh.defaults().apply(equipment)
  r.check(same(equipmentOf(fresh.values()), ALL_DEFAULTS), '照常帶入')
  fresh.api().clear()
  fresh.app.unmount()

  return r.finish()
}
