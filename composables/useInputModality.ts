// 最後一次互動是鍵盤還是點擊（手指、滑鼠、觸控筆）。SelectField 用它決定要不要畫焦點框：
// 原生控制項透明蓋在膠囊上，焦點框要畫在膠囊上，而 select 被手指點到時瀏覽器也可能算它 :focus-visible。
//
// 監聽放在整份文件、capture 階段：點的是列左邊的標籤（label for）時，pointerdown 不在控制項裡。
// 只在瀏覽器裡掛一次；伺服器算繪時一律當成點擊（不畫框，和沒聚焦時一樣）。

type Modality = 'keyboard' | 'pointer'

const modality = ref<Modality>('pointer')
let installed = false

export function useInputModality() {
  if (import.meta.client && !installed) {
    installed = true
    document.addEventListener('pointerdown', () => { modality.value = 'pointer' }, true)
    document.addEventListener('keydown', (event) => {
      // 單獨按修飾鍵（例如 iOS 外接鍵盤的 Cmd）不算開始用鍵盤操作。
      // 例外是 Tab：Safari 預設 Tab 跳不到連結，要 Option＋Tab——分頁列的四格是連結，
      // 不算的話用 Safari 的鍵盤使用者看不到焦點框（2026-11-25）
      if ((event.metaKey || event.altKey || event.ctrlKey) && event.key !== 'Tab') return
      modality.value = 'keyboard'
    }, true)
  }
  return readonly(modality)
}
