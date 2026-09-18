// 浮層與瀏覽器返回鍵：返回鍵關浮層，其他三種關閉方式也要把那一筆退掉，
// 不能留下多餘的 history（utils/overlayHistory.ts）。
//
// 用一個模擬的 history：pushState 會截掉前進的紀錄；後退與真的瀏覽器一樣
// 是非同步的，之後才送出 popstate。

import { createOverlayHistory, OVERLAY_STATE_KEY } from '../../utils/overlayHistory.ts'
import { createReport } from '../helpers/report.mjs'

function fakeBrowser(initialState: Record<string, unknown> = { position: 0 }, before: string[] = []) {
  const entries: Record<string, unknown>[] = [...before.map(url => ({ url })), { url: '/form', ...initialState }]
  let index = before.length
  const listeners: (() => void)[] = []
  const pop = () => listeners.forEach(listener => listener())
  const browser = {
    entries,
    get index() { return index },
    get url() { return entries[index]!.url },
    /** 目前這一筆之前還有幾筆同網址的紀錄（多餘的紀錄會讓返回鍵「按了沒反應」） */
    get extra() { return entries.slice(0, index + 1).filter(entry => entry.url === '/form').length - 1 },
    env: {
      state: () => entries[index],
      push: (state: Record<string, unknown>) => {
        entries.splice(index + 1)
        entries.push({ url: entries[index]!.url, ...state })
        index++
      },
      replace: (state: Record<string, unknown>) => { entries[index] = { url: entries[index]!.url, ...state } },
      back: (steps: number) => {
        setTimeout(() => {
          index = Math.max(0, index - steps)
          pop()
        }, 1)
      },
      onPop: (listener: () => void) => { listeners.push(listener) },
    },
    /** 使用者按瀏覽器返回鍵 */
    userBack() { index--; pop() },
    userForward() { index++; pop() },
    /** 從瀏覽器的歷史選單直接跳到某一筆；popstate 由呼叫端決定何時送 */
    jumpSilently(to: number) { index = to },
    pop,
    /** 路由器 push 一個新頁面 */
    navigate(url: string) {
      entries.splice(index + 1)
      entries.push({ url })
      index++
    },
  }
  return browser
}

const tick = () => new Promise(resolve => setTimeout(resolve, 5))

function overlay(overlays: ReturnType<typeof createOverlayHistory>) {
  const state = { open: false, id: 0 }
  return {
    state,
    open() { state.open = true; state.id = overlays.open(() => { state.open = false }) },
    /** 取消、點外面、Esc、卸載：都走這條 */
    dismiss() { state.open = false; overlays.dismiss(state.id) },
  }
}

export default async function run() {
  const r = createReport('浮層與返回鍵')

  r.section('返回鍵關浮層，不離開頁面')
  {
    const b = fakeBrowser()
    const overlays = createOverlayHistory(b.env)
    const picker = overlay(overlays)
    picker.open()
    r.check(b.index === 1 && b.entries[1]![OVERLAY_STATE_KEY] === 1, '開啟時推一筆')
    b.userBack()
    r.check(!picker.state.open && overlays.size === 0, '按返回：浮層關掉')
    r.check(b.url === '/form' && b.index === 0, '還在同一頁')
  }

  r.section('取消、點外面、Esc、卸載都要把那一筆退掉')
  {
    const b = fakeBrowser()
    const overlays = createOverlayHistory(b.env)
    const dialog = overlay(overlays)
    dialog.open()
    dialog.dismiss()
    await tick()
    r.check(b.index === 0 && b.extra === 0, '沒有留下多餘的紀錄：下一次返回鍵直接離開這一頁')
    dialog.open()
    dialog.dismiss()
    dialog.open()
    dialog.dismiss()
    await tick()
    r.check(b.index === 0 && b.extra === 0, '開關很多次也一樣')
  }

  r.section('疊起來的浮層')
  {
    const b = fakeBrowser()
    const overlays = createOverlayHistory(b.env)
    const picker = overlay(overlays)
    const dropdown = overlay(overlays)
    picker.open()
    dropdown.open()
    b.userBack()
    r.check(!dropdown.state.open && picker.state.open, '返回鍵先關最上面那層')
    b.userBack()
    r.check(!picker.state.open && b.index === 0, '再按一次才關下面那層')

    picker.open()
    dropdown.open()
    picker.dismiss()
    await tick()
    r.check(!dropdown.state.open, '關掉下層時，疊在上面的一起關')
    r.check(b.index === 0 && b.extra === 0, '一次退兩筆，沒有多退也沒有少退')

    picker.open()
    dropdown.open()
    dropdown.dismiss()
    picker.dismiss() // 上一個後退還沒完成就關下一層
    await tick()
    r.check(b.index === 0 && b.extra === 0, '連續關兩層：不會因為後退還沒完成而多退，把人退出這一頁')
  }

  r.section('關掉浮層之後立刻導向別頁')
  {
    const b = fakeBrowser()
    const overlays = createOverlayHistory(b.env)
    const confirm = overlay(overlays)
    confirm.open()
    confirm.dismiss() // 確認刪除 → 對話框關掉
    await overlays.beforeNavigate() // 導覽守衛
    b.navigate('/')
    await tick()
    r.check(b.url === '/', '導覽完成後停在新頁面，沒有被遲到的後退拉回去')
    r.check(b.entries.length === 2, '新頁面前面只有原本那一頁，沒有浮層那一筆')
  }

  r.section('浮層還開著就導向別頁')
  {
    const b = fakeBrowser()
    const overlays = createOverlayHistory(b.env)
    const dropdown = overlay(overlays)
    dropdown.open()
    await overlays.beforeNavigate()
    b.navigate('/beans/1')
    r.check(!dropdown.state.open, '浮層先關掉')
    r.check(b.entries.map(entry => entry.url).join() === '/form,/beans/1', '先退掉浮層那一筆再 push，返回鍵回到原本那一頁')
  }

  r.section('從歷史選單直接跳走')
  {
    const b = fakeBrowser(undefined, ['/other'])
    const overlays = createOverlayHistory(b.env)
    const picker = overlay(overlays)
    picker.open()
    // 跳回 /other；路由器的守衛比 popstate 的處理先跑
    b.jumpSilently(0)
    await overlays.beforeNavigate()
    b.pop()
    await tick()
    r.check(!picker.state.open, '浮層關掉')
    r.check(b.index === 0 && b.url === '/other', '停在使用者選的那一頁，沒有再多退')
  }

  r.section('前進到已經關掉的浮層紀錄')
  {
    const b = fakeBrowser()
    const overlays = createOverlayHistory(b.env)
    const picker = overlay(overlays)
    picker.open()
    b.userBack()
    b.userForward()
    await tick()
    r.check(b.index === 0 && !picker.state.open, '那一筆已經沒有浮層：自動退回，不停在空紀錄上')
  }

  r.section('重新整理時停在浮層那一筆')
  {
    const b = fakeBrowser({ position: 0, [OVERLAY_STATE_KEY]: 1 })
    const overlays = createOverlayHistory(b.env)
    r.check(b.entries[0]![OVERLAY_STATE_KEY] === undefined, '標記拿掉，層數從 0 起算')
    const picker = overlay(overlays)
    picker.open()
    picker.dismiss()
    await tick()
    r.check(b.index === 0, '之後的開關照常')
  }

  r.section('路由器自己的 state 保留')
  {
    const b = fakeBrowser({ position: 7, current: '/form' })
    const overlays = createOverlayHistory(b.env)
    overlay(overlays).open()
    r.check(b.entries[1]!.position === 7 && b.entries[1]!.current === '/form', '推的那一筆帶著原本的 position，路由器算得出 delta')
  }

  return r.finish()
}
