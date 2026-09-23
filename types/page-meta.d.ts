// 每一頁宣告自己是哪一種畫面（《03》§3 導覽）。分頁列由 app.vue 依這個決定，
// 不再由各頁自己放——「哪些頁面有分頁列」原本只存在於元件註解裡。
declare module '#app' {
  interface PageMeta {
    screen?: 'browse' | 'view' | 'flow' | 'share'
  }
}

export {}
