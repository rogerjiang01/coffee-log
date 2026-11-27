// 豆子詳情的接線（2026-11-27 改版，Figma「豆子詳情（草稿）－A 主圖版」3649:1552；《03》§4.23）。
// 主圖和結算頁共用 BrewHero（不能有第二份實作）；小數據與豆子資訊的顯示規則；照片放大。

import { readFileSync, readdirSync } from 'node:fs'
import { createReport } from '../helpers/report.mjs'

const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')
const templateOf = text => text.slice(text.indexOf('<template>'))
const stripComments = text => text.replace(/<!--[\s\S]*?-->/g, '')

export default function run() {
  const r = createReport('豆子詳情的接線')
  const page = read('pages/beans/[id]/index.vue')
  const template = stripComments(templateOf(page))
  const hero = read('components/BrewHero.vue')
  const heroTemplate = stripComments(templateOf(hero))

  r.section('主圖：和結算頁共用同一個元件')
  r.check(/<BrewHero\s+:has-photo="!!bean\.photo_path"\s+:photo-url="photoUrl"\s+:roast-level="bean\.roast_level"\s+:solid-at="sections"\s+:alt="bean\.name"\s*>/.test(template),
    '豆子詳情用 BrewHero：原圖網址、烘焙度、漸層到第一個段落、放大後的替代文字是豆名')
  r.check(/:alt="beanName"/.test(read('pages/brews/[id]/summary.vue')), '結算頁也傳替代文字（照片一樣能放大）')
  const heroes = readdirSync(new URL('../../components/', import.meta.url)).filter(f => /Hero/.test(f)).sort()
  r.check(JSON.stringify(heroes) === JSON.stringify(['BrewHero.vue', 'BrewHeroFallback.vue']), `主圖只有一份實作（${heroes.join('、')}）`)
  r.check(/signedUrl\(path\)/.test(page) && !/thumbnailUrl/.test(page), '主圖用原圖，不用 384 的縮圖')
  r.check(/<main class="mx-auto overflow-clip"/.test(template) && !/<main[^>]*px-/.test(template),
    'main 沒有左右內距（主圖滿版），overflow: clip（背景的抵銷平移不撐大捲動範圍）')
  r.check(!/<template #actions>/.test(template) && !/<PageHeader/.test(template), '右上角不放按鈕；沒有一般的頁首')
  r.check(!/BeanArt|aspect-square|roastFill/.test(template), '拿掉：正方形照片、烘焙度色塊與色塊裡的豆名')

  // 2026-11-27 第二版：照片不跟著背景層（到 --hero-solid）的高度放大
  r.check(/\.brew-hero__photo \{\s*position: absolute;\s*top: 0;\s*left: 0;\s*right: 0;\s*aspect-ratio: 1;\s*overflow: hidden;\s*\}/.test(hero)
    && (heroTemplate.match(/<div v-if="showPhoto" class="brew-hero__photo" :style="\{ background: fill\.background \}">/g) || []).length === 2
    && (heroTemplate.match(/:style="\{ background: showPhoto \? 'var\(--bg\)'/g) || []).length === 2
    && !/<div v-if="showPhoto" class="absolute inset-0"/.test(heroTemplate),
    '照片框：正方形、寬＝主圖寬、貼齊頂端（清楚與模糊兩份同一個框），框以下是 --bg')

  r.section('返回鈕：浮動、固定在頂端')
  r.check(/<BackButton floating :to="BEAN_BACK_FALLBACK" label="返回" \/>/.test(template), '歷史式（BEAN_BACK_FALLBACK）')
  const back = template.indexOf('<BackButton floating')
  r.check(back > 0 && back < template.indexOf('v-if="loading"') && back < template.indexOf('notFound') && back < template.indexOf('<BrewHero'),
    '在所有狀態判斷之外，DOM 在主圖之前（鍵盤：返回 → 放大照片）')

  r.section('照片放大')
  r.check(/const zoomable = computed\(\(\) => showPhoto\.value && !!props\.photoUrl && loaded\.value\)/.test(hero),
    '只有照片載入完成才有按鈕：佔位圖、還沒載完、載入失敗時不能點也不能聚焦')
  r.check(/<button\s+v-if="zoomable"\s+type="button"\s+class="brew-hero__zoom"\s+aria-label="放大豆袋照片"\s+@click="zoomOpen = true"\s*\/>/.test(heroTemplate),
    '一顆按鈕，名稱「放大豆袋照片」')
  r.check(/<PhotoViewer v-if="showPhoto && photoUrl" v-model:open="zoomOpen" :src="photoUrl" :alt="alt" \/>/.test(heroTemplate)
    && /<PhotoViewer v-model:open="open"/.test(read('components/PhotoZoom.vue')),
    '和紀錄詳情的縮圖同一個檢視器（PhotoViewer），看原圖')
  r.check(heroTemplate.indexOf('brew-hero__actions') < heroTemplate.indexOf('brew-hero__zoom')
    && heroTemplate.indexOf('brew-hero__zoom') < heroTemplate.indexOf('brew-hero__title'),
    'DOM 順序：右上角的按鈕 → 放大照片 → 標題區')
  r.check(/\.brew-hero__zoom \{[^}]*z-index: 2;[^}]*height: max\(96px, calc\(var\(--hero-h\) \* 0\.55\)\);/.test(hero)
    && /\.brew-hero__title \{[^}]*padding-top: max\(96px, calc\(var\(--hero-h\) \* 0\.55\)\);/.test(hero),
    '可以點的範圍：主圖頂端到標題區頂端（和標題區的上內距同一個值），在標題區之上')

  r.section('標題區與小數據')
  r.check(/<p v-if="roaster"[^>]*>\{\{ roaster \}\}<\/p>\s*<h1 class="text-display-l font-medium break-words">\{\{ bean\.name \}\}<\/h1>/.test(template),
    '咖啡店名（沒有就不顯示）→ 豆名（Display L，換行不截斷）')
  r.check(/<dl v-if="stats\.length" class="mt-1\.5 flex flex-wrap gap-x-7 gap-y-3">/.test(template), '小數據：三項都沒有時整排拿掉')
  r.check(/const rest = bean\.value\?\.is_finished \? null : restDayValue\(restDays\(bean\.value\?\.roast_date\)\)/.test(page) && /if \(rest\) items\.push\(\{ label: '養豆', value: rest \}\)/.test(page),
    '養豆：restDayValue（「N 天」，0 是「烘焙當天」），沒有烘焙日期、已喝完的豆子不顯示')
  r.check(/if \(brewCount\.value > 0\) items\.push\(\{ label: '沖煮', value: `\$\{brewCount\.value\} 次` \}\)/.test(page), '沖煮：「N 次」，0 次不顯示')
  r.check(/if \(favoriteCount\.value > 0\) items\.push\(\{ label: '收藏', value: `\$\{favoriteCount\.value\} 次` \}\)/.test(page), '收藏：「N 次」，0 次不顯示')
  r.check(!/沖煮次數|收藏次數|養豆天數/.test(template), '拿掉：舊的參數列、「沖煮次數」「收藏次數」兩列')

  r.section('段落')
  const labels = [...page.matchAll(/\{ label: '([^']+)', value: /g)].map(m => m[1]).filter(l => !['養豆', '沖煮', '收藏'].includes(l))
  r.check(JSON.stringify(labels) === JSON.stringify(['烘焙日期', '烘焙度', '產國', '產區', '處理法', '品種']), `豆子資訊照新增豆子表單的順序（${labels.join('、')}）`)
  r.check(/value: pillDate\(b\.roast_date\)/.test(page) && /value: pillDate\(bean\.roast_date\)/.test(read('components/SharedBrewView.vue')),
    '烘焙日期用共用的寫法 YYYY/MM/DD（豆子詳情與分享頁）')
  r.check(/<ReadonlyRow v-if="officialNotes" label="官方風味描述" start>/.test(template)
    && template.indexOf('label="官方風味描述"') > template.indexOf('v-for="row in infoRows"'),
    '官方風味描述：ReadonlyRow 的 start（保留換行），卡片最後一列')
  r.check(/<FormSection v-if="showInfo" title="豆子資訊">/.test(template)
    && /infoRows\.value\.length > 0 \|\| !!officialNotes\.value \|\| partial\.value/.test(page),
    '全部沒填就連段落標題一起不顯示；從列表帶進來的半成品留骨架列')
  r.check(/<div v-if="partial" class="sheet-row sheet-row--text card-pad-x" aria-hidden="true">\s*<SkeletonBlock width="4rem" height="1rem" radius="8px" \/>/.test(template), '骨架列和唯讀列同一個高度')
  r.check(/<FormSection v-if="compareRows\.length" title="每次怎麼沖的">/.test(template) && /<BeanCompareTable :rows="compareRows" \/>/.test(template)
    && /記錄第二筆後可以比較，改動的數值會標示出來。/.test(template),
    '每次怎麼沖的：FormSection＋比較表；沒有紀錄時整段不顯示；只有一筆時的說明句照舊')
  r.check(/<div ref="sections" class="flex flex-col" :style="\{ gap: 'var\(--gap-section\)' \}">/.test(template)
    && template.indexOf('ref="sections"') < template.indexOf('title="豆子資訊"'),
    '段落之間 --gap-section；漸層在第一個段落的頂端到實底')

  return r.finish()
}
