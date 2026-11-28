<script setup lang="ts">
// 主圖「沒有豆袋照片時」的樣子：結算頁與豆子詳情共用（《03》§4.17.1）。
//
// **整個 App 只有這個元件知道沒有照片時主圖長什麼樣。** BrewHero 只負責版面、漸層與按鈕，
// 沒有照片時把這一塊交給這裡；之後要換圖，只改這個檔案，BrewHero 與結算頁都不用動。
//
// 目前的內容（2026-11-28，Figma「coffee bean image / hero」3677:1996）：烘焙度底色（roastFill：沒填烘焙度是 --roast-unknown）
// 上鋪滿 60×60 的豆子圖樣，取代原本置中的三顆大豆子。
//
// - 圖樣是一格 91×160 的 public/illustrations/bean-pattern.svg，當遮罩（mask-repeat: repeat），豆子的顏色是 --roast-art
//   （和縮圖的豆子同一個 token；Figma 的豆子綁 neutral/bg，這裡統一）。
// - 格子：橫向間距 91、列距 80（兩列一個週期 160）。正放的列中心 x 45、y 69；下一列是**左右鏡像**（Figma 是 scale-x −1，
//   不是轉 180°），中心 x 88、y 149（＝ −11 ＋ 160：最上面那排被切掉一半）。Figma 是手排的，鏡像豆子的中心平均約 88、
//   正放約 45，這裡取整數、不照抄每顆 2–4px 的誤差。
// - **豆子大小固定**，不跟著主圖寬度縮放：主圖比 390 寬、或豆名很長往下長時，圖樣從左上角起一直鋪下去，不拉伸、沒有接縫。
// - 圖樣往四邊多鋪 --pattern-bleed（40px，是模糊半徑 20 的兩倍）：模糊那一份（BrewHero 的 .brew-hero__blur）的邊緣
//   落在圖層外、被圖層裁掉，不會在邊上淡成一圈只有底色的框。遮罩的起點跟著往回推同樣的距離，格子仍然對齊主圖左上角。
//
// ── 之後換圖 ─────────────────────────────────────────────
// 圖片規格（以 390 寬為準）：
//   - 顯示區域 390×470（矮螢幕時高度是 min(470px, 58svh)，寬螢幕時寬度最多 --content-max）。object-fit: cover、置中
//   - 建議來源至少 1170×1410 px（3 倍）、WebP
//   - 右上約 150×110 是按鈕區（分享、完成）。下方約 40% 會被漸層蓋掉，重點內容放在上方 55% 以內
//
// a. 換成一張固定的圖：放進有版本號的目錄，照開場首圖的作法（public/splash/v1/），例如
//    public/hero/v1/fallback.webp；這個元件改成 <img src="/hero/v1/fallback.webp" alt="" class="absolute inset-0 size-full object-cover">。
//    **換圖時換版本號**（v2），不要覆蓋同一個檔名：開場首圖設了一年的不可變快取，這裡也應該比照。
//    快取的標頭在 vercel.json（"/(splash|brand)/(.*)"），要把 hero 加進那一條——那是部署設定，改之前先確認
// b. 依烘焙度各一張：命名規則 public/hero/v1/{烘焙度}.webp，烘焙度用資料庫的值
//    （light、medium_light、medium、medium_dark、dark），沒填烘焙度是 public/hero/v1/unknown.webp。
//    這個元件已經拿到 roastLevel，改成 `/hero/v1/${roastLevel ?? 'unknown'}.webp`
// 兩種都一樣：圖是裝飾（豆名就在下面），alt 留空；圖還沒到時底下仍是烘焙度底色，版面不跳動。

const props = defineProps<{ roastLevel: RoastLevel | null }>()

const fill = computed(() => roastFill(props.roastLevel))
</script>

<template>
  <div class="hero-fallback" :style="{ background: fill.background }" aria-hidden="true">
    <div class="hero-fallback__pattern" />
  </div>
</template>

<style scoped>
.hero-fallback {
  --pattern-bleed: 40px;
  position: absolute;
  inset: 0;
}
/* 豆子圖樣：一格 91×160，重複鋪滿（數值見開頭的註解與 SVG 檔裡的註解） */
.hero-fallback__pattern {
  position: absolute;
  inset: calc(var(--pattern-bleed) * -1);
  background: var(--roast-art);
  -webkit-mask-image: url("/illustrations/bean-pattern.svg");
  mask-image: url("/illustrations/bean-pattern.svg");
  -webkit-mask-size: 91px 160px;
  mask-size: 91px 160px;
  -webkit-mask-repeat: repeat;
  mask-repeat: repeat;
  -webkit-mask-position: var(--pattern-bleed) var(--pattern-bleed);
  mask-position: var(--pattern-bleed) var(--pattern-bleed);
}
</style>
