// 就地新增介面的暫存。
//
// 心智錯位：在沖煮表單裡點「新增豆子」，那個動作對系統是「建立一個豆子
// 物件」，對使用者是「填豆子這一格」。他填完直覺就是回到主表單繼續，
// 不會想到還要按一次儲存——於是關掉，內容全沒了。
//
// **解法是關掉時把內容留著，不加提示。** 不用對話框問「要放棄嗎」：
// 那等於把系統的心智模型推回給使用者，而且與全站「不用對話框打斷」
// 的原則衝突。下次打開新增介面時剛才填的還在，他自然會繼續。
//
// **兩層：記憶體，加上選用的持久層。**
// 記憶體那層處理「剛才那幾秒」：關掉再打開，同步讀取、不必等。
// 持久層（豆子的就地新增才有）處理分頁被回收：豆名進 localStorage、
// 照片進 IndexedDB，key 是 draft:bean:inline，7 天時效，與豆子表單一致。
//
// 原本只活在記憶體，是假設「暫時離開」與「session 結束」是兩件事。
// 手機的分頁回收讓這條界線消失了——使用者以為自己只是切了個 app，
// 系統卻當成重新開始。結果是最糟的組合：沖煮表單會還原（useFormDraft），
// 建到一半的豆子卻消失；他回來看到參數都在、只有豆子那格空了，
// 而他可能不記得剛才填了什麼。推翻原設計是有意識的決定（《02》§6）。
//
// 成功儲存後必須清掉，否則下次開會看到已經建好的那一筆。
//
// **「取消」與「關閉」不是同一件事。**
//   關閉（返回鍵、Esc、點外面、切走、卸載）＝「我先離開一下」→ 保留
//   取消（明確按下那顆按鈕）＝「我不要建這個了」→ 清除（兩層一起）
// 取消是使用者唯一能明確清掉內容的入口。它若也保留，使用者就沒有辦法
// 重新開始，只能一格一格刪——而畫面上並沒有其他清空的入口。
// 這與表單自動暫存的「重新開始」是同一個道理：保留是預設，
// 但一定要有一條明確的退路。

import { packDraft, unpackDraftEnvelope, type DraftEnvelope } from '../utils/draft.ts'
import { draftPhotos, type DraftPhotoStore } from '../utils/draftPhotos.ts'
import type { CompressedImage } from '../utils/image.ts'

// 模組層的 Map 在 SSR 時是跨請求共用的。這些介面只在使用者互動後出現，
// 伺服器端走不到，但仍然只在瀏覽器端寫入。
const store = new Map<string, unknown>()
/** 已經寫進 IndexedDB 的那張照片。只改豆名時不必每打一個字就重寫一張圖 */
const persistedPhotos = new Map<string, unknown>()

export interface InlineDraftPersist<T> {
  /** localStorage 與 IndexedDB 共用的 key */
  key: string
  /** 哪個欄位是照片：照片進 IndexedDB，文字暫存裡只留 true 當作「本來有照片」的標記 */
  photoField?: keyof T & string
  /** 測試時換成記憶體版 */
  photos?: DraftPhotoStore
}

export function useInlineDraft<T extends object>(
  key: string,
  empty: () => T,
  persist?: InlineDraftPersist<T>,
) {
  const photos = persist?.photos ?? draftPhotos
  const photoField = persist?.photoField

  /** 上次留下的內容；沒有就給一份空的 */
  function read(): T {
    return (store.get(key) as T | undefined) ?? empty()
  }

  /** 內容與空白無異時不留紀錄——把欄位一個個刪光，效果應該等同按取消 */
  function isEmpty(value: T) {
    const blank = empty()
    return (Object.keys(blank) as (keyof T)[]).every(field => value[field] === blank[field])
  }

  function save(value: T) {
    if (import.meta.server) return
    if (isEmpty(value)) {
      store.delete(key)
      forgetPersisted()
      return
    }
    store.set(key, { ...value })
    if (persist) writePersisted(persist.key, value)
  }

  function writePersisted(storageKey: string, value: T) {
    const photo = photoField ? (value[photoField] as unknown as CompressedImage | null) : null
    try {
      localStorage.setItem(storageKey, packDraft(photoField ? { ...value, [photoField]: photo ? true : null } : value))
    }
    catch {
      // 私密瀏覽或容量已滿。暫存是安全網，不該因為存不了就中斷填寫。
    }
    if (!photoField || persistedPhotos.get(key) === photo) return
    persistedPhotos.set(key, photo)
    if (photo) void photos.save(storageKey, photo)
    else void photos.remove(storageKey)
  }

  function forgetPersisted() {
    if (!persist) return
    persistedPhotos.delete(key)
    try {
      localStorage.removeItem(persist.key)
    }
    catch {}
    if (photoField) void photos.remove(persist.key)
  }

  /** 成功儲存後、按取消時呼叫。兩層一起清 */
  function clear() {
    store.delete(key)
    forgetPersisted()
  }

  /**
   * 分頁被回收、重新載入之後，把持久層的內容拿回來。
   * 記憶體裡還有（同一個工作階段）就不動它，回 null。
   *
   * photoLost：文字暫存說本來有照片，照片卻讀不回來（被系統清掉、私密瀏覽）。
   * 其他欄位照常還原，照片留空，由呼叫端說明——不要讓整個還原失敗。
   */
  async function restore(): Promise<{ data: T, photoLost: boolean } | null> {
    if (!persist || import.meta.server || store.has(key)) return null

    let envelope: DraftEnvelope<Record<string, unknown>> | null = null
    try {
      envelope = unpackDraftEnvelope<Record<string, unknown>>(localStorage.getItem(persist.key))
    }
    catch {}
    if (!envelope || !envelope.data || typeof envelope.data !== 'object') {
      // 文字暫存沒了（過期、壞掉、從沒存過）：照片也不會有人讀，一起清
      if (photoField) void photos.remove(persist.key)
      return null
    }

    const data = { ...empty(), ...envelope.data } as T
    let photoLost = false
    if (photoField) {
      const hadPhoto = envelope.data[photoField] === true
      const photo = hadPhoto ? await photos.load(persist.key) : null
      photoLost = hadPhoto && !photo
      ;(data as Record<string, unknown>)[photoField] = photo
      persistedPhotos.set(key, photo)
    }

    // 等 IndexedDB 的這段時間使用者可能已經開始填了——以他填的為準
    if (store.has(key)) return null
    store.set(key, { ...data })
    return { data, photoLost }
  }

  return { read, save, clear, restore }
}

/** 測試用：模擬重新載入——記憶體清空，持久層還在 */
export function __resetInlineDrafts() {
  store.clear()
  persistedPhotos.clear()
}
