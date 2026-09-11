// 照片裁切（cropperjs v2）。
//
// 這裡的失效方式幾乎都很安靜，所以用結構檢查守住：
//   靜態 import cropperjs      → SSR 時 customElements 不存在，整頁伺服器錯誤
//   isCustomElement 被拿掉     → Vue 把 cropper-* 當成找不到的元件，只在 console 警告
//   選取框開了 movable          → 在框內拖曳會去拖框，而不是拖照片
//   rotatable 被打開            → 雙指縮放時照片會跟著轉
//   取消時 emit picked(null)   → 換照片時按取消，原本那張照片被當成移除
//   浮層外點擊判斷沒排除 modal  → 在就地新增裡裁切，點一下整個浮層就關掉
//   關著的 dialog 裡算繪元素    → 框是 0×0：沒有框、沒有壓暗、確認永遠失敗
//   雙指交回 cropperjs          → 兩指一起滑動時照片往反方向漂
//
// 觸控手勢在暫時的公開路由上、掛真實的 PhotoField 實測過（375px：單指拖曳、
// 兩指一起滑動、雙指張開、確認輸出 1600×1600、取消），驗完路由已移除。
// 這裡只守結構；縮放比例的換算在 pinch.test.ts 以純函式驗證。

import { readFileSync, existsSync } from 'node:fs'
import { createReport } from '../helpers/report.mjs'

const root = new URL('../../', import.meta.url)
const read = path => readFileSync(new URL(path, root), 'utf8')

export default function run() {
  const r = createReport('照片裁切')

  r.section('只在瀏覽器端執行')
  r.check(existsSync(new URL('components/PhotoCropper.client.vue', root)),
    '元件是 .client.vue——cropperjs 一 import 就呼叫 customElements.define，伺服器端沒有這個 API')
  const cropper = read('components/PhotoCropper.client.vue')
  const script = cropper.slice(0, cropper.indexOf('</script>'))
  r.check(/await import\(['"]cropperjs['"]\)/.test(script), 'cropperjs 用動態 import() 載入——只有真的要裁切時才下載')
  r.check(!/^import[^\n]*['"]cropperjs['"]/m.test(script), '沒有靜態 import cropperjs（否則會進主要 bundle，且在 SSR 時被執行）')

  r.section('Vue 認得這些是 Web Components')
  const config = read('nuxt.config.ts')
  r.check(/isCustomElement:\s*tag\s*=>\s*tag\.startsWith\(['"]cropper-['"]\)/.test(config),
    'nuxt.config 以 cropper- 前綴宣告自訂元素——少了它 Vue 會把 cropper-* 當成找不到的元件')

  r.section('互動：框固定為正方形，照片在底下移動與縮放')
  const template = cropper.slice(cropper.indexOf('<template>'))
  const selection = (template.match(/<cropper-selection[\s\S]*?>/) || [''])[0]
  const image = (template.match(/<cropper-image[\s\S]*?\/>/) || [''])[0]
  r.check(/aspect-ratio="1"/.test(selection), '選取框是正方形，對應列表縮圖的比例')
  r.check(!/\bmovable\b/.test(selection) && !/\bresizable\b/.test(selection),
    '選取框不可移動也不可縮放——在框內拖曳才會平移照片，而不是去拖框')
  r.check(/\btranslatable\b/.test(image) && /\bscalable\b/.test(image), '照片可以平移與縮放')
  r.check(!/\brotatable\b/.test(image) && !/\bskewable\b/.test(image),
    '照片不可旋轉、不可傾斜——雙指因此只會縮放')
  r.check(/<cropper-selection[\s\S]*?<cropper-handle[^>]*action="move"[\s\S]*?<\/cropper-selection>/.test(template),
    '框內也有 move 把手——沒有它，在框內拖曳因為指到的是選取框（沒有 action）而毫無反應')
  r.check(/\$toCanvas\(\{\s*width:\s*OUTPUT_EDGE,\s*height:\s*OUTPUT_EDGE\s*\}\)/.test(cropper)
    && /OUTPUT_EDGE\s*=\s*1600/.test(cropper), '輸出正方形 1600×1600，與壓縮的長邊上限一致')

  r.section('先打開 dialog，再算繪 cropper 元素')
  // 實際發生過：cropper-selection 只在 connectedCallback 量一次畫布大小。
  // 關著的 <dialog> 是 display: none，那時插入的話框是 0×0——
  // 畫面上沒有框、沒有壓暗、確認永遠失敗，而且沒有任何錯誤訊息。
  // 隔離的 fixture 量不到這件事（容器一開始就可見），是掛真實元件才找到的。
  const mounted = (script.match(/onMounted\(async \(\) => \{[\s\S]*?\n\}\)/) || [''])[0]
  const iOpen = mounted.indexOf('showModal()')
  const iImport = mounted.indexOf("import('cropperjs')")
  const iReady = mounted.indexOf('ready.value = true')
  r.check(iOpen >= 0 && iImport >= 0 && iReady >= 0, 'onMounted 裡三步都在')
  r.check(iOpen < iImport && iImport < iReady,
    '順序是 showModal → import cropperjs → 算繪元素；顛倒的話框會是 0×0')

  r.section('確認鈕與錯誤訊息')
  r.check(/確認裁切/.test(template) && !/使用這張/.test(template), '按鈕是「確認裁切」')
  r.check(/:disabled="!imageReady \|\| working"/.test(template), '照片載入完成前確認鈕不可按——那時裁切必然是空的')
  r.check(/照片還沒載入完成/.test(script), '照片未載入：講出原因')
  r.check(/裁切框的大小是 0/.test(script), '框是 0×0：講出原因（這正是這次的症狀）')
  r.check(!/'裁切沒有成功'/.test(script), '不再只說「裁切沒有成功」——那句話沒有說為什麼')

  r.section('雙指：以兩指中點為錨點，自己處理')
  r.check(/addEventListener\('action', onCanvasAction, true\)/.test(script),
    'action 事件在捕獲階段攔——cropper-image 的監聽器先註冊，非捕獲階段搶不到它前面')
  const onAction = (script.match(/function onCanvasAction[\s\S]*?\n}/) || [''])[0]
  r.check(/pointers\.size >= 2/.test(onAction) && /event\.preventDefault\(\)/.test(onAction),
    '兩指按著時擋掉 cropperjs 自己的縮放——它以單根手指為錨點，兩指一起滑動時照片反向漂移')
  const onMove = (script.match(/function onPointerMove[\s\S]*?\n}/) || [''])[0]
  r.check(/\$zoom\(zoomArg\(/.test(onMove) && /lastPinch\.midX - rect\.x/.test(onMove),
    '縮放以兩指中點為錨點，比例經 zoomArg 換算——直接傳「比例 - 1」縮放會一路飄')
  r.check(/\$move\(now\.midX - lastPinch\.midX, now\.midY - lastPinch\.midY\)/.test(onMove),
    '平移量是兩指中點的位移——照片跟著手指走')

  r.section('層級：沿用 usePortalTarget')
  r.check(/usePortalTarget\(root\)/.test(cropper) && /<Teleport :to="portalTarget">/.test(cropper),
    '裁切介面用 usePortalTarget 決定 teleport 目標——開在 dialog 裡時不會落進 inert 區')
  r.check(/<dialog[\s\S]*?class="sheet"/.test(cropper), '用 .sheet 的原生 dialog，焦點鎖定與 Esc 交給瀏覽器')

  r.section('流程：裁切先於壓縮，取消不保留')
  const field = read('components/PhotoField.vue')
  r.check(/<PhotoCropper[\s\S]*?@confirm="onCropped"[\s\S]*?@cancel="onCropCancel"/.test(field), 'PhotoField 接上裁切介面')
  const onCropped = (field.match(/async function onCropped[\s\S]*?\n}/) || [''])[0]
  r.check(/compressBeanPhoto\(cropped\)/.test(onCropped), '裁切後的圖才進壓縮——裁切先於壓縮')
  const onCancel = (field.match(/function onCropCancel\(\) \{[\s\S]*?\n}/) || [''])[0]
  r.check(onCancel.length > 0 && !/emit\(/.test(onCancel),
    '取消不 emit——換照片時按取消，原本那張要留著；emit null 會被父層當成移除照片')
  r.check(/pending\.value = null/.test(onCancel), '取消會丟掉剛選的那張')
  r.check(/compressBeanPhoto\(file: Blob\)/.test(read('utils/image.ts')), '壓縮接受 Blob——裁切的產物走完全相同的壓縮流程')

  r.section('浮層外點擊不能把疊在上面的 modal 算進去')
  const panel = read('composables/useAnchoredPanel.ts')
  const isOutside = (panel.match(/function isOutside[\s\S]*?\n  }/) || [''])[0]
  r.check(/closest\(['"]dialog\[open\]['"]\)/.test(isOutside) && /!modal\.contains\(panel\.value\)/.test(isOutside),
    '點在「不包含這個浮層」的開啟中 dialog 裡時不算外面——否則在就地新增裡裁切，點一下豆子下拉就關掉')

  return r.finish()
}
