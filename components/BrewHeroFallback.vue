<script setup lang="ts">
// 結算頁主圖「沒有豆袋照片時」的樣子（《03》§4.17.1，Figma 結算頁 v2 的 3628:1544）。
//
// **整個 App 只有這個元件知道沒有照片時主圖長什麼樣。** BrewHero 只負責版面、漸層與按鈕，
// 沒有照片時把這一塊交給這裡；之後要換圖，只改這個檔案，BrewHero 與結算頁都不用動。
//
// 目前的內容：烘焙度底色鋪滿主圖（沒填烘焙度是 --roast-unknown，roastFill），
// BeanArt 的三顆豆子以完整、不裁切的方式（whole）畫在上半部中間。沿用 BeanArt 的圖檔與 --roast-art，不另外複製 SVG。
//
// 尺寸（2026-11-26 第二版，符合下面的「上方 55%」）：**三顆豆子整組**在 390×470 時寬 220、高 228，
// 水平置中、距頂 24，下緣 252（54%）。Figma 3628:1544 是基準正方形 260（整組約 328×340），下緣超過 55%，沒有照它。
// 整組的外框是從 SVG 路徑取樣算的（以 BeanArt 的基準正方形為 1）：x −0.047〜1.213（寬 1.260）、y −0.061〜1.247（高 1.308）。
// 所以外層 .hero-fallback__art 是整組的外框（寬高比 1.260：1.308），裡面的 BeanArt 基準正方形是外框寬的 1/1.260，
// 往右下偏 (0.047, 0.061)。寬取 min(220/390 寬, 主圖高 × 0.55 能放下的寬)：320 寬與矮螢幕時跟著縮，整組一律在上方 55% 以內。
// 「主圖高」是主圖的基準高度（BrewHero 的 --hero-h，min(470px, 58svh)），不是實際高度：豆名很長、主圖往下長時，
// 豆子不跟著變大（變大的話下面那顆會掉進標題背後的漸層）。不在 BrewHero 裡時沒有 --hero-h，用整塊的高度
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
    <div class="hero-fallback__frame">
      <div class="hero-fallback__art">
        <div class="hero-fallback__base">
          <BeanArt background="transparent" whole />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hero-fallback {
  position: absolute;
  inset: 0;
}
/* 換算的基準：主圖的基準高度（不是撐高之後的實際高度），cqw、cqh 都以它為準 */
.hero-fallback__frame {
  position: absolute;
  inset: 0 0 auto;
  height: var(--hero-h, 100%);
  container-type: size;
}
.hero-fallback__art {
  /* 距頂 24/470 ＝ 5.1cqh；高度上限 55% − 5.1% ＝ 49.9cqh，換成寬是 49.9 × 1.260 / 1.308 ＝ 48.07cqh */
  position: absolute;
  top: 5.1cqh;
  left: 50%;
  width: min(56.41cqw, 48.07cqh);
  aspect-ratio: 1.26 / 1.308;
  translate: -50% 0;
}
/* BeanArt 的基準正方形：外框寬的 1/1.260（79.37%），往右 0.047/1.260（3.73%）、往下 0.061/1.308（4.66%） */
.hero-fallback__base {
  position: absolute;
  left: 3.73%;
  top: 4.66%;
  width: 79.37%;
}
</style>
