// 新增沖煮紀錄的寫入順序：先建紀錄，再寫分段（pages/brews/new.vue）。
//
// 兩步不在同一個交易裡，所以會有「紀錄建好了、分段沒寫進去」的半成功狀態。
// 使用者看到錯誤之後最自然的動作是**再按一次儲存**——這一下不能再建一筆重複的紀錄。
// 所以呼叫端要記住已經建立的那筆 id，下次傳進來：這裡就改成補寫那一筆，不再新增。
//
// 根本的解法是紀錄與分段放進同一個資料庫交易（CLAUDE.md 的暫緩清單），
// 在那之前由這裡保證「重按儲存」是安全的。
//
// 這裡不碰 Supabase，存取由呼叫端注入，才能在測試資料庫上重現「分段寫入失敗」。

export interface BrewSaveStore {
  /** 建立紀錄，回傳新的 id */
  insertBrew: (row: Record<string, unknown>) => Promise<{ id: string | null, error: unknown }>
  /** 更新既有紀錄（補寫時用：使用者可能在失敗之後又改了表單） */
  updateBrew: (id: string, row: Record<string, unknown>) => Promise<{ error: unknown }>
  /** 寫入分段。replace 為 true 時先刪掉這筆紀錄既有的分段 */
  writeSteps: (brewId: string, replace: boolean) => Promise<{ error: unknown }>
}

export type BrewSaveResult =
  | { ok: true, id: string }
  /** 紀錄本身沒有建立（或更新）成功 */
  | { ok: false, stage: 'brew', error: unknown }
  /** 紀錄在，分段沒寫進去。id 要留著，下次儲存傳回來 */
  | { ok: false, stage: 'steps', id: string, error: unknown }

/**
 * 只在建立時寫入的欄位（《01》§9）：耗時是「第一次存下來花了多久」，
 * 補寫分段時不能被第二次按儲存的秒數蓋掉。
 */
const CREATE_ONLY = ['user_id', 'copied_from_brew_id', 'form_duration_seconds', 'params_duration_seconds', 'tasting_duration_seconds']

/**
 * @param pendingId 上一次儲存建好了紀錄、但分段失敗時留下的 id；沒有就是 null
 */
export async function saveNewBrew(
  store: BrewSaveStore,
  pendingId: string | null,
  row: Record<string, unknown>,
): Promise<BrewSaveResult> {
  let id = pendingId

  if (id) {
    const update = Object.fromEntries(Object.entries(row).filter(([key]) => !CREATE_ONLY.includes(key)))
    const { error } = await store.updateBrew(id, update)
    if (error) return { ok: false, stage: 'brew', error }
  }
  else {
    const { id: created, error } = await store.insertBrew(row)
    if (error || !created) return { ok: false, stage: 'brew', error }
    id = created
  }

  // 補寫時先清掉：上一次可能寫進了一部分
  const { error: stepError } = await store.writeSteps(id, pendingId !== null)
  if (stepError) return { ok: false, stage: 'steps', id, error: stepError }

  return { ok: true, id }
}
