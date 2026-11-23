// 表單的列高兩級（《03》§4.1，2026-11-23，取代原本一律 65px）。
//   56px（--sheet-row-h）       沒有膠囊的列：一般輸入、開關、評分、強度、標題列、動作列、多行文字的基本高度
//   65px（--sheet-row-h-tall）  裡面有膠囊的列：下拉、器材欄位、原生的 select／日期／時刻、沖煮時間的分秒框
// 單列卡片的圓角是那一列基本高度的一半（28／32.5px），滿寬按鈕 56px。
//
// 守住的是「哪一種列對到哪一級」：新加一個有膠囊的列卻忘了 tall，畫面不會壞，只會悄悄矮 9px——
// 這種差異肉眼很難在當下發現，所以用靜態檢查擋。

import { readFileSync } from 'node:fs'
import { createReport } from '../helpers/report.mjs'

const root = new URL('../../', import.meta.url)
const read = path => readFileSync(new URL(path, root), 'utf8')

/** 從 FormRow 的開頭標籤到對應的 </FormRow>（不處理巢狀：收合區那一層是 flush，裡面的列另外檢查） */
function formRows(source) {
  const out = []
  const re = /<FormRow\b([^>]*)>([\s\S]*?)<\/FormRow>/g
  let m
  while ((m = re.exec(source))) out.push({ attrs: m[1], body: m[2] })
  return out
}

export default function run() {
  const r = createReport('列高兩級')

  r.section('token')
  const tokens = read('assets/css/tokens.css')
  r.check(tokens.includes('--sheet-row-h: 56px;'), '--sheet-row-h 是 56px（沒有膠囊的列）')
  r.check(tokens.includes('--sheet-row-h-tall: 65px;'), '--sheet-row-h-tall 是 65px（有膠囊的列）')
  r.check(tokens.includes('--radius-pill: calc(var(--sheet-row-h) / 2);'), '--radius-pill 是 56 的一半（28px）')
  r.check(tokens.includes('--radius-pill-tall: calc(var(--sheet-row-h-tall) / 2);'), '--radius-pill-tall 是 65 的一半（32.5px）')

  r.section('列的樣式')
  const css = read('assets/css/main.css')
  r.check(/\.sheet-row \{[^}]*min-height: var\(--sheet-row-h\);[^}]*padding: calc\(\(var\(--sheet-row-h\) - var\(--touch-min\)\) \/ 2\) 0;/.test(css),
    '.sheet-row：56px，上下內距 (56 − 44) / 2，44px 的控制項放進來剛好 56')
  r.check(/\.sheet-row--tall \{\s*min-height: var\(--sheet-row-h-tall\);/.test(css), '.sheet-row--tall：65px')
  const formRow = read('components/FormRow.vue')
  r.check(/tall\?: boolean/.test(formRow) && /class="sheet-row" :class="tall \? 'sheet-row--tall' : ''"/.test(formRow), 'FormRow 的 tall 換成 65px 的列')
  const flavor = read('components/FlavorTagPicker.vue')
  r.check(/\.tag-row \{[^}]*min-height: var\(--sheet-row-h-tall\);[^}]*padding-block: 14\.5px;/.test(flavor), '風味標籤的分類列：一排 65px（36px 的標籤上下各 14.5px）、多排長高')
  r.check(/\.add-row \{\s*height: var\(--sheet-row-h\);\s*min-height: var\(--sheet-row-h\);/.test(flavor), '新增風味詞（動作列、輸入列）：56px，min-height 也蓋掉 .tag-row 的 65')

  r.section('有膠囊的列是 65px')
  for (const f of ['BeanSelect', 'EquipmentTrigger', 'LookupSelect', 'CountrySelect', 'CatalogSelect'])
    r.check(/class="sheet-row sheet-row--tall"/.test(read(`components/${f}.vue`)), `${f}（自帶標籤的下拉）`)
  r.check(/<div class="sheet-row sheet-row--tall">\s*<label class="sheet-label" for="equipment-type">/.test(read('components/EquipmentForm.vue')), '器材表單的類型（SelectField）')

  // 表單裡用 FormRow 的 label、右邊放 SelectField（原生的 select、日期、時刻）或沖煮時間的分秒框的列，一律 tall
  const forms = ['components/BrewForm.vue', 'components/BeanForm.vue', 'components/EquipmentForm.vue', 'components/PourStepsSheet.vue', 'components/EquipmentPicker.vue', 'pages/beans/[id]/index.vue', 'dev/corners.vue']
  for (const path of forms) {
    for (const row of formRows(read(path))) {
      if (!/\blabel=/.test(row.attrs)) continue
      const label = row.attrs.match(/label="([^"]+)"/)?.[1]
      const hasPill = /<SelectField\b|<DurationPicker\b|<SheetPill\b/.test(row.body)
      const tall = /\btall\b/.test(row.attrs)
      r.check(hasPill === tall, `${path}「${label}」：${hasPill ? '有膠囊 → tall（65px）' : '沒有膠囊 → 56px'}`)
    }
  }

  r.section('沒有膠囊的列是 56px')
  for (const [path, label] of [
    ['components/ToggleSwitch.vue', '開關'], ['components/StarRating.vue', '評分'], ['components/GrindSettingInput.vue', '研磨刻度'],
    ['components/CollapsibleSection.vue', '收合區的標題列'], ['components/PourStepsSummary.vue', '分段摘要（標題列、編輯分段）'],
  ]) r.check(!/sheet-row--tall|--sheet-row-h-tall/.test(read(path)), label)
  r.check(/\.rating-row \{\s*min-height: var\(--sheet-row-h\);/.test(read('components/IntensityPicker.vue')), '強度的四列')
  r.check(/\.summary-title \{[^}]*min-height: var\(--sheet-row-h\);/.test(read('components/PourStepsSummary.vue')), '分段摘要的標題列')

  r.section('單列卡片的圓角跟著那一列')
  const card = read('components/FormCard.vue')
  r.check(/defineProps<\{ pill\?: boolean, tall\?: boolean \}>/.test(card) && /:radius="pill \? \(tall \? 'pill-tall' : 'pill'\) : 'lg'"/.test(card),
    'FormCard：pill 是 28px，pill ＋ tall 是 32.5px，其他 24px（lg）')
  // 每一張 <FormCard pill ...> 裡只有一列：tall 要和那一列一致（:pill 綁定的是可收合的卡片，另外檢查）
  for (const path of forms) {
    const src = read(path)
    const re = /<FormCard\b([^>]*(?<![:\w-])pill\b[^>]*)>([\s\S]*?)<\/FormCard>/g
    let m
    while ((m = re.exec(src))) {
      const cardTall = /\btall\b/.test(m[1])
      const rowTall = /<FormRow\b[^>]*\btall\b/.test(m[2]) || /sheet-row--tall/.test(m[2])
      const label = m[2].match(/label="([^"]+)"/)?.[1] ?? '（自帶標籤）'
      r.check(cardTall === rowTall, `${path}「${label}」：卡片 ${cardTall ? '32.5px' : '28px'}，那一列 ${rowTall ? '65px' : '56px'}`)
    }
  }
  r.check(/<FormCard :pill="!extraEquipmentOpen">/.test(read('components/BrewForm.vue')), '濾紙與分享壺：收合時是 56px 的標題列（28px），展開後 lg')

  r.section('滿寬按鈕 56px')
  r.check(/\.app-button--block \{[^}]*min-height: var\(--sheet-row-h\);[^}]*border-radius: var\(--radius-block-button\);/.test(read('components/AppButton.vue')), 'AppButton 的 block：56px、圓角 28px')

  r.section('登入與註冊：表單的單列卡片（2026-11-23）')
  for (const page of ['pages/login.vue', 'pages/signup.vue']) {
    const src = read(page)
    r.check(!/<TextField\b/.test(src), `${page}：不再用 TextField`)
    const cards = src.match(/<FormCard pill>/g) || []
    r.check(cards.length === 2, `${page}：電子郵件、密碼各一張單列卡片（56px、28px）`)
    r.check(/<FormRow label="電子郵件" for="email"[^>]*>\s*<SheetText\s+id="email"[\s\S]*?type="email"[\s\S]*?autocomplete="email"[\s\S]*?placeholder="輸入電子郵件"/.test(src), `${page}：電子郵件的 label、type、autocomplete、提示字`)
    r.check(/<FormRow label="密碼" for="password"[^>]*>\s*<SheetText\s+id="password"[\s\S]*?type="password"[\s\S]*?placeholder="輸入密碼"/.test(src), `${page}：密碼的 label、type、提示字`)
    r.check(/:aria-describedby="fieldError\.email \? 'email-error'/.test(src) && /id="email-error" tone="error"/.test(src), `${page}：錯誤訊息在卡片下方，輸入框指得到它`)
    r.check(/<div class="flex flex-col gap-3">/.test(src), `${page}：卡片之間 12px`)
  }
  r.check(/autocomplete="current-password"/.test(read('pages/login.vue')) && /autocomplete="new-password"/.test(read('pages/signup.vue')), '密碼的 autocomplete：登入 current、註冊 new')
  const sheetText = read('components/SheetText.vue')
  r.check(/:type="type"/.test(sheetText) && /props\.type !== 'password'/.test(sheetText), 'SheetText：密碼不畫明文的顯示層')
  r.check(/:global\(\.theme-green\) \.form-card \{\s*--card-border: transparent;/.test(card), '綠底模式的表單卡片不畫外框；淺色維持')
  r.check(/var\(--card-border, var\(--border\)\)/.test(read('components/AppCard.vue')), 'AppCard 的外框預設仍是 --border')

  return r.finish()
}
