// 換帳號資料隔離的接線（結構檢查）。
//
// 機制本身在 user-isolation.test.ts 驗過；這裡守住每一個入口都有走進那個機制。
// 漏掉一張表單不會報錯，只會讓那張表單的暫存又變回所有人共用。

import { readFileSync } from 'node:fs'
import { createReport } from '../helpers/report.mjs'

const root = new URL('../../', import.meta.url)
const read = path => readFileSync(new URL(path, root), 'utf8')

export default function run() {
  const r = createReport('資料隔離的接線')

  r.section('暫存 key 帶使用者 id')
  for (const form of ['components/BrewForm.vue', 'components/BeanForm.vue', 'components/EquipmentForm.vue']) {
    const source = read(form)
    r.check(/useScopedDraftKey\(props\.draftKey\)/.test(source) && !/useFormDraft<\w+>\(props\.draftKey/.test(source),
      `${form}：暫存 key 經過 useScopedDraftKey，不直接用頁面給的 key`)
  }
  r.check(/const storageKey = useScopedDraftKey\(props\.draftKey\)/.test(read('components/BeanForm.vue')),
    '豆子表單的照片與文字共用同一個帶使用者的 key')

  r.section('查詢快取依使用者分區')
  const plugin = read('plugins/query-cache-scope.client.ts')
  r.check(/setQueryCacheScope\(\(\) => userId\.value\)/.test(plugin) && /useCurrentUserId\(\)/.test(plugin),
    '分區接上目前使用者')
  const userId = read('composables/useCurrentUserId.ts')
  r.check(userId.indexOf('session.value') > -1 && userId.indexOf('session.value') < userId.indexOf('user.value?.sub'),
    '使用者 id 先看 session 再看 claims——claims 在換帳號後晚一趟才換，先看它會拿到上一個人')

  return r.finish()
}
