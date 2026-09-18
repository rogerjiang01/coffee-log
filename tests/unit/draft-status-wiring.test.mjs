// 暫存狀態指示的接線與外觀規則（結構檢查，《03》§4.11）。

import { readFileSync } from 'node:fs'
import { createReport } from '../helpers/report.mjs'

const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')

export default function run() {
  const r = createReport('暫存狀態指示的接線')

  const component = read('components/DraftStatus.vue')
  r.check(/暫存中/.test(component) && /已暫存/.test(component), '文案是「暫存中」「已暫存」')
  r.check(!/儲存/.test(component.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\/.*$/gm, '')),
    '不用「儲存」——那是按鈕寫進資料庫的動作')
  r.check(!/animate-|@keyframes|animation/.test(component), '沒有旋轉或其他動畫（《03》§6）')
  r.check(/var\(--text-muted\)/.test(component) && /text-xs/.test(component), '小字、--text-muted')
  r.check(/v-if="status"/.test(component), '沒有狀態時不顯示')

  for (const form of ['components/BrewForm.vue', 'components/BeanForm.vue']) {
    const text = read(form)
    const submit = text.search(/type="submit"/)
    const status = text.search(/<DraftStatus/)
    r.check(status > submit && submit > 0, `${form}：狀態指示在儲存按鈕下方`)
    r.check(status > text.search(/<DraftBanner/), `${form}：不在頂部`)
  }

  const composable = read('composables/useFormDraft.ts')
  r.check(/createDraftWriter/.test(composable), 'useFormDraft 的寫入走 createDraftWriter，狀態跟著真實寫入')

  return r.finish()
}
