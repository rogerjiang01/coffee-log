// 表單卡片把「卡片下方放小字的那一塊」交給裡面的 FormNote（components/FormCard.vue、FormNote.vue）。
import type { InjectionKey, Ref } from 'vue'

export const FORM_CARD_FOOTER: InjectionKey<Ref<HTMLElement | null>> = Symbol('form-card-footer')
