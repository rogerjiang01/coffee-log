// 手法模板什麼時候重算分段：使用者改參數才算，程式寫回（暫存還原、全部清除）不算。
//
// 回歸的情境：複製一筆改過分段的紀錄 → 暫存裡的粉重與來源不同 → 按「全部清除」
// → 分段先退回來源的實際分段，下一個 tick 又被模板蓋掉。
// 「全部清除」是還原，不是改參數；複製之後使用者自己改粉重才是改參數，那時要重算。

import { reactive, ref, nextTick } from 'vue'
import { watchTemplateTriggers } from '../../utils/templateTrigger.ts'
import { createReport } from '../helpers/report.mjs'

/** 模擬 BrewForm：初始值是複製來源，分段是來源的實際分段（改過，與模板不同） */
function copiedForm() {
  const initial = { brew_method_id: 'four-six', dose: 20 }
  const source = ['來源：60', '來源：130', '來源：200']
  const values = reactive({ ...initial })
  const steps = ref<string[]>([...source])
  const template = () => [`模板：${values.brew_method_id}／${values.dose}g`]

  const { writeBack } = watchTemplateTriggers({
    method: () => values.brew_method_id,
    dose: () => values.dose,
    onMethodChange: () => { steps.value = template() },
    onDoseChange: () => { if (values.brew_method_id) steps.value = template() },
  })

  return {
    values,
    steps,
    source,
    restore: (draft: { values: typeof initial, steps: string[] }) => writeBack(() => {
      Object.assign(values, draft.values)
      steps.value = draft.steps
    }),
    clearAll: () => writeBack(() => {
      Object.assign(values, initial)
      steps.value = [...source]
    }),
  }
}

const draft = { values: { brew_method_id: 'four-six', dose: 18 }, steps: ['暫存：50', '暫存：110'] }

export default async function run() {
  const r = createReport('手法模板的重算時機')

  r.section('程式寫回不重算')
  const restored = copiedForm()
  restored.restore(draft)
  await nextTick()
  r.check(restored.steps.value.join() === draft.steps.join(),
    `暫存還原（粉重 20→18）保留暫存裡的分段（實際 ${restored.steps.value.join('、')}）`)

  restored.clearAll()
  await nextTick()
  r.check(restored.steps.value.join() === restored.source.join(),
    `全部清除（粉重 18→20）退回來源的實際分段，不套模板（實際 ${restored.steps.value.join('、')}）`)
  r.check(restored.values.brew_method_id === 'four-six', '全部清除後手法標籤保留')

  const methodDraft = copiedForm()
  methodDraft.restore({ values: { brew_method_id: 'rao', dose: 20 }, steps: ['暫存：rao'] })
  await nextTick()
  methodDraft.clearAll()
  await nextTick()
  r.check(methodDraft.steps.value.join() === methodDraft.source.join(),
    '暫存換過手法，全部清除時手法換回來也不套模板')

  r.section('使用者改參數才重算')
  const edited = copiedForm()
  edited.values.dose = 18
  await nextTick()
  r.check(edited.steps.value.join() === '模板：four-six／18g', '複製之後改粉重：依新粉重重算')

  const switched = copiedForm()
  switched.values.brew_method_id = 'rao'
  await nextTick()
  r.check(switched.steps.value.join() === '模板：rao／20g', '複製之後換手法：套用新手法的模板')

  const afterClear = copiedForm()
  afterClear.restore(draft)
  await nextTick()
  afterClear.clearAll()
  await nextTick()
  afterClear.values.dose = 22
  await nextTick()
  r.check(afterClear.steps.value.join() === '模板：four-six／22g', '全部清除之後再改粉重，照常重算——擋的只有寫回那一刻')

  const untouched = copiedForm()
  await nextTick()
  r.check(untouched.steps.value.join() === untouched.source.join(), '只是打開複製表單，不重算')

  return r.finish()
}
