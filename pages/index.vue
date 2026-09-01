<script setup lang="ts">
// 階段 0 的暫時畫面，唯一目的是驗證設計 token 已載入並生效。
// 首頁的實際內容（沖煮中的豆子＋紀錄時間軸）在階段 7 實作，屆時整頁換掉。

const colorGroups = [
  {
    title: '主色',
    items: [
      { name: '--accent', value: '#516E41', usage: '主要行動、選取狀態、連結', contrast: 'on --bg 5.52:1' },
      { name: '--accent-soft', value: '#678C53', usage: '圖示、hover、次要狀態' },
      { name: '--accent-wash', value: 'rgb(81 110 65 / 0.08)', usage: '選取項目底色' },
    ],
  },
  {
    title: '中性',
    items: [
      { name: '--bg', value: '#FFFAEF', usage: '頁面底色' },
      { name: '--surface', value: '#FFFFFF', usage: '卡片、表單區塊' },
      { name: '--text', value: '#2A2E26', usage: '主要文字', contrast: 'on --bg 13.30:1' },
      { name: '--text-muted', value: '#6B6F63', usage: '次要文字、單位', contrast: 'on --bg 4.95:1' },
      { name: '--border', value: '#E8E1D2', usage: '分隔線、輸入框邊框' },
    ],
  },
  {
    title: '狀態',
    items: [
      { name: '--favorite', value: '#C0453A', usage: '愛心', contrast: 'on --bg 4.86:1' },
      { name: '--danger', value: '#8B2318', usage: '刪除、錯誤', contrast: 'on --bg 8.58:1' },
      { name: '--diff', value: '#516E41', usage: '差異標記，字重為主、顏色為輔' },
    ],
  },
]

const roastScale = [
  { name: '--roast-light', ratio: '10.92:1' },
  { name: '--roast-medium-light', ratio: '7.96:1' },
  { name: '--roast-medium', ratio: '5.29:1' },
  { name: '--roast-medium-dark', ratio: '5.46:1' },
  { name: '--roast-dark', ratio: '11.74:1' },
]

const typeScale = [
  { token: '--text-2xl', size: '2rem', usage: '頁面主標', cls: 'text-2xl' },
  { token: '--text-xl', size: '1.5rem', usage: '區塊標題', cls: 'text-xl' },
  { token: '--text-lg', size: '1.125rem', usage: '卡片標題、數值強調', cls: 'text-lg' },
  { token: '--text-base', size: '1rem', usage: '內文', cls: 'text-base' },
  { token: '--text-sm', size: '0.875rem', usage: '次要文字、標籤', cls: 'text-sm' },
  { token: '--text-xs', size: '0.75rem', usage: '單位、輔助說明（中文下限）', cls: 'text-xs' },
]

const radiusScale = [
  { token: '--radius-sm', value: '4px', usage: '輸入框、標籤、徽章、表格內標記', cls: 'rounded-sm' },
  { token: '--radius-md', value: '8px', usage: '卡片、表單區塊', cls: 'rounded-md' },
  { token: '--radius-lg', value: '12px', usage: '對話框、浮出層', cls: 'rounded-lg' },
]

const sampleValues = [
  { label: '粉重', value: '15.0 g' },
  { label: '水溫', value: '92 °C' },
  { label: '刻度', value: '22.5' },
  { label: '總水量', value: '225 g' },
]
</script>

<template>
  <main class="mx-auto px-5 py-10" :style="{ maxWidth: 'var(--content-max)' }">
    <div class="flex items-baseline justify-between">
      <p class="text-sm text-muted">階段 0</p>
      <!-- 暫時的設定入口。規範第 3 節的底部分頁列在階段 7 才做。 -->
      <span class="flex gap-4">
        <NuxtLink to="/beans" class="text-sm underline" :style="{ color: 'var(--accent)' }">豆子</NuxtLink>
        <NuxtLink to="/settings" class="text-sm underline" :style="{ color: 'var(--accent)' }">設定</NuxtLink>
      </span>
    </div>
    <h1 class="mt-1 font-serif text-2xl font-bold">手沖咖啡紀錄</h1>
    <p class="mt-3 text-muted">
      Nuxt、Supabase、Tailwind 已初始化，設計 token 全數定案並寫入單一檔案。
      這頁是暫時的檢核畫面，階段 7 會整個換成首頁。
    </p>

    <section v-for="group in colorGroups" :key="group.title" class="mt-10">
      <h2 class="font-serif text-xl font-bold">色彩：{{ group.title }}</h2>
      <ul class="mt-4">
        <li
          v-for="item in group.items"
          :key="item.name"
          class="flex items-center gap-4 border-t py-3"
          :style="{ borderColor: 'var(--border)' }"
        >
          <span
            class="size-10 shrink-0 rounded-sm border"
            :style="{ background: `var(${item.name})`, borderColor: 'var(--border)' }"
          />
          <span class="flex-1">
            <code>{{ item.name }}</code>
            <span class="ml-2 text-sm tabular-nums text-muted">{{ item.value }}</span>
            <span class="block text-sm text-muted">
              {{ item.usage }}<template v-if="item.contrast">，{{ item.contrast }}</template>
            </span>
          </span>
        </li>
      </ul>
    </section>

    <section class="mt-10">
      <h2 class="font-serif text-xl font-bold">烘焙度五級與對比驗算</h2>
      <p class="mt-2 text-sm text-muted">
        無豆袋照片時的卡片填充。每一級疊上其指定文字色，五級皆通過 4.5:1。
      </p>
      <ul class="mt-4 space-y-2">
        <li
          v-for="roast in roastScale"
          :key="roast.name"
          class="flex items-baseline justify-between rounded-md px-4 py-3"
          :style="{ background: `var(${roast.name})`, color: `var(${roast.name}-text)` }"
        >
          <span>耶加雪菲 柯契爾</span>
          <span class="text-sm tabular-nums">{{ roast.ratio }}</span>
        </li>
      </ul>
    </section>

    <section class="mt-10">
      <h2 class="font-serif text-xl font-bold">字級階層</h2>
      <ul class="mt-4">
        <li
          v-for="step in typeScale"
          :key="step.token"
          class="border-t py-3"
          :style="{ borderColor: 'var(--border)' }"
        >
          <span :class="step.cls">手沖咖啡紀錄 15.0g</span>
          <span class="block text-sm text-muted">
            <code>{{ step.token }}</code>
            <span class="ml-2 tabular-nums">{{ step.size }}</span>
            <span class="ml-2">{{ step.usage }}</span>
          </span>
        </li>
      </ul>
    </section>

    <section class="mt-10">
      <h2 class="font-serif text-xl font-bold">圓角三級與陰影一級</h2>
      <p class="mt-2 text-sm text-muted">
        不同層級的元件用不同級距，不得全站共用同一個值。
      </p>
      <ul class="mt-4 space-y-3">
        <li
          v-for="r in radiusScale"
          :key="r.token"
          :class="r.cls"
          class="border px-4 py-3"
          :style="{ borderColor: 'var(--border)', background: 'var(--surface)' }"
        >
          <code>{{ r.token }}</code>
          <span class="ml-2 text-sm tabular-nums text-muted">{{ r.value }}</span>
          <span class="block text-sm text-muted">{{ r.usage }}</span>
        </li>
      </ul>
      <div
        class="mt-4 rounded-lg px-4 py-3"
        :style="{ background: 'var(--surface)', boxShadow: 'var(--overlay-shadow)' }"
      >
        <code>--overlay-shadow</code>
        <span class="block text-sm text-muted">
          唯一一級陰影，只給對話框與浮動按鈕。卡片與表單區塊改用邊框或底色差異分層。
        </span>
      </div>
    </section>

    <section class="mt-10">
      <h2 class="font-serif text-xl font-bold">字體與數字對齊</h2>
      <p class="mt-3 font-serif text-lg">標題使用 Noto Serif TC，載入 500 與 700</p>
      <p class="mt-1">內文使用 Noto Sans TC，載入 400、500、700，行高 1.75。</p>
      <table class="mt-4 text-sm tabular-nums">
        <tbody>
          <tr v-for="row in sampleValues" :key="row.label">
            <td class="pr-6 text-muted">{{ row.label }}</td>
            <td>{{ row.value }}</td>
          </tr>
        </tbody>
      </table>
      <p class="mt-2 text-sm text-muted">數字若等寬對齊，tabular-nums 即生效。</p>
    </section>
  </main>
</template>
