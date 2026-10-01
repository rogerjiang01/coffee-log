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

  return {
    /** 器材清單讀到之後呼叫 */
    apply(equipment: EquipmentOption[]) {
      if (!options.enabled || restored) return
      Object.assign(options.values, defaultEquipmentPatch(options.values, equipment))
    },
    /** 暫存把內容寫回表單了：之後不再帶入 */
    draftRestored() {
      restored = true
    },
  }
}
