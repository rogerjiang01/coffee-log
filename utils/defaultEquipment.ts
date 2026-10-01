// 新增紀錄時帶入常用器材（《02》§5 的進入方式表）。
//
//   空白新增、指定豆子新增   各類型的常用器材填進還空著的器材欄位
//   複製                     不帶入：器材沿用來源那一筆，來源沒填的就維持沒填
//   編輯                     不帶入：不覆蓋當初的選擇
//   暫存還原之後             不帶入：以暫存內容為準
//
// **要不要帶入由頁面明講（BrewForm 的 defaultEquipment），不看表單有沒有收到初始值。**
// 原本的判斷是「沒有初始值才帶入」：指定豆子新增時頁面傳了只有豆子的初始值，
// 表單就當成已經有內容而跳過，五個器材欄位都是空的（2026-10-01 修正）。
// 「有沒有初始值」與「器材是不是從既有紀錄來的」是兩件事，只有後者該決定這件事。
//
// 器材清單與暫存還原都是非同步的，誰先到不一定：
//   器材先到   先帶入；暫存接著把整份表單寫回，蓋掉帶入的值
//   暫存先到   記下已經還原過，器材到了也不帶入
// 兩種順序結果相同：暫存裡是什麼就是什麼，包含當時沒選的欄位。
//
// **帶入的常用器材屬於表單的初始狀態，不算使用者的改動**（《03》§4.11）。
// 使用者什麼都沒動時，表單不該被寫成暫存、也不該在下次進來時問要不要還原——
// 那是在告訴他一件不存在的事。所以「初始狀態」要把常用器材算進去（initialFields），
// 「全部清除」也是退回這個狀態（reset），不是退回沒有器材的空表單。
// 只填還空著的欄位：器材清單讀到之前使用者自己選的那一格不會被蓋掉，
// 那時表單與初始狀態不同，照常寫入暫存。

import type { BrewFormValues } from './brew.ts'
import type { EquipmentType } from './equipment.ts'

/** 沖煮表單上的五個器材欄位 */
export type EquipmentFields = Pick<
  BrewFormValues,
  'grinder_id' | 'dripper_id' | 'kettle_id' | 'filter_id' | 'server_id'
>

type EquipmentOption = { id: string, type: EquipmentType, is_default: boolean }

const FIELD_OF: Record<EquipmentType, keyof EquipmentFields> = {
  grinder: 'grinder_id',
  dripper: 'dripper_id',
  kettle: 'kettle_id',
  filter: 'filter_id',
  server: 'server_id',
}

/**
 * 各類型的常用器材要填進哪些欄位。只填還空著的，已經有值的不動；
 * 沒有常用器材的類型不出現在結果裡。
 */
export function defaultEquipmentPatch(
  values: EquipmentFields,
  equipment: EquipmentOption[],
): Partial<EquipmentFields> {
  const patch: Partial<EquipmentFields> = {}
  for (const item of equipment) {
    if (!item.is_default) continue
    const field = FIELD_OF[item.type]
    if (!values[field] && !patch[field]) patch[field] = item.id
  }
  return patch
}

export function createDefaultEquipment(options: {
  /** 這張表單要不要帶入常用器材。新增（空白、指定豆子）是 true，複製與編輯是 false */
  enabled: boolean
  /** 表單的值，就地改寫 */
  values: EquipmentFields
}) {
  let restored = false
  /** 讀到的器材清單。還沒讀到是 null */
  let known: EquipmentOption[] | null = null

  function fill() {
    if (!options.enabled || restored || !known) return
    Object.assign(options.values, defaultEquipmentPatch(options.values, known))
  }

  return {
    /** 器材清單讀到之後呼叫 */
    apply(equipment: EquipmentOption[]) {
      known = equipment
      fill()
    },
    /** 暫存把內容寫回表單了：之後不再帶入 */
    draftRestored() {
      restored = true
    },
    /**
     * 這個入口的初始狀態：頁面給的初始值，加上帶入的常用器材。
     * 器材清單還沒讀到時就是頁面給的初始值；讀到之後才知道完整的初始狀態，
     * 所以拿它判斷「有沒有動過」的地方要每次現算，不能在表單掛上時算一次就留著。
     */
    initialFields<T extends EquipmentFields>(initial: T): T {
      if (!options.enabled || !known) return initial
      return { ...initial, ...defaultEquipmentPatch(initial, known) }
    },
    /**
     * 全部清除：表單已經退回初始狀態。之後不再算「還原過」——
     * 器材清單這時還沒讀到的話，讀到之後照常帶入。
     */
    reset() {
      restored = false
      fill()
    },
  }
}
