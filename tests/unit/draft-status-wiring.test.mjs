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
  r.check(/var\(--text-muted\)/.test(component) && /text-sm/.test(component), '--text-sm、--text-muted')
  r.check(!/justify-center/.test(component), '置左：置中會讓它看起來像一個獨立的區塊')
  r.check(/v-if="status"/.test(component), '沒有狀態時不顯示')

  for (const form of ['components/BrewForm.vue', 'components/BeanForm.vue', 'components/EquipmentForm.vue']) {
    const text = read(form)
    const submit = text.search(/type="submit"/)
    const status = text.search(/<DraftStatus/)
    r.check(status > submit && submit > 0, `${form}：狀態指示在儲存按鈕下方`)
    r.check(status > text.search(/<DraftBanner/), `${form}：不在頂部`)
  }

  const composable = read('composables/useFormDraft.ts')
  r.check(/createDraftWriter/.test(composable), 'useFormDraft 的寫入走 createDraftWriter，狀態跟著真實寫入')

  const newPage = read('pages/brews/new.vue')
  r.check(/newBrewDraftKey\(/.test(newPage) && /:draft-key="draftKey"/.test(newPage),
    '新增沖煮紀錄的暫存 key 依進入方式分開（複製 A 的暫存不會還原進複製 B）')
  r.check(!/draft-key="draft:brew:new"/.test(newPage), '不再寫死 draft:brew:new')

  return r.finish()
}
