<script setup lang="ts">
// 按鈕（《03》§4.18，Figma 的 Button）。
//
// 三種外觀：filled（主要動作）、outline（次要）、text（文字按鈕）。
// tone="danger" 是 Figma 沒有畫的：確認刪除（filled）與頁面上的刪除（text）沿用同一個結構，只換顏色。
//
// busy（Figma 的 sending）**不照 Figma 換成 green-400 底**：那上面的白字只有 3.78:1，
// 而《03》§2.1 明寫 green-400 不可配白字。底色維持不變、按鈕停用，
// 進行中由文字表達（「儲存中」），呼叫的地方自己換文字。
//
// 有 to 時渲染成連結，外觀相同。
//
// **滿寬（block）的實心與外框按鈕一律是膠囊形**（2026-11-19，《03》§4.18 的通則）：高度和表單的列一樣是 65px
// （--sheet-row-h）、圓角是高度的一半（--radius-block-button）、轉角 --corner-block-button（corner-shape，漸進增強）。
// 原本只有表單最下方的儲存按鈕是膠囊形（shape="pill"，2026-11-17），現在改成看「是不是滿寬」，那個 prop 拿掉了。
// 不是滿寬的按鈕維持 44px（觸控目標下限）、--radius-sm；文字按鈕沒有外框，滿寬也維持原樣。

const props = withDefaults(defineProps<{
  variant?: 'filled' | 'outline' | 'text'
  tone?: 'accent' | 'danger'
  type?: 'button' | 'submit'
  /** 進行中：停用，外觀不變 */
  busy?: boolean
  disabled?: boolean
  /** 佔滿容器寬度。實心與外框的滿寬按鈕是膠囊形、65px（見檔頭） */
  block?: boolean
  to?: string
}>(), { variant: 'filled', tone: 'accent', type: 'button' })

const classes = computed(() => [
  'app-button',
  `app-button--${props.variant}`,
  props.tone === 'danger' ? 'app-button--danger' : '',
  props.block ? 'w-full' : '',
  props.block && props.variant !== 'text' ? 'app-button--block' : '',
])
</script>

<template>
  <NuxtLink v-if="to" :to="to" :class="classes">
    <slot />
  </NuxtLink>
  <button
    v-else
    :type="type"
    :disabled="disabled || busy"
    :aria-busy="busy || undefined"
    :data-busy="busy || undefined"
    :class="classes"
  >
    <slot />
  </button>
</template>

<style scoped>
.app-button {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  min-height: var(--touch-min);
  padding: 0 1.25rem;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  font-size: var(--text-heading-s);
  line-height: var(--text-heading-s--line-height);
  font-weight: 400;
  text-align: center;
  transition: background var(--motion-duration) var(--motion-ease);
}

.app-button--filled {
  background: var(--accent);
  color: var(--on-accent);
}
.app-button--filled:active:not(:disabled) {
  background: var(--accent-active);
}
.app-button--outline {
  border-color: var(--accent);
  color: var(--accent-text);
}
.app-button--text {
  color: var(--accent-text);
}

.app-button--danger.app-button--filled {
  background: var(--danger);
  color: var(--on-danger);
}
.app-button--danger.app-button--outline {
  border-color: var(--danger);
  color: var(--danger);
}
.app-button--danger.app-button--text {
  color: var(--danger);
}

/* 滿寬的實心與外框按鈕：和表單的列同高（--sheet-row-h，65px）、圓角是高度的一半（32.5px），
   轉角 superellipse（tokens.css 的 --corner-block-button，漸進增強）。2026-11-19 從「只有儲存按鈕」改成通則 */
.app-button--block {
  min-height: var(--sheet-row-h);
  border-radius: var(--radius-block-button);
  corner-shape: var(--corner-block-button);
}

/* 停用（不是進行中）：Figma 的 disabled。進行中的按鈕外觀不變。 */
.app-button:disabled:not([data-busy]) {
  color: var(--text-placeholder);
}
.app-button--filled:disabled:not([data-busy]) {
  background: var(--control-inactive);
}
.app-button--outline:disabled:not([data-busy]) {
  border-color: var(--control-inactive);
}
</style>
