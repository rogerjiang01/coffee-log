// 照片暫存的接線（結構檢查）。
//
// 儲存層與 useInlineDraft 的行為在 draft-photos.test.ts、inline-draft.test.ts 驗過；
// 這裡守住元件有沒有接上。接線斷掉時不會報錯，只會在分頁被回收之後
// 發現照片又不見了。

import { readFileSync } from 'node:fs'
import { createReport } from '../helpers/report.mjs'

const root = new URL('../../', import.meta.url)
const read = path => readFileSync(new URL(path, root), 'utf8')

export default function run() {
  const r = createReport('照片暫存的接線')

  r.section('豆子表單（draft:bean:new、draft:bean:{id}）')
  const form = read('components/BeanForm.vue')
  r.check(/read: \(\) => \(\{ \.\.\.values, photo: photo\.value !== null \}\)/.test(form),
    '文字暫存帶「有照片」標記——只選了照片、還沒打字的表單也會被暫存')
  r.check(/draftPhotos\.load\(/.test(form) && /PHOTO_NOT_RESTORED/.test(form),
    '還原時從 IndexedDB 讀回照片；讀不回來就說明，其他欄位照常還原')
  r.check(/watch\(photo,[\s\S]*?draftPhotos\.save\(storageKey, value\)[\s\S]*?draftPhotos\.remove\(storageKey\)/.test(form),
    '選照片、換照片、移除照片都立刻寫進 IndexedDB')
  r.check(/onClear: \(\) => \{[\s\S]*?draftPhotos\.remove\(storageKey\)/.test(form),
    '儲存成功、重新開始、全部清除都會刪掉照片')
  r.check(/options\.onClear\?\.\(\)/.test(read('composables/useFormDraft.ts')),
    'useFormDraft 清暫存時會通知呼叫端——照片不在 localStorage，它自己清不到')

  r.section('就地新增（draft:bean:inline）')
  const select = read('components/BeanSelect.vue')
  r.check(/useInlineDraft<BeanInlineDraft>\([\s\S]*?key: 'draft:bean:inline',\s*photoField: 'photo'/.test(select),
    '就地新增的豆子持久化在 draft:bean:inline')
  r.check(/inlineDraft\.restore\(\)/.test(select) && /PHOTO_NOT_RESTORED/.test(select),
    '掛載時從持久層還原；照片讀不回來就說明')
  const cancel = (select.match(/function cancelCreate\(\) \{[\s\S]*?\n}/) || [''])[0]
  r.check(/inlineDraft\.clear\(\)/.test(cancel), '按取消會清掉兩層——與既有的取消語意一致')

  r.section('範圍')
  r.check(/useInlineDraft<EquipmentInlineDraft>\(`equipment:\$\{props\.type\}`, emptyDraft\)/.test(read('components/EquipmentPicker.vue')),
    '器材的就地新增沒有持久化——這一條沒有要求')

  return r.finish()
}
