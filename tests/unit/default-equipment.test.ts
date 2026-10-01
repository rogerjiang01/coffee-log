// 新增紀錄時帶入常用器材（《02》§5、utils/defaultEquipment.ts）。
//
// 回歸的情境（2026-10-01）：指定豆子新增（/brews/new?bean=…）時五個器材欄位都是空的。
// 表單原本用「有沒有收到初始值」判斷要不要帶入，而這個入口的初始值裡有豆子。
// 首頁的浮動新增按鈕在只有一支未喝完的豆子時走的就是這個入口。
//
// 暫存那幾段掛的是真的 useFormDraft（做法同 form-draft-unmount.test.ts）：
// 器材清單與暫存還原都是非同步的，兩種先後順序都要是「以暫存內容為準」。
// 表單怎麼把這些接起來，由 default-equipment-wiring.test.mjs 檢查。
//
// **帶入的常用器材屬於初始狀態，不算使用者的改動**（《03》§4.11，2026-10-01）。
// 回歸的情境：有常用器材的人打開新增紀錄，什麼都沒動，儲存按鈕下方就出現「已暫存」，
// 30 分鐘內再進來還會看到「未儲存的內容已恢復」；「全部清除」則連常用器材一起清掉。

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

type FormValues = EquipmentFields & { bean_id: string | null, dose: number | null }
const blankValues = (): FormValues => ({
  bean_id: null, dose: null, grinder_id: null, dripper_id: null, kettle_id: null, filter_id: null, server_id: null,
})
const equipmentOf = (values: FormValues) => {
  const { bean_id: _, dose: __, ...rest } = values
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
 * 與 BrewForm 相同的接法（default-equipment-wiring.test.mjs 檢查表單真的是這樣接的）：
 *   initial  初始狀態每次現算：頁面給的初始值加上帶入的常用器材
 *   restore  暫存還原時先告訴 createDefaultEquipment，再把整份寫回表單
 *   reset    全部清除退回初始狀態（含常用器材）
 * sanitizeMs 模擬還原前的參照檢查（一趟網路來回）要多久
 */
function mountForm(key: string, options: { initial?: Partial<FormValues>, enabled?: boolean, sanitizeMs?: number } = {}) {
  const base = { ...blankValues(), ...options.initial }
  let values!: FormValues
  let defaults!: ReturnType<typeof createDefaultEquipment>
  let api!: ReturnType<typeof useFormDraft<{ values: FormValues }>>
  const app = createApp(defineComponent({
    setup() {
      values = reactive({ ...base })
      defaults = createDefaultEquipment({ enabled: options.enabled ?? true, values })
      const initialValues = () => defaults.initialFields({ ...base })
      api = useFormDraft<{ values: FormValues }>(key, {
        read: () => ({ values: { ...values } }),
        initial: () => ({ values: initialValues() }),
        restore: (data) => {
          defaults.draftRestored()
          Object.assign(values, data.values)
        },
        reset: () => {
          Object.assign(values, initialValues())
          defaults.reset()
        },
        sanitize: async (data) => {
          await wait(options.sanitizeMs ?? 0)
          return data
        },
      })
      return () => null
    },
  }))
  app.mount(node())
  return { app, values: () => values, defaults: () => defaults, api: () => api }
}

const stored = (key: string) => draft.unpackDraft<{ values: FormValues }>(storage.getItem(key))
/** 比暫存的延遲寫入（500ms）久一點 */
const afterWrite = () => wait(draft.DRAFT_WRITE_DELAY_MS + 80)

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
  const first = mountForm('test:equipment-first', { initial: { bean_id: 'bean-1' }, sanitizeMs: 40 })
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
  const second = mountForm('test:draft-first', { initial: { bean_id: 'bean-1' } })
  await wait(20)
  r.check(second.api().recovered.value === true, '前提：器材清單回來之前，暫存已經還原')
  second.defaults().apply(equipment)
  r.check(second.values().grinder_id === 'g-other', '磨豆機是暫存裡選的那一台')
  r.check(second.values().dripper_id === null && second.values().kettle_id === null, '暫存裡沒選的欄位不被常用器材補上')
  second.api().clear()
  second.app.unmount()

  r.section('隔了一段時間的暫存（先問再還原）')
  storage.setItem('test:stale-accept', draft.packDraft({ values: DRAFT }, Date.now() - 31 * MINUTE))
  const accept = mountForm('test:stale-accept', { initial: { bean_id: 'bean-1' } })
  await nextTick()
  accept.defaults().apply(equipment)
  r.check(accept.api().pending.value !== null && accept.values().grinder_id === 'g-default',
    '前提：還在問的時候，背後的表單已經帶入常用器材')
  await accept.api().accept()
  r.check(accept.values().grinder_id === 'g-other' && accept.values().dripper_id === null, '繼續填寫：以暫存內容為準')
  accept.api().clear()
  accept.app.unmount()

  storage.setItem('test:stale-discard', draft.packDraft({ values: DRAFT }, Date.now() - 31 * MINUTE))
  const discard = mountForm('test:stale-discard', { initial: { bean_id: 'bean-1' } })
  await nextTick()
  discard.defaults().apply(equipment)
  discard.api().discard()
  r.check(same(equipmentOf(discard.values()), ALL_DEFAULTS), '重新開始：常用器材留著')
  discard.api().clear()
  discard.app.unmount()

  r.section('沒有暫存')
  const fresh = mountForm('test:no-draft', { initial: { bean_id: 'bean-1' } })
  await nextTick()
  fresh.defaults().apply(equipment)
  r.check(same(equipmentOf(fresh.values()), ALL_DEFAULTS), '照常帶入')
  fresh.api().clear()
  fresh.app.unmount()

  // ── 帶入的常用器材屬於初始狀態（《03》§4.11）────────────────────

  r.section('只有帶入的常用器材：沒動過的表單')
  for (const [label, initial] of [['空白新增', {}], ['指定豆子新增', { bean_id: 'bean-1' }]] as const) {
    const key = `test:untouched:${label}`
    const untouched = mountForm(key, { initial })
    await nextTick()
    untouched.defaults().apply(equipment)
    r.check(same(equipmentOf(untouched.values()), ALL_DEFAULTS), `${label}：前提：常用器材已經帶入`)
    await afterWrite()
    r.check(stored(key) === null, `${label}：不寫入暫存`)
    r.check(untouched.api().status.value === null, `${label}：不顯示「暫存中／已暫存」`)
    untouched.app.unmount()
    r.check(stored(key) === null, `${label}：離開表單時也不寫入`)
    const again = mountForm(key, { initial })
    await wait(20)
    r.check(again.api().recovered.value === false && again.api().pending.value === null,
      `${label}：下次進來沒有還原橫幅，也沒有暫存詢問`)
    again.app.unmount()
  }

  r.section('帶入之後改了東西：照常寫入暫存')
  const edited = mountForm('test:edited', { initial: { bean_id: 'bean-1' } })
  await nextTick()
  edited.defaults().apply(equipment)
  await nextTick()
  edited.values().dose = 15
  await afterWrite()
  r.check(stored('test:edited')?.values.dose === 15, '改動進了暫存')
  r.check(stored('test:edited')?.values.grinder_id === 'g-default', '帶入的常用器材跟著一起存')
  r.check(edited.api().status.value === 'saved', '顯示「已暫存」')
  edited.api().clear()
  edited.app.unmount()

  r.section('全部清除：退回這個入口的初始狀態，包含常用器材')
  storage.setItem('test:clear-all', draft.packDraft({ values: { ...DRAFT, dose: 18 } }))
  const cleared = mountForm('test:clear-all', { initial: { bean_id: 'bean-1' } })
  await wait(20)
  cleared.defaults().apply(equipment)
  r.check(cleared.api().recovered.value === true && cleared.values().grinder_id === 'g-other' && cleared.values().dose === 18,
    '前提：暫存已經還原，磨豆機是暫存裡那一台')
  cleared.api().clearAll()
  r.check(same(equipmentOf(cleared.values()), ALL_DEFAULTS), '五類的常用器材都回來了')
  r.check(cleared.values().bean_id === 'bean-1' && cleared.values().dose === null, '其餘欄位退回頁面給的初始值')
  r.check(stored('test:clear-all') === null, '暫存已經清掉')
  await afterWrite()
  r.check(stored('test:clear-all') === null && cleared.api().status.value === null, '清完之後是沒動過的表單：不會又被寫成暫存')
  cleared.app.unmount()

  // 全部清除按得比器材清單回來還早
  storage.setItem('test:clear-early', draft.packDraft({ values: DRAFT }))
  const early = mountForm('test:clear-early', { initial: { bean_id: 'bean-1' } })
  await wait(20)
  early.api().clearAll()
  r.check(early.values().grinder_id === null, '前提：器材清單還沒讀到，清完先是空的')
  early.defaults().apply(equipment)
  r.check(same(equipmentOf(early.values()), ALL_DEFAULTS), '器材清單讀到之後照常帶入')
  await afterWrite()
  r.check(stored('test:clear-early') === null, '這時也還是沒動過的表單')
  early.app.unmount()

  r.section('常用器材讀到之前，使用者已經選了磨豆機')
  const picked = mountForm('test:picked-first', { initial: { bean_id: 'bean-1' } })
  await nextTick()
  picked.values().grinder_id = 'g-other'
  await nextTick()
  picked.defaults().apply(equipment)
  r.check(picked.values().grinder_id === 'g-other', '他選的那一台不被常用器材覆蓋')
  r.check(same(equipmentOf(picked.values()), { ...ALL_DEFAULTS, grinder_id: 'g-other' }), '其餘還空著的欄位照常帶入')
  await afterWrite()
  r.check(stored('test:picked-first')?.values.grinder_id === 'g-other', '這是使用者的改動：寫入暫存')
  picked.api().clear()
  picked.app.unmount()

  r.section('複製與編輯：行為不變')
  const source = { bean_id: 'bean-1', dose: 15, grinder_id: 'g-other' }
  const copied = mountForm('test:copy', { initial: source, enabled: false })
  await nextTick()
  copied.defaults().apply(equipment)
  r.check(same(equipmentOf(copied.values()), { ...equipmentOf(blankValues()), grinder_id: 'g-other' }), '不帶入常用器材')
  await afterWrite()
  r.check(stored('test:copy') === null && copied.api().status.value === null, '沒動過不寫入暫存')
  copied.values().dose = 16
  await afterWrite()
  r.check(stored('test:copy')?.values.dose === 16, '改了才寫入')
  copied.api().clearAll()
  r.check(copied.values().dose === 15 && copied.values().grinder_id === 'g-other' && copied.values().dripper_id === null,
    '全部清除退回來源那一筆的值，不補上常用器材')
  copied.app.unmount()

  r.section('初始狀態怎麼算')
  const probe = blankValues()
  const control = createDefaultEquipment({ enabled: true, values: probe })
  r.check(same(control.initialFields(blankValues()), blankValues()), '器材清單讀到之前：就是頁面給的初始值')
  control.apply(equipment)
  const given = { ...blankValues(), bean_id: 'bean-1' }
  r.check(same(equipmentOf(control.initialFields(given)), ALL_DEFAULTS), '讀到之後：加上常用器材')
  r.check(given.grinder_id === null, '不改動傳進來的那一份')
  const off = createDefaultEquipment({ enabled: false, values: blankValues() })
  off.apply(equipment)
  r.check(same(off.initialFields(blankValues()), blankValues()), '不帶入的表單（複製、編輯）：初始狀態不含常用器材')

  return r.finish()
}
