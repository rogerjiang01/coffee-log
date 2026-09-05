// 就地新增介面的暫存。
//
// 這件事的失效方式是「使用者填的東西不見了」——沒有錯誤、沒有 console，
// 只有下次打開時一片空白。而且它與 useFormDraft（跨天的表單暫存）
// 是兩套機制，容易被誤以為重複而拿掉其中一套。

import { useInlineDraft, __resetInlineDrafts } from '../../composables/useInlineDraft.ts'
import { createReport } from '../helpers/report.mjs'

interface BeanDraft { name: string, photo: { ext: string } | null }
const emptyBean = (): BeanDraft => ({ name: '', photo: null })

export default function run() {
  const r = createReport('就地新增的暫存')
  __resetInlineDrafts()

  r.section('關掉再打開，內容還在')
  const bean = useInlineDraft<BeanDraft>('bean', emptyBean)
  r.check(bean.read().name === '', '第一次打開是空的')

  bean.save({ name: '耶加雪菲 G1', photo: { ext: 'webp' } })
  // 關掉再打開 = 重新拿一次同一個 key
  const reopened = useInlineDraft<BeanDraft>('bean', emptyBean)
  r.check(reopened.read().name === '耶加雪菲 G1', '豆名還在')
  r.check(reopened.read().photo?.ext === 'webp', '照片也還在——它是 Blob，本來就塞不進 localStorage')

  r.section('存成功之後要清掉')
  bean.clear()
  r.check(useInlineDraft<BeanDraft>('bean', emptyBean).read().name === '',
    '不清的話下次開會看到已經建好的那一筆')

  r.section('不同器材類型各自獨立')
  // 磨豆機填到一半跑去改濾杯，兩邊不該互相蓋掉
  const grinder = useInlineDraft('equipment:grinder', () => ({ custom_name: '' }))
  const dripper = useInlineDraft('equipment:dripper', () => ({ custom_name: '' }))
  grinder.save({ custom_name: '自組磨豆機' })
  dripper.save({ custom_name: '手工陶濾杯' })
  r.check(grinder.read().custom_name === '自組磨豆機', '磨豆機那份沒被蓋掉')
  r.check(dripper.read().custom_name === '手工陶濾杯', '濾杯那份也在')
  grinder.clear()
  r.check(dripper.read().custom_name === '手工陶濾杯', '清掉磨豆機不影響濾杯')

  r.section('存進去的是副本')
  __resetInlineDrafts()
  const live = { name: '打到一半', photo: null }
  const draft = useInlineDraft<BeanDraft>('bean', emptyBean)
  draft.save(live)
  live.name = '之後又改了但沒存'
  r.check(draft.read().name === '打到一半',
    '存的是當下的副本，不是同一個物件的參照——否則清空表單會連暫存一起清掉')

  r.section('與 useFormDraft 是兩套東西')
  // 這一條是給讀程式碼的人看的：兩者都叫「暫存」但目的不同。
  // useFormDraft 管跨天的整份表單（localStorage、有效期、還原詢問），
  // 這裡管的是「剛才那幾秒」的連續性（記憶體、無聲、無提示）。
  r.check(typeof draft.read === 'function' && typeof draft.clear === 'function',
    '介面只有 read／save／clear 三個，沒有有效期也沒有還原詢問')

  return r.finish()
}
