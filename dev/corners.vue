<script setup lang="ts">
// 轉角形狀的調整頁（開發用，2026-11-19）：/dev/corners
//
// **只在 `pnpm dev` 存在。**這個檔案不在 pages/ 裡，由 nuxt.config.ts 的開發用模組在 nuxt dev 時
// 才加進路由；正式 build 沒有這個路由（tests/unit/dev-corners.test.mjs 確認）。
// 不需要登入（開發環境的 redirectOptions.exclude 放行 /dev/*）、不讀資料庫、
// 也不經過目標設定的導向（utils/weeklyGoal.ts 的 needsGoalSetup 跳過 /dev/）。
//
// 每一類元素放實際的元件（假的內容），旁邊的滑桿改的是那一類的 token（tokens.css 的 --corner-*、
// --radius-card-*、--radius-block-button）。值寫在這一頁最外層的 style 上，只影響這一頁，不會帶到別頁。
// 調好之後，最下方那段 CSS 就是每個 token 的最終值。

type Kind = {
  label: string
  note?: string
  token: string
  shape: number
  defaultShape: number
  radius?: { token: string, value: number, default: number, max: number, step: number, fallback: string }
}

// 預設值和 tokens.css 一致（2026-11-19 使用者調好、貼回來的值）。tokens.css 改了這裡要跟著改（tests/unit/corner-shape.test.mjs 會擋）
const kinds = reactive<Record<string, Kind>>({
  cardPill: { label: '只有一列的卡片（56px 的列）', note: '心得筆記、評分、收藏、設為常用、豆子詳情的已喝完、登入與註冊的欄位……', token: '--corner-card-pill', shape: 1.2, defaultShape: 1.2, radius: { token: '--radius-card-pill', value: 28, default: 28, max: 28, step: 0.5, fallback: 'var(--radius-pill)' } },
  cardPillTall: { label: '只有一列的卡片（65px 的列）', note: '裡面有膠囊：沖煮時間、分段子頁的沖煮手法', token: '--corner-card-pill-tall', shape: 1.2, defaultShape: 1.2, radius: { token: '--radius-card-pill-tall', value: 32.5, default: 32.5, max: 32.5, step: 0.5, fallback: 'var(--radius-pill-tall)' } },
  save: { label: '滿寬按鈕', note: '實心與外框都是，56px 高（儲存、照上次再沖一次、編輯、新增一段……）', token: '--corner-block-button', shape: 1.2, defaultShape: 1.2, radius: { token: '--radius-block-button', value: 28, default: 28, max: 28, step: 0.5, fallback: 'var(--radius-pill)' } },
  sheet: { label: '下拉與日期的膠囊', note: '含沖煮時間的分秒輸入框', token: '--corner-sheet-pill', shape: 1.1, defaultShape: 1.1 },
  chip: { label: '風味標籤', token: '--corner-chip', shape: 1.1, defaultShape: 1.1 },
  toggle: { label: '開關', note: '軌道與圓鈕', token: '--corner-toggle', shape: 1.1, defaultShape: 1.1 },
  bar: { label: '每日長條', note: '總覽的本週目標', token: '--corner-bar', shape: 1.1, defaultShape: 1.1 },
  cardMl: { label: '分頁第一層的卡片', note: '總覽、豆子列表、器材列表（之後的紀錄卡片）。1 等於不套用', token: '--corner-card-ml', shape: 1.1, defaultShape: 1.1, radius: { token: '--radius-card-ml', value: 18, default: 18, max: 48, step: 1, fallback: '18px' } },
  cardMd: { label: '其他獨立的卡片', note: '結算頁、豆子詳情的比較表。1 等於不套用', token: '--corner-card-md', shape: 1.1, defaultShape: 1.1, radius: { token: '--radius-card-md', value: 24, default: 24, max: 48, step: 1, fallback: '24px' } },
  cardLg: { label: '表單的卡片容器', note: '1 等於不套用', token: '--corner-card-lg', shape: 1.1, defaultShape: 1.1, radius: { token: '--radius-card-lg', value: 24, default: 24, max: 48, step: 1, fallback: 'var(--radius-lg)' } },
  // 2026-11-25：底部分頁列。半徑由高度決定（64 的一半、選中的膠囊再減內距 4），不給滑桿
  // 預設 1（round，正半圓）：2026-11-25 和 iOS 原生的浮動分頁列比對後從 1.2 改回
  tabBar: { label: '底部分頁列', note: '64px 高的膠囊。點預覽裡的格子可以看選中的膠囊滑過去。預設是正半圓（和 iOS 原生的一致）', token: '--corner-tab-bar', shape: 1, defaultShape: 1 },
  tabIndicator: { label: '分頁列裡選中的膠囊', note: '56px 高、圓角 28，和外層同心。預設是正半圓', token: '--corner-tab-indicator', shape: 1, defaultShape: 1 },
})

/** 全部切回一般圓角：對照 Safari（含 iPhone）上看到的樣子。半徑不動 */
const allRound = ref(false)

const supported = ref<boolean | null>(null)
onMounted(() => { supported.value = CSS.supports('corner-shape', 'squircle') })

/** superellipse 的值寫成 CSS：1 是 round、2 是 squircle，其他照數字 */
function shapeValue(k: number) {
  const v = Math.round(k * 10) / 10
  if (v === 1) return 'round'
  if (v === 2) return 'squircle'
  return `superellipse(${v})`
}

const vars = computed(() => {
  const out: Record<string, string> = {}
  for (const kind of Object.values(kinds)) {
    out[kind.token] = allRound.value ? 'round' : shapeValue(kind.shape)
    if (kind.radius) out[kind.radius.token] = `${kind.radius.value}px`
  }
  return out
})

// 最下方可以複製的 CSS：每個 token 的最終值（不受「全部切回一般圓角」影響）。改過的標註原本的值
const cssText = computed(() => {
  const lines = ['/* 轉角形狀：/dev/corners 調整的結果，貼到 assets/css/tokens.css 的 :root */']
  for (const kind of Object.values(kinds)) {
    const shape = shapeValue(kind.shape)
    const shapeNote = kind.shape === kind.defaultShape ? '' : `  /* 改過，原本 ${shapeValue(kind.defaultShape)} */`
    lines.push(`${kind.token}: ${shape};${shapeNote}`)
    if (kind.radius) {
      const r = kind.radius
      lines.push(r.value === r.default
        ? `${r.token}: ${r.fallback};  /* ${r.default}px，沒有改 */`
        : `${r.token}: ${r.value}px;  /* 改過，原本 ${r.default}px */`)
    }
  }
  return lines.join('\n')
})

function reset() {
  for (const kind of Object.values(kinds)) {
    kind.shape = kind.defaultShape
    if (kind.radius) kind.radius.value = kind.radius.default
  }
  allRound.value = false
}

const copied = ref('')
async function copy() {
  try {
    await navigator.clipboard.writeText(cssText.value)
    copied.value = '已複製'
  }
  catch {
    copied.value = '沒有複製成功，請直接選取下面的文字'
  }
}

// 預覽用的假內容
const note = ref('酸甜平衡，尾韻有茶感')
const fav = ref(true)
const favOff = ref(false)
const roast = ref<string>('medium_dark')
const brewDate = ref('2026-11-19')
const brewTime = ref('08:30')
const total = ref<number | null>(150)
const chips = reactive({ 檸檬: true, 柑橘: false, 莓果: false, 蜂蜜: true })
const ROAST = { light: '淺焙', medium_light: '中淺焙', medium: '中焙', medium_dark: '中深焙', dark: '深焙' } as Record<string, string>
</script>

<template>
  <main class="dev-corners mx-auto flex flex-col gap-8 px-5 pt-6 pb-16" :style="{ maxWidth: '390px', ...vars }">
    <header class="flex flex-col gap-3">
      <h1 class="text-display-s font-medium">轉角形狀的調整</h1>
      <p class="text-sm text-muted">
        開發用，只在 <code>pnpm dev</code> 存在。<strong>只有 Chrome／Edge 139 以後看得到效果</strong>；正式版的 Safari（含 iPhone 上所有瀏覽器）與 Firefox 一律顯示一般圓角。
      </p>
      <p v-if="supported !== null" class="text-sm" :style="{ color: supported ? 'var(--accent-text)' : 'var(--danger)' }">
        {{ supported ? '這個瀏覽器支援 corner-shape。' : '這個瀏覽器不支援 corner-shape：滑桿的轉角形狀不會有效果（半徑仍然會），看到的就是 iPhone 上的樣子。' }}
      </p>
      <FormCard pill>
        <FormRow>
          <ToggleSwitch v-model="allRound" label="全部切回一般圓角" row />
        </FormRow>
        <FormNote>對照 iPhone 上看到的樣子。半徑不變，只有轉角形狀換回圓弧</FormNote>
      </FormCard>
      <AppButton variant="outline" @click="reset">全部回到預設值</AppButton>
    </header>

    <section v-for="(kind, key) in kinds" :key="key" class="flex flex-col gap-3">
      <div class="flex flex-col">
        <h2 class="text-heading-m font-medium">{{ kind.label }}</h2>
        <p v-if="kind.note" class="text-sm text-muted">{{ kind.note }}</p>
      </div>

      <label class="dev-slider">
        <span class="text-sm">superellipse</span>
        <input v-model.number="kind.shape" type="range" min="1" max="3" step="0.1" :aria-label="`${kind.label}的 superellipse`">
        <output class="text-sm tabular-nums">{{ shapeValue(kind.shape) }}</output>
      </label>
      <label v-if="kind.radius" class="dev-slider">
        <span class="text-sm">圓角半徑</span>
        <input v-model.number="kind.radius.value" type="range" min="0" :max="kind.radius.max" :step="kind.radius.step" :aria-label="`${kind.label}的圓角半徑`">
        <output class="text-sm tabular-nums">{{ kind.radius.value }}px</output>
      </label>

      <!-- 預覽：實際的元件、假的內容 -->
      <div class="flex flex-col gap-3">
        <template v-if="key === 'cardPill'">
          <FormCard pill>
            <FormRow label="心得筆記" for="dev-note"><SheetText id="dev-note" v-model="note" /></FormRow>
          </FormCard>
          <FormCard pill>
            <FormRow><ToggleSwitch v-model="fav" label="收藏" row /></FormRow>
          </FormCard>
        </template>

        <template v-else-if="key === 'cardPillTall'">
          <FormCard pill tall>
            <FormRow label="沖煮時間" tall><DurationPicker v-model="total" /></FormRow>
          </FormCard>
        </template>

        <template v-else-if="key === 'save'">
          <AppButton type="button" block>儲存</AppButton>
          <AppButton type="button" variant="outline" block>編輯</AppButton>
        </template>

        <template v-else-if="key === 'sheet'">
          <FormCard>
            <FormRow label="烘焙度" for="dev-roast" tall>
              <SelectField :text="ROAST[roast] ?? '選填'" :empty="!ROAST[roast]">
                <select id="dev-roast" v-model="roast">
                  <option value="">選填</option>
                  <option v-for="(name, value) in ROAST" :key="value" :value="value">{{ name }}</option>
                </select>
              </SelectField>
            </FormRow>
            <FormRow label="沖煮日期" for="dev-date" tall>
              <div class="flex min-w-0 items-center justify-end gap-2">
                <SelectField :text="pillDate(brewDate) ?? '選填'" :empty="!pillDate(brewDate)">
                  <input id="dev-date" v-model="brewDate" type="date">
                </SelectField>
                <SelectField class="shrink-0" :text="pillTime(brewTime) ?? '選填'" :empty="!pillTime(brewTime)">
                  <input v-model="brewTime" type="time" aria-label="時刻">
                </SelectField>
              </div>
            </FormRow>
            <FormRow>
              <div class="sheet-row sheet-row--tall">
                <span class="sheet-label">豆子</span>
                <span class="sheet-value"><SheetPill>瓜地馬拉 微微特南果</SheetPill></span>
              </div>
            </FormRow>
            <FormRow label="沖煮時間" tall><DurationPicker v-model="total" /></FormRow>
          </FormCard>
        </template>

        <template v-else-if="key === 'chip'">
          <FormCard>
            <div class="card-pad-x flex flex-wrap gap-2 py-4">
              <ChoiceChip v-for="(on, name) in chips" :key="name" :selected="on" @click="chips[name] = !on">{{ name }}</ChoiceChip>
            </div>
          </FormCard>
        </template>

        <template v-else-if="key === 'toggle'">
          <FormCard>
            <FormRow><ToggleSwitch v-model="fav" label="收藏" row /></FormRow>
            <FormRow><ToggleSwitch v-model="favOff" label="設為常用" row /></FormRow>
          </FormCard>
        </template>

        <template v-else-if="key === 'bar'">
          <GoalWeekCard :count="4" :goal="5" :days="[1, 2, 0, 1, 0, 0, 0]" radius="ml" />
        </template>

        <template v-else-if="key === 'cardMl'">
          <div class="grid grid-cols-2 gap-3">
            <AppCard title="累計" radius="ml" class="flex flex-col overflow-hidden" :style="{ height: 'var(--overview-card-h)' }">
              <span class="flex flex-col gap-1 px-3 pt-0.5 pb-2">
                <span class="flex flex-col"><span class="text-sm">總共記錄</span><MetricValue :value="17" unit="筆" /></span>
                <span class="flex flex-col"><span class="text-sm">喝過豆子</span><MetricValue :value="9" unit="支" /></span>
              </span>
            </AppCard>
            <AppCard title="本月" radius="ml" class="flex flex-col overflow-hidden" :style="{ height: 'var(--overview-card-h)' }">
              <span class="flex flex-col gap-1 px-3 pt-0.5 pb-2">
                <span class="flex flex-col"><span class="text-sm">記錄</span><MetricValue :value="5" unit="筆" /></span>
                <span class="flex flex-col"><span class="text-sm">煮了豆子</span><MetricValue :value="68" unit="克" /></span>
              </span>
            </AppCard>
          </div>
        </template>

        <template v-else-if="key === 'cardMd'">
          <!-- 結算頁的本週目標：GoalWeekCard 的預設就是 md -->
          <GoalWeekCard :count="5" :goal="5" :days="[1, 2, 0, 1, 1, 0, 0]" />
        </template>

        <template v-else-if="key === 'tabBar' || key === 'tabIndicator'">
          <BottomNav preview />
        </template>

        <template v-else-if="key === 'cardLg'">
          <FormCard>
            <FormRow label="磨豆機"><span>Comandante C40</span></FormRow>
            <FormRow label="研磨刻度"><span>24</span></FormRow>
          </FormCard>
        </template>
      </div>
    </section>

    <section class="flex flex-col gap-3">
      <h2 class="text-heading-m font-medium">最終值</h2>
      <p class="text-sm text-muted">每個 token 的值。調好之後整段複製，貼回給 Claude。</p>
      <pre class="dev-css">{{ cssText }}</pre>
      <div class="flex items-center gap-3">
        <AppButton variant="outline" @click="copy">複製</AppButton>
        <span class="text-sm text-muted" aria-live="polite">{{ copied }}</span>
      </div>
    </section>
  </main>
</template>

<style scoped>
.dev-slider {
  display: grid;
  grid-template-columns: 6.5rem 1fr 7.5rem;
  align-items: center;
  gap: 0.75rem;
  min-height: var(--touch-min);
}
.dev-slider input {
  width: 100%;
  accent-color: var(--accent);
}
.dev-slider output {
  text-align: right;
}
.dev-css {
  overflow-x: auto;
  padding: 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  font-size: 0.75rem;
  line-height: 1.6;
  white-space: pre;
  user-select: all;
}
</style>
