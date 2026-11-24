// 內外圓角的量測（《03》§2.3.1）。**在瀏覽器的頁面裡執行**：run.mjs 讀進這個檔案、交給 page.evaluate。
// 不 import 任何東西，整個檔案是一個運算式，回傳量到的組合。
//
// 量法：
//   1. 每個看得見、有圓角的元素是「內層」——要有底色或框線，或是裁切照片的容器、照片本身。
//      照片、裁切照片的容器、class 名稱有 thumb 的元素（縮圖的骨架）標成 photo，分類時算例外 a
//   2. 往上找最近一個看得見（有底色或框線）而且有圓角的祖先，當「外層」
//   3. 四個角各自量：間距是內層外緣到外層外緣（border-box，外層的框線算在間距裡）
//   4. 圓角是畫出來的值：照 CSS 的規則，相鄰兩角相加超過邊長時一起縮（膠囊被高度限制就是這樣）
//   5. 兩種紀錄：
//      corner：內層在外層的轉角區（兩個方向的間距都小於外層圓角），附上應為（外層 − 較小的間距）
//      larger：內層的圓角大於外層（不論在不在轉角區），一個元素一筆
// corner-shape（superellipse）不算進數字，只附在結果裡參考。
(() => {
  const px = (v, ref) => (v.endsWith('%') ? (parseFloat(v) / 100) * ref : parseFloat(v) || 0)
  const visibleColor = c => c && c !== 'transparent' && !/rgba?\([^)]*,\s*0\)$/.test(c) && !/ \/ 0\)$/.test(c)
  function seen(el) {
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) === 0) return false
    const r = el.getBoundingClientRect()
    return r.width >= 1 && r.height >= 1
  }
  function painted(el) {
    const cs = getComputedStyle(el)
    if (visibleColor(cs.backgroundColor) || cs.backgroundImage !== 'none') return true
    for (const s of ['Top', 'Right', 'Bottom', 'Left'])
      if (parseFloat(cs[`border${s}Width`]) > 0 && cs[`border${s}Style`] !== 'none' && visibleColor(cs[`border${s}Color`])) return true
    return false
  }
  function radii(el) {
    const cs = getComputedStyle(el), r = el.getBoundingClientRect(), W = r.width, H = r.height
    const g = (k) => { const [a, b = a] = cs[k].split(' '); return [px(a, W), px(b, H)] }
    const tl = g('borderTopLeftRadius'), tr = g('borderTopRightRadius'), br = g('borderBottomRightRadius'), bl = g('borderBottomLeftRadius')
    const f = Math.min(1, W / (tl[0] + tr[0] || 1e9), W / (bl[0] + br[0] || 1e9), H / (tl[1] + bl[1] || 1e9), H / (tr[1] + br[1] || 1e9))
    const eff = ([x, y]) => Math.min(x * f, y * f)
    return {
      spec: { tl: tl[0], tr: tr[0], br: br[0], bl: bl[0] },
      eff: { tl: eff(tl), tr: eff(tr), br: eff(br), bl: eff(bl) },
      scaled: f < 0.999,
      cornerShape: cs.getPropertyValue('corner-shape') || '',
    }
  }
  // 「元件:標籤.class「文字」」——開發模式下 Vue 會在元素上掛 __vueParentComponent
  const name = (el) => {
    const comp = el.__vueParentComponent?.type?.__name || el.__vueParentComponent?.type?.__file?.split('/').pop() || ''
    const cls = (typeof el.className === 'string' ? el.className : '').split(/\s+/)
      .filter(c => c && !/^(flex|items|justify|gap|mt|mb|ml|mr|px|py|p|m|w|h|text|font|shrink|min|max|block|inline|relative|absolute|overflow|self|space|pointer|select|truncate|whitespace|tabular|leading|tracking)-?/.test(c))
      .slice(0, 3).join('.')
    const txt = (el.innerText || el.getAttribute('aria-label') || el.alt || '').trim().replace(/\s+/g, ' ').slice(0, 14)
    return `${comp ? comp + ':' : ''}${el.tagName.toLowerCase()}${cls ? '.' + cls : ''}${txt ? `「${txt}」` : ''}`
  }
  const out = []
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('#nuxt-devtools-container, nuxt-devtools-frame')) continue
    if (!seen(el)) continue
    const ri = radii(el)
    if (Object.values(ri.eff).every(v => v < 0.5)) continue
    const cs = getComputedStyle(el)
    const clipsMedia = cs.overflow !== 'visible' && !!el.querySelector('img, canvas, video')
    const isMedia = ['IMG', 'CANVAS', 'VIDEO'].includes(el.tagName)
    // 縮圖的載入骨架（class 名稱有 thumb）和縮圖本身同一類：例外 a
    const isThumb = /thumb/i.test(typeof el.className === 'string' ? el.className : '')
    if (!painted(el) && !clipsMedia && !isMedia) continue
    let a = el.parentElement
    while (a && a !== document.body) {
      if (seen(a) && painted(a) && Object.values(radii(a).eff).some(v => v >= 0.5)) break
      a = a.parentElement
    }
    if (!a || a === document.body) continue
    const ro = radii(a), O = a.getBoundingClientRect(), I = el.getBoundingClientRect()
    const base = {
      outer: name(a), inner: name(el), innerSize: `${Math.round(I.width)}×${Math.round(I.height)}`,
      photo: clipsMedia || isMedia || isThumb, outerShape: ro.cornerShape, innerShape: ri.cornerShape,
    }
    const capsuleAt = k => ri.scaled || ri.spec[k] >= Math.min(I.width, I.height) / 2 - 0.5
    const corners = {
      tl: [I.left - O.left, I.top - O.top], tr: [O.right - I.right, I.top - O.top],
      br: [O.right - I.right, O.bottom - I.bottom], bl: [I.left - O.left, O.bottom - I.bottom],
    }
    let largest = null
    for (const [k, [dx, dy]] of Object.entries(corners)) {
      const R = ro.eff[k], actual = ri.eff[k]
      if (actual > R + 0.5 && (!largest || actual - R > largest.actual - largest.R))
        largest = { kind: 'larger', corner: k, R: +R.toFixed(1), dx: +dx.toFixed(1), dy: +dy.toFixed(1), actual: +actual.toFixed(1), capsule: capsuleAt(k) }
      if (R < 0.5 || dx < -0.5 || dy < -0.5 || !(dx < R && dy < R)) continue
      const should = R - Math.min(dx, dy)
      if (should <= 0) continue
      out.push({ ...base, kind: 'corner', corner: k, R: +R.toFixed(1), dx: +dx.toFixed(1), dy: +dy.toFixed(1), should: +should.toFixed(1), actual: +actual.toFixed(1), capsule: capsuleAt(k) })
    }
    if (largest) out.push({ ...base, ...largest })
  }
  return out
})()
