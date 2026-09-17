// 沖煮表單的模板重算走 watchTemplateTriggers，暫存還原與全部清除包在 writeBack 裡（結構檢查）。
//
// 直接對 values.brew_method_id／values.dose 開 watch，就又分不出是誰改的——
// 全部清除會把複製來源的實際分段換成模板（規則見 utils/templateTrigger.ts）。

import { readFileSync } from 'node:fs'
import { createReport } from '../helpers/report.mjs'

const form = readFileSync(new URL('../../components/BrewForm.vue', import.meta.url), 'utf8')

export default function run() {
  const r = createReport('模板重算的接線')

  r.check(/watchTemplateTriggers\(/.test(form), 'BrewForm 用 watchTemplateTriggers')
  r.check(!/watch\(\s*\(\)\s*=>\s*values\.(brew_method_id|dose)/.test(form), '沒有直接 watch 手法或粉重')
  r.check(/restore:\s*data\s*=>\s*writeBack\(/.test(form), '暫存還原包在 writeBack 裡')
  r.check(/reset:\s*\(\)\s*=>\s*writeBack\(/.test(form), '全部清除包在 writeBack 裡')

  return r.finish()
}
