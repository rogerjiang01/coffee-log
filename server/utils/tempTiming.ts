// TEMP-TIMING：量測分享頁照片各段的耗時（Server-Timing 標頭 ＋ 一行 log）。
// 量完之後，這個檔案與所有標著 TEMP-TIMING 的行一起移除。

import type { H3Event } from 'h3'

/** 這個 function 實例是不是剛冷啟動（模組第一次被執行後的第一個請求） */
let freshInstance = true
const instanceStartedAt = Date.now()
/** Vercel 注入的執行區域（例如 iad1）。專案沒有 Node 的型別，從 globalThis 取 */
const region = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.VERCEL_REGION ?? 'local'

export interface TempTiming {
  time: <T>(name: string, run: () => Promise<T>, describe?: (value: T) => string) => Promise<T>
  note: (name: string, desc: string) => void
  finish: () => void
}

export function startTiming(event: H3Event, route: string): TempTiming {
  const cold = freshInstance
  freshInstance = false
  const started = performance.now()
  const entries: string[] = []
  const log: Record<string, unknown> = { route, cold, instanceAgeMs: Date.now() - instanceStartedAt, region }

  const timing: TempTiming = {
    async time(name, run, describe) {
      const t0 = performance.now()
      try {
        const value = await run()
        const ms = performance.now() - t0
        const desc = describe?.(value)
        entries.push(`${name};dur=${ms.toFixed(1)}${desc ? `;desc="${desc}"` : ''}`)
        log[name] = desc ? `${ms.toFixed(1)}ms ${desc}` : `${ms.toFixed(1)}ms`
        return value
      }
      catch (error) {
        entries.push(`${name};dur=${(performance.now() - t0).toFixed(1)};desc="error"`)
        throw error
      }
    },
    note(name, desc) {
      entries.push(`${name};desc="${desc}"`)
      log[name] = desc
    },
    finish() {
      const total = performance.now() - started
      entries.push(`fn;dur=${total.toFixed(1)}`, `cold;desc="${cold ? 1 : 0}"`, `region;desc="${region}"`)
      log.fn = `${total.toFixed(1)}ms`
      setResponseHeader(event, 'Server-Timing', entries.join(', '))
      console.log(`[TEMP-TIMING] ${JSON.stringify(log)}`)
    },
  }
  event.context.tempTiming = timing
  return timing
}

export function currentTiming(event: H3Event): TempTiming | undefined {
  return event.context.tempTiming as TempTiming | undefined
}
