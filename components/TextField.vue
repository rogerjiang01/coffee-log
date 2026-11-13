<script setup lang="ts">
// 有框的輸入框（《03》§4.1，Figma 的 input）。
//
// 用在**不在卡片裡**的輸入：登入、註冊、搜尋、浮層裡的就地新增。
// 卡片裡的表單列用 FormRow（Figma 的 Sheet Row），不用這個。
//
// 聚焦與錯誤畫在框上（邊框變色加一圈光暈），所以裡面的 <input> 不畫全站的焦點框。
// 高度是觸控目標下限（44px）；Figma 畫的是 42px。

defineOptions({ inheritAttrs: false })

const props = defineProps<{
  label?: string
  /** 必填的 *。必填欄位只有三個（CLAUDE.md 硬性規則 7），而且都在卡片裡，目前沒有地方用到 */
  required?: boolean
  unit?: string
  /** 錯誤訊息。有值時框變成錯誤狀態，訊息顯示在框的左下方 */
  error?: string
  /** 提示字只是範例（example@email.com）：可以用比較淡的 --text-placeholder（《03》§4.1） */
  example?: boolean
  disabled?: boolean
  id?: string
}>()

const model = defineModel<string>({ default: '' })
const auto = useId()
const fieldId = computed(() => props.id ?? auto)
</script>

<template>
  <div class="text-field" :data-error="!!error || undefined" :data-disabled="disabled || undefined">
    <label v-if="label" :for="fieldId" class="text-field__label">
      {{ label }}<span v-if="required" class="text-field__required" aria-hidden="true">*</span>
    </label>
    <div class="text-field__box">
      <input
        :id="fieldId"
        v-model="model"
        v-bind="$attrs"
        :disabled="disabled"
        :aria-invalid="!!error || undefined"
        :aria-describedby="error ? `${fieldId}-error` : undefined"
        class="text-field__input"
        :class="example ? 'placeholder-example' : ''"
      >
      <span v-if="unit" class="text-field__unit">{{ unit }}</span>
    </div>
    <div v-if="error || $slots.action" class="text-field__below">
      <p v-if="error" :id="`${fieldId}-error`" class="text-field__error">{{ error }}</p>
      <span v-if="$slots.action" class="text-field__action"><slot name="action" /></span>
    </div>
  </div>
</template>

<style scoped>
.text-field__label {
  display: flex;
  gap: 2px;
  font-size: var(--text-body-m);
  line-height: var(--text-body-m--line-height);
  color: var(--text);
}
.text-field__required {
  color: var(--danger);
}
.text-field__box {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-height: var(--touch-min);
  padding: 0 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  box-shadow: var(--shadow-light);
  transition: border-color var(--motion-duration) var(--motion-ease), box-shadow var(--motion-duration) var(--motion-ease);
}
.text-field__box:focus-within {
  border-color: var(--accent-active);
  box-shadow: var(--shadow-focus);
}
.text-field[data-error] .text-field__box {
  border-color: var(--danger);
  box-shadow: var(--shadow-error);
}
.text-field__input {
  flex: 1;
  min-width: 0;
  /* 框的高度扣掉上下邊框，讓整個框都點得到輸入 */
  min-height: calc(var(--touch-min) - 2px);
  border: 0;
  background: transparent;
  font-size: var(--text-heading-s);
  line-height: var(--text-heading-s--line-height);
  color: var(--text);
}
.text-field__input:focus,
.text-field__input:focus-visible {
  outline: none;
}
.text-field__unit {
  flex-shrink: 0;
  color: var(--text-muted);
}
.text-field__below {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  font-size: var(--text-body-m);
  line-height: var(--text-body-m--line-height);
}
.text-field__error {
  color: var(--danger);
}
.text-field__action {
  margin-left: auto;
  color: var(--accent-text);
}

.text-field[data-disabled] .text-field__label,
.text-field[data-disabled] .text-field__unit,
.text-field[data-disabled] .text-field__action {
  color: var(--text-faint);
}
.text-field[data-disabled] .text-field__box {
  background: var(--surface-muted);
}
.text-field[data-disabled] .text-field__input {
  color: var(--text-placeholder);
}
</style>
