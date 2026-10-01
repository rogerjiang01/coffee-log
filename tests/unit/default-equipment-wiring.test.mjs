// 帶入常用器材的接線（結構檢查）。規則本身在 default-equipment.test.ts。
//
// 那支測試只驗得到 utils/defaultEquipment.ts；哪些進入方式要帶入、
// 暫存還原時有沒有通知它，是頁面與表單怎麼接的，要看原始碼。

import { readFileSync } from 'node:fs'
import { createReport } from '../helpers/report.mjs'

const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')

export default function run() {
  const r = createReport('帶入常用器材的接線')
  const form = read('components/BrewForm.vue')
  const newPage = read('pages/brews/new.vue')
  const editPage = read('pages/brews/[id]/edit.vue')

  r.section('表單')
  r.check(/createDefaultEquipment\(\{\s*enabled:\s*props\.defaultEquipment === true,\s*values\s*\}\)/.test(form),
    '要不要帶入看 defaultEquipment 這個 prop')
  r.check(!/!props\.initial\b/.test(form), '不再用「沒有初始值」判斷——指定豆子新增有初始值，器材仍要帶入')
  r.check(/async function loadLookups\(\)[\s\S]*?defaultEquipment\.apply\(equipment\.value\)/.test(form),
    '器材清單讀到之後才帶入')
  r.check(/restore:\s*\(data\)\s*=>\s*\{[\s\S]{0,300}?defaultEquipment\.draftRestored\(\)/.test(form),
    '暫存還原時通知它：之後不再帶入')

  r.section('新增頁：空白與指定豆子帶入，複製不帶入')
  r.check(/:default-equipment="!copiedFrom"/.test(newPage), '沒有複製來源才帶入')
  r.check(/initial\.value = \{ bean_id: beanId \}/.test(newPage), '指定豆子時初始值只有豆子，器材交給表單帶入')
  // copiedFrom 只在來源讀到之後才有值；有值時表單的器材全部來自來源那一筆
  r.check(/copiedFrom\.value = copyId/.test(newPage), '複製來源讀到之後才算複製')

  r.section('編輯頁：不帶入')
  r.check(!/default-equipment/.test(editPage), '編輯頁沒有給 defaultEquipment')

  return r.finish()
}
