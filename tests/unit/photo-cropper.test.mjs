// 照片裁切（cropperjs v2）。
//
// 這裡的失效方式幾乎都很安靜，所以用結構檢查守住：
//   靜態 import cropperjs      → SSR 時 customElements 不存在，整頁伺服器錯誤
//   isCustomElement 被拿掉     → Vue 把 cropper-* 當成找不到的元件，只在 console 警告
//   選取框開了 movable          → 在框內拖曳會去拖框，而不是拖照片
//   rotatable 被打開            → 雙指縮放時照片會跟著轉
//   取消時 emit picked(null)   → 換照片時按取消，原本那張照片被當成移除
//   浮層外點擊判斷沒排除 modal  → 在就地新增裡裁切，點一下整個浮層就關掉
//
// 觸控手勢本身在瀏覽器裡以 build 後的 chunk 實測過（375px：拖曳平移、
// 雙指縮放、無旋轉、框不動、輸出 1600×1600），這裡不重做。

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
