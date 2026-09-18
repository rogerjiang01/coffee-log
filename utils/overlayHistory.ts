// 浮層（器材選擇器、裁切介面、下拉、對話框）與瀏覽器返回鍵（《03》§3）。
//
// 浮層不是路由，原本不佔 history：開著選擇器按返回鍵，離開的是整個表單。
// 手機使用者的第一反應就是按返回，所以開啟時推一筆 history，返回鍵只關浮層。
//
// 難的是另外三條關閉路徑——點「取消」、點外面、Esc——也都要把那一筆拿掉，
// 否則之後按返回會停在一筆沒有浮層的「空」紀錄上，要按兩次才離開。
//
//   使用者按返回    popstate → 關掉比目前紀錄更深的浮層
//   介面關閉        自己退回去；退的時候不讓路由器跟著導覽（go(-n, false)）
//   元件被卸載      同上
//   要去別的頁面    先把還開著的浮層退掉、等退完，再讓導覽進行
//
// 最後一條不可省略：history.back() 是非同步的。「確認刪除 → 關掉對話框 →
// 導向首頁」這種流程，若不等退完就 push 新頁面，稍後才到的後退會把使用者
// 從首頁拉回來。
//
// 這裡不碰 window 與路由器，全部由呼叫端注入，才能在 Node 裡測。

/** 寫在浮層那一筆 history.state 上：這一筆是第幾層浮層 */
export const OVERLAY_STATE_KEY = '__overlay'

export interface OverlayHistoryEnv {
  /** 目前這一筆的 history.state */
  state: () => unknown
  /** 推一筆同網址的紀錄 */
  push: (state: Record<string, unknown>) => void
  /** 改寫目前這一筆的 state */
  replace: (state: Record<string, unknown>) => void
  /** 退 n 筆，不觸發路由器的導覽 */
  back: (steps: number) => void
  /** 訂閱 popstate */
  onPop: (listener: () => void) => void
}

function depthOf(state: unknown): number {
  const value = (state as Record<string, unknown> | null)?.[OVERLAY_STATE_KEY]
  return typeof value === 'number' ? value : 0
}

export function createOverlayHistory(env: OverlayHistoryEnv) {
  const stack: { id: number, close: () => void }[] = []
  let nextId = 1
  /**
   * 退完之後 history 會停在第幾層。
   * **不能每次去讀 history.state**：後退是非同步的，退到一半時 state 還是舊的，
   * 連續關兩層（先關上層、再關下層）會算成多退一次，把使用者退出這一頁。
   */
  let historyDepth = 0
  /** 自己發出、還沒收到 popstate 的後退 */
  let expectedPops = 0
  let settle: (() => void) | null = null
  let settled: Promise<void> = Promise.resolve()

  // 重新整理時停在浮層那一筆：浮層已經不在了，標記也拿掉，
  // 否則層數從 1 起算，之後每一次關閉都會少退一筆
  if (depthOf(env.state()) > 0) {
    const { [OVERLAY_STATE_KEY]: _, ...rest } = env.state() as Record<string, unknown>
    env.replace(rest)
  }

  function retreat(steps: number) {
    if (steps <= 0) return
    if (expectedPops === 0) settled = new Promise(resolve => (settle = resolve))
    expectedPops++
    historyDepth -= steps
    env.back(steps)
  }

  env.onPop(() => {
    if (expectedPops > 0) {
      expectedPops--
      if (expectedPops === 0) {
        settle?.()
        settle = null
      }
      return
    }
    // 使用者按了返回（或前進）
    historyDepth = depthOf(env.state())
    while (stack.length > historyDepth) stack.pop()!.close()
    // 前進到一筆早就關掉的浮層紀錄：那一筆已經沒有東西，退回去
    if (historyDepth > stack.length) retreat(historyDepth - stack.length)
  })

  return {
    /** 浮層打開。close 是返回鍵（或導覽）要關掉它時呼叫的 */
    open(close: () => void): number {
      const id = nextId++
      stack.push({ id, close })
      const state = (env.state() as Record<string, unknown> | null) ?? {}
      historyDepth = stack.length
      env.push({ ...state, [OVERLAY_STATE_KEY]: historyDepth })
      return id
    },

    /**
     * 浮層被介面關掉（取消、點外面、Esc、卸載）。
     * 疊在它上面的浮層一起關，並退回它打開之前的那一筆。
     */
    dismiss(id: number) {
      const index = stack.findIndex(entry => entry.id === id)
      if (index < 0) return
      const above = stack.splice(index).slice(1).reverse()
      for (const entry of above) entry.close()
      retreat(historyDepth - index)
    },

    /**
     * 要導向別的頁面之前：還開著的浮層全部關掉並退掉，等退完才繼續。
     *
     * 呼叫端要跳過同網址的導覽——那是返回鍵在關浮層，由 popstate 處理。
     * 從瀏覽器的歷史選單直接跳到別頁也是 popstate：那時 history 已經離開
     * 浮層那一筆了，只關浮層、不再往回退，否則會多退一頁。
     */
    async beforeNavigate() {
      if (stack.length) {
        const open = stack.splice(0).reverse()
        for (const entry of open) entry.close()
        if (depthOf(env.state()) > 0) retreat(historyDepth)
        else historyDepth = 0
      }
      await settled
    },

    /** 目前開著幾層，測試用 */
    get size() {
      return stack.length
    },
  }
}

export type OverlayHistory = ReturnType<typeof createOverlayHistory>
