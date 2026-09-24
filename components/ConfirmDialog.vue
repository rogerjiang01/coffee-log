<script setup lang="ts">
// 自訂對話框（《03-介面規範》§4.8）。
// 規格禁止使用瀏覽器原生的 alert / confirm / prompt。
// 內文是陳述句：先說「刪除後無法復原。」，有連帶影響再說明；按鈕寫「刪除」，
// 刪除的對象已經在標題裡。

const props = defineProps<{
  open: boolean
  title: string
  body: string
  confirmLabel: string
  busy?: boolean
}>()

const emit = defineEmits<{ confirm: []; cancel: [] }>()

const dialog = ref<HTMLDialogElement | null>(null)
const heading = ref<HTMLElement | null>(null)

// 返回鍵等同「取消」：不刪
useOverlayHistory(() => props.open, () => emit('cancel'))

watch(() => props.open, (value) => {
  if (!dialog.value) return
  if (value && !dialog.value.open) {
    dialog.value.showModal()
    // showModal() 預設聚焦第一個按鈕（取消），觸控開啟也會出現焦點框。
    // 改放在標題：它不是互動元素，不畫焦點框；焦點不在刪除按鈕上，按 Enter 也不會誤刪
    heading.value?.focus()
  }
  if (!value && dialog.value.open) dialog.value.close()
})
</script>

<template>
  <!-- dialog 本身是滿版的置中容器（樣式在 main.css），卡片是內層這一個 -->
  <dialog
    ref="dialog"
    class="backdrop:bg-[var(--overlay-scrim)]"
    @cancel.prevent="emit('cancel')"
  >
    <div
      class="w-full max-w-sm rounded-lg p-6"
      :style="{ background: 'var(--surface)', color: 'var(--text)', boxShadow: 'var(--overlay-shadow)' }"
    >
      <h2 ref="heading" tabindex="-1" class="text-xl font-normal text-balance break-keep wrap-anywhere outline-none">{{ title }}</h2>
      <p class="mt-3 text-sm text-pretty">{{ body }}</p>

      <div class="mt-6 flex gap-3">
        <button
          type="button"
          class="flex-1 rounded-sm border px-4 py-3"
          :style="{ borderColor: 'var(--border)', minHeight: 'var(--touch-min)' }"
          @click="emit('cancel')"
        >
          取消
        </button>
        <button
          type="button"
          :disabled="busy"
          class="flex-1 rounded-sm px-4 py-3 font-medium disabled:opacity-60"
          :style="{ background: 'var(--danger)', color: 'var(--on-danger)', minHeight: 'var(--touch-min)' }"
          @click="emit('confirm')"
        >
          {{ busy ? '刪除中' : confirmLabel }}
        </button>
      </div>
    </div>
  </dialog>
</template>
