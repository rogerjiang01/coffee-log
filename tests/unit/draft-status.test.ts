// 暫存狀態指示（《03》§4.11）：狀態跟著真實的寫入走。
//
// 使用者從來不知道系統在幫他存，所以下次看到還原提示會覺得唐突。
// 指示要誠實：持續輸入時停在「暫存中」，停下來寫完才是「已暫存」；
// 寫不進去就不能說已暫存。

import { createDraftWriter, DRAFT_WRITE_DELAY_MS, type DraftSaveStatus } from '../../utils/draft.ts'
import { createReport } from '../helpers/report.mjs'

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

function setup(write: (value: string) => boolean = () => true) {
  const history: DraftSaveStatus[] = []
  const written: string[] = []
  const writer = createDraftWriter<string>({
    write: (value) => { written.push(value); return write(value) },
    onStatus: status => history.push(status),
    delayMs: 20,
  })
  return { writer, history, written, last: () => history.at(-1) ?? null }
}

export default async function run() {
  const r = createReport('暫存狀態指示')

  r.check(DRAFT_WRITE_DELAY_MS === 500, '寫入延遲維持 500ms')

  r.section('第一次變動之前不顯示')
  const idle = setup()
  r.check(idle.last() === null && idle.history.length === 0, '沒有變動就沒有狀態')

  r.section('輸入 → 暫存中 → 已暫存')
  const one = setup()
  one.writer.schedule('a')
  r.check(one.last() === 'saving', '變動當下就是「暫存中」')
  await wait(40)
  r.check(one.last() === 'saved' && one.written.join() === 'a', '停下來寫入完成後是「已暫存」')

  r.section('持續輸入時停在暫存中')
  const typing = setup()
  typing.writer.schedule('a')
  await wait(10)
  typing.writer.schedule('ab')
  await wait(10)
  typing.writer.schedule('abc')
  await wait(10)
  r.check(typing.last() === 'saving' && typing.written.length === 0, '每次變動重新計時，還沒寫入')
  r.check(!typing.history.includes('saved'), '中途沒有閃成「已暫存」')
  await wait(40)
  r.check(typing.written.join() === 'abc' && typing.last() === 'saved', '停下來只寫最後一次的內容')

  r.section('寫不進去不能說已暫存')
  const failing = setup(() => false)
  failing.writer.schedule('a')
  await wait(40)
  r.check(failing.last() === null, '私密瀏覽／容量已滿：狀態收起來')

  r.section('清掉暫存')
  const cleared = setup()
  cleared.writer.schedule('a')
  cleared.writer.cancel()
  await wait(40)
  r.check(cleared.last() === null && cleared.written.length === 0, '全部清除、儲存成功：不再寫入，狀態收起來')

  return r.finish()
}
