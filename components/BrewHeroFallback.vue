<script setup lang="ts">
// 結算頁主圖「沒有豆袋照片時」的樣子（《03》§4.17.1，Figma 結算頁 v2 的 3628:1544）。
//
// **整個 App 只有這個元件知道沒有照片時主圖長什麼樣。** BrewHero 只負責版面、漸層與按鈕，
// 沒有照片時把這一塊交給這裡；之後要換圖，只改這個檔案，BrewHero 與結算頁都不用動。
//
// 目前的內容：烘焙度底色鋪滿主圖（沒填烘焙度是 --roast-unknown，roastFill），
// BeanArt 的三顆豆子以完整、不裁切的方式（whole）畫在上半部中間。沿用 BeanArt 的圖檔與 --roast-art，不另外複製 SVG。
// 尺寸照 Figma：390×470 的主圖裡，BeanArt 的基準正方形 260px、水平置中、距頂 36px
// （構圖本身比基準正方形大，見 BeanArt 的 whole）。寬度與高度一起換算（cqw、cqh），
// 320 寬或矮螢幕（主圖用 svh 限高）時跟著縮，不被裁切。
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
    <div class="hero-fallback__art">
      <BeanArt background="transparent" whole />
    </div>
  </div>
</template>

<style scoped>
.hero-fallback {
  position: absolute;
  inset: 0;
  container-type: size;
}
/* 390×470 時 260px（66.67cqw ＝ 55.32cqh）、距頂 36px（7.66cqh）。取較小的那一邊，矮螢幕時跟著縮 */
.hero-fallback__art {
  position: absolute;
  top: 7.66cqh;
  left: 50%;
  width: min(66.67cqw, 55.32cqh);
  translate: -50% 0;
}
</style>
