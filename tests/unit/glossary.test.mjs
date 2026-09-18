// 介面用詞守在《04-詞彙表》上（結構檢查）。
//
// 詞彙表第三欄列的是「刻意不用的同義詞」。那些詞每一個都「也通」，
// 所以最容易被人順手改回去——改回去之後，同一個概念在畫面上又有兩種叫法，
// 使用者會以為那是兩件事。這裡只掃介面文案，註解不算。

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { createReport } from '../helpers/report.mjs'

const root = new URL('../../', import.meta.url)
const read = path => readFileSync(new URL(path, root), 'utf8')

function sourceFiles(dir) {
  const out = []
  for (const name of readdirSync(new URL(dir, root))) {
    const path = `${dir}/${name}`
    if (statSync(new URL(path, root)).isDirectory()) out.push(...sourceFiles(path))
    else if (/\.(vue|ts)$/.test(name)) out.push(path)
  }
  return out
}

/** 拿掉註解與樣式，只留下可能出現在畫面上的東西 */
function stripComments(text) {
  return text
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/.*$/gm, '$1')
}

// 詞 → 該用什麼（與《04-詞彙表》第三欄一致）
const banned = {
  停水時長: '停水時間',
  停水秒數: '停水時間',
  純停水: '停水時間',
  斷水: '停水',
  給水: '注水',
  總沖煮時間: '沖煮時間',
  萃取時間: '沖煮時間',
  各段水量: '各段累積水量',
  累計水量: '累積水量',
  研磨度: '研磨刻度',
  水粉比: '粉水比',
  粉量: '粉重',
  豆量: '粉重',
  養豆期: '養豆天數',
  烘焙程度: '烘焙度',
  處理方式: '處理法',
  沖煮法: '沖煮手法',
  沖法: '沖煮手法（手法名稱不帶「沖法」）',
  晃動: '搖晃',
  代入: '帶入',
  細口壺: '手沖壺',
  下壺: '分享壺',
}

export default function run() {
  const r = createReport('介面用詞')

  r.section('詞彙表存在，而且寫進工作規則')
  r.check(existsSync(new URL('docs/04-詞彙表.md', root)), 'docs/04-詞彙表.md 存在')
  r.check(/04-詞彙表/.test(read('CLAUDE.md')), 'CLAUDE.md 要求新增文案前先查詞彙表')

  r.section('刻意不用的同義詞沒有出現在介面上')
  const sources = [...sourceFiles('components'), ...sourceFiles('pages'), ...sourceFiles('utils'), ...sourceFiles('composables')]
  const texts = sources.map(path => [path, stripComments(read(path))])
  for (const [word, instead] of Object.entries(banned)) {
    const hits = texts.filter(([, text]) => text.includes(word)).map(([path]) => path)
    r.check(hits.length === 0, `不用「${word}」，用「${instead}」${hits.length ? `：${hits.join('、')}` : ''}`)
  }

  r.section('兩種時間分開叫')
  const form = read('components/BrewForm.vue')
  r.check(/for="brew-at">沖煮日期</.test(form), 'brewed_at 的標籤是「沖煮日期」')
  r.check(/for="brew-total-time">沖煮時間</.test(form), 'total_time 的標籤是「沖煮時間」')
  r.check(/'total_time', '沖煮時間'/.test(read('utils/brewDiff.ts')), '差異區的 total_time 也叫「沖煮時間」')
  r.check(/label: '沖煮時間'/.test(read('pages/brews/[id]/index.vue')), '紀錄詳情頁的 total_time 也叫「沖煮時間」')

  r.section('差異區的分段標籤')
  const diff = read('utils/brewDiff.ts')
  r.check(/'各段累積水量'/.test(diff), '「各段累積水量」')
  r.check(/'各段停水時間'/.test(diff), '「各段停水時間」')

  r.section('「停留」只當欄位標籤')
  const uiWithStay = texts.filter(([, text]) => /停留/.test(text.replace(/>停留<\/label>/g, '')))
  r.check(uiWithStay.length === 0,
    `「停留」只出現在分段的欄位標籤${uiWithStay.length ? `：${uiWithStay.map(([p]) => p).join('、')}` : ''}`)

  return r.finish()
}
